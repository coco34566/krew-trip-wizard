import { describe, it, expect } from "vitest";
import { computeGroupTimeWindow } from "../krew/engine";

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
});
