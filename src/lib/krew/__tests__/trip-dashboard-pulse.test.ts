import { describe, expect, it } from "vitest";
import { getKrewPulse, getTripCountdown } from "@/lib/krew/trip-dashboard-pulse";

const readyBase = {
  availabilityAnswered: 4,
  availabilityExpected: 4,
  preferencesAnswered: 4,
  preferencesExpected: 4,
  datesLocked: true,
  profileReady: true,
  profileValidated: true,
  destinationSelected: true,
  hotelOffersReady: true,
  hotelSelected: true,
  transportOffersReady: true,
  transportPickedCount: 4,
  transportExpectedCount: 4,
  hasItinerary: true,
};

describe("Krew Pulse", () => {
  it("priorise les réponses manquantes sur les choix aval avant verrouillage", () => {
    expect(
      getKrewPulse({
        ...readyBase,
        datesLocked: false,
        availabilityAnswered: 2,
        preferencesAnswered: 3,
        hotelSelected: false,
        hasItinerary: false,
      }),
    ).toEqual({ state: "waiting", message: "Il manque encore des réponses du groupe." });
  });

  it("ne rouvre pas les disponibilités quand un participant arrive après verrouillage", () => {
    expect(
      getKrewPulse({
        ...readyBase,
        availabilityAnswered: 1,
        availabilityExpected: 2,
      }),
    ).toEqual({ state: "ready", message: "Tout est calé." });
  });

  it("signale un profil prêt mais non validé avant la destination", () => {
    expect(
      getKrewPulse({ ...readyBase, profileValidated: false, destinationSelected: false, hotelOffersReady: false, hotelSelected: false, transportOffersReady: false, hasItinerary: false }),
    ).toEqual({ state: "attention", message: "Le Profil du voyage reste à choisir." });
  });

  it("signale le choix collectif de l’hébergement", () => {
    expect(getKrewPulse({ ...readyBase, hotelSelected: false, hasItinerary: false })).toEqual({
      state: "attention",
      message: "Le groupe doit encore choisir l’hébergement.",
    });
  });

  it("compte les transports individuels réellement manquants", () => {
    expect(getKrewPulse({ ...readyBase, transportPickedCount: 1, hasItinerary: false })).toEqual({
      state: "waiting",
      message: "3 personnes n’ont pas choisi leur transport.",
    });
  });

  it("considère le voyage calé quand le planning existe et les états précédents sont résolus", () => {
    expect(getKrewPulse(readyBase)).toEqual({ state: "ready", message: "Tout est calé." });
  });
});

describe("compte à rebours du voyage", () => {
  const now = new Date(2026, 7, 30, 15, 0, 0);

  it("ne s’affiche pas tant que les dates ne sont pas verrouillées", () => {
    expect(getTripCountdown({ datesLocked: false, startDate: "2026-09-10", now })).toBeNull();
  });

  it("affiche un J-n sans jamais produire J-0", () => {
    expect(getTripCountdown({ datesLocked: true, startDate: "2026-09-22", endDate: "2026-09-24", now })).toMatchObject({
      state: "future",
      label: "J-23",
      daysUntilStart: 23,
    });
  });

  it("utilise Demain la veille du départ", () => {
    expect(getTripCountdown({ datesLocked: true, startDate: "2026-08-31", endDate: "2026-09-02", now })).toEqual({
      state: "tomorrow",
      label: "Demain",
      microcopy: "Demain, la Krew part.",
      daysUntilStart: 1,
    });
  });

  it("utilise Aujourd’hui le jour du départ", () => {
    expect(getTripCountdown({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01", now })).toMatchObject({
      state: "today",
      label: "Aujourd’hui",
    });
  });

  it("gère un voyage en cours", () => {
    expect(getTripCountdown({ datesLocked: true, startDate: "2026-08-29", endDate: "2026-08-31", now })).toMatchObject({
      state: "ongoing",
      label: "En voyage",
    });
  });

  it("gère un voyage terminé", () => {
    expect(getTripCountdown({ datesLocked: true, startDate: "2026-08-20", endDate: "2026-08-22", now })).toMatchObject({
      state: "ended",
      label: "Voyage terminé",
    });
  });
});
