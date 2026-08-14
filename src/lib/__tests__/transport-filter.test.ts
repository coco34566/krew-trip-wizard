import { describe, it, expect } from "vitest";
import {
  computeGroupTimeWindow,
  scoreTransportOption,
  computeGroupTimeWindowExtended,
} from "../krew/engine";
import { checkTransportTimeCompatibility } from "../../integrations/external/transport.server";

describe("Filtre Horaire Transport (checkTransportTimeCompatibility)", () => {
  const constraints = {
    earliestDepartureTime: "08:00",
    latestArrivalTime: "12:00",
    earliestReturnDepartureTime: "16:00",
    latestReturnTime: "20:00",
  };

  it("heure connue + compatible → OK (isCompatible: true)", () => {
    const times = {
      outboundTime: "09:00",
      outboundArrivalTime: "11:00",
      returnDepartureTime: "17:00",
      returnTime: "19:00",
    };
    const res = checkTransportTimeCompatibility(times, constraints, true);
    expect(res.isCompatible).toBe(true);
  });

  it("heure connue + incompatible → exclu (isCompatible: false)", () => {
    // outboundTime 07:00 est < 08:00
    const res1 = checkTransportTimeCompatibility(
      { outboundTime: "07:00", outboundArrivalTime: "10:00", returnDepartureTime: "17:00", returnTime: "19:00" },
      constraints,
      true,
    );
    expect(res1.isCompatible).toBe(false);

    // outboundArrivalTime 13:00 est > 12:00
    const res2 = checkTransportTimeCompatibility(
      { outboundTime: "09:00", outboundArrivalTime: "13:00", returnDepartureTime: "17:00", returnTime: "19:00" },
      constraints,
      true,
    );
    expect(res2.isCompatible).toBe(false);

    // returnDepartureTime 15:00 est < 16:00
    const res3 = checkTransportTimeCompatibility(
      { outboundTime: "09:00", outboundArrivalTime: "11:00", returnDepartureTime: "15:00", returnTime: "19:00" },
      constraints,
      true,
    );
    expect(res3.isCompatible).toBe(false);

    // returnTime 21:00 est > 20:00
    const res4 = checkTransportTimeCompatibility(
      { outboundTime: "09:00", outboundArrivalTime: "11:00", returnDepartureTime: "17:00", returnTime: "21:00" },
      constraints,
      true,
    );
    expect(res4.isCompatible).toBe(false);
  });

  it("heure inconnue + contrainte impérative → exclu (isCompatible: false)", () => {
    const timesMissingOutbound = {
      outboundTime: null,
      outboundArrivalTime: "11:00",
      returnDepartureTime: "17:00",
      returnTime: "19:00",
    };
    const res = checkTransportTimeCompatibility(timesMissingOutbound, constraints, true);
    expect(res.isCompatible).toBe(false);
    expect(res.reason).toContain("impérative");
  });

  it("préférence souple + heure inconnue → ne pas exclure automatiquement (isCompatible: true)", () => {
    const timesMissingOutbound = {
      outboundTime: null,
      outboundArrivalTime: null,
      returnDepartureTime: null,
      returnTime: null,
    };
    const res = checkTransportTimeCompatibility(timesMissingOutbound, constraints, false);
    expect(res.isCompatible).toBe(true);
  });
});

describe("Filtre Horaire Transport (engine.ts)", () => {
  it("gère le cas où aucun participant n'a de préférence", () => {
    const window = computeGroupTimeWindow([]);
    expect(window.earliestDeparture).toBeNull();
    expect(window.latestReturn).toBeNull();
  });

  it("gère un seul participant avec des préférences", () => {
    const window = computeGroupTimeWindow([
      { earliest_departure_time: "08:30", latest_return_time: "20:00" },
    ]);
    expect(window.earliestDeparture).toBe("08:30");
    expect(window.latestReturn).toBe("20:00");
  });

  it("gère plusieurs participants avec des fenêtres compatibles", () => {
    // La contrainte la plus stricte gagne :
    // - Pour le départ, on veut le plus tard (stricte : au plus tôt après 10h00)
    // - Pour le retour, on veut le plus tôt (stricte : au plus tard avant 18h00)
    const window = computeGroupTimeWindow([
      { earliest_departure_time: "08:30", latest_return_time: "20:00" },
      { earliest_departure_time: "10:00", latest_return_time: "18:00" },
      { earliest_departure_time: "09:00", latest_return_time: "19:00" },
    ]);
    expect(window.earliestDeparture).toBe("10:00");
    expect(window.latestReturn).toBe("18:00");
  });

  it("gère des participants sans préférences mélangés avec des participants avec préférences", () => {
    const window = computeGroupTimeWindow([
      { earliest_departure_time: "", latest_return_time: "" },
      { earliest_departure_time: "09:00", latest_return_time: "19:00" },
      { earliest_departure_time: null, latest_return_time: null },
    ]);
    expect(window.earliestDeparture).toBe("09:00");
    expect(window.latestReturn).toBe("19:00");
  });

  it("calcule correctement la fenêtre étendue avec les picks de transports réels", () => {
    const window = computeGroupTimeWindowExtended(
      [{ earliest_departure_time: "08:30", latest_return_time: "20:00" }],
      [
        {
          userId: "1",
          displayName: "Lucas",
          city: "Paris",
          arrivalTime: "12:00",
          departureTime: "18:00",
        },
        {
          userId: "2",
          displayName: "Marie",
          city: "Paris",
          arrivalTime: "10:00",
          departureTime: "19:00",
        },
        {
          userId: "3",
          displayName: "Jean",
          city: "Lyon",
          arrivalTime: "14:30",
          departureTime: "16:00",
        },
      ],
    );

    // Median arrival should be 12:00
    expect(window.majorityArrival).toBe("12:00");
    expect(window.majorityDeparture).toBe("18:00");
    // Early birds should be Marie (arrives 10:00 < 12:00)
    expect(window.earlyBirds).toContain("Marie");
    // Late comers should be Jean (arrives 14:30 > 12:00 by 150 minutes >= 90 min)
    expect(window.lateComers).toContain("Jean");
    // Early leavers should be Jean (departs 16:00 < 18:00 by 120 minutes >= 90 min)
    expect(window.earlyLeavers).toContain("Jean");
  });
});

describe("Scoring Options Transport (engine.ts)", () => {
  it("calcule correctement le score pour une option économique et rapide", () => {
    const res = scoreTransportOption(
      { mode: "train", pricePerPerson: 50, durationHours: 2.5 },
      400, // budget total par personne
      5, // max travel duration constraint
    );
    expect(res.score).toBeGreaterThan(80);
    expect(res.matchReasons).toContain("Option très économique (dans ton budget transport estimé)");
    expect(res.matchReasons).toContain("Trajet très rapide (moins de 3h)");
  });

  it("pénalise une option lente et hors budget", () => {
    const res = scoreTransportOption(
      { mode: "bus", pricePerPerson: 250, durationHours: 12 },
      400,
      6,
    );
    // Price > 100 (which is 25% of 400), duration > 6h
    expect(res.score).toBeLessThan(50);
  });
});
