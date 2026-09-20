import { describe, expect, it } from "vitest";
import { getTripCountdown } from "@/lib/krew/trip-countdown";

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
