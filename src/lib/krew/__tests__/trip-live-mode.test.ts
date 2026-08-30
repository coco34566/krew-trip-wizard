import { describe, expect, it } from "vitest";
import {
  classifyLiveSlots,
  hasMeaningfulWeatherConflict,
  isPlanBCandidate,
  isTripLiveMode,
  tripDayNumber,
} from "@/lib/krew/trip-live-mode";

const localNoon = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute, 0, 0);

describe("trip live mode", () => {
  it("reste désactivé avant le départ et après le séjour", () => {
    const base = { datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01" };
    expect(isTripLiveMode({ ...base, now: localNoon(2026, 8, 29) })).toBe(false);
    expect(isTripLiveMode({ ...base, now: localNoon(2026, 9, 2) })).toBe(false);
  });

  it("est actif du premier au dernier jour, uniquement avec dates verrouillées", () => {
    const base = { startDate: "2026-08-30", endDate: "2026-09-01" };
    expect(isTripLiveMode({ ...base, datesLocked: false, now: localNoon(2026, 8, 30) })).toBe(false);
    expect(isTripLiveMode({ ...base, datesLocked: true, now: localNoon(2026, 8, 30) })).toBe(true);
    expect(isTripLiveMode({ ...base, datesLocked: true, now: localNoon(2026, 9, 1) })).toBe(true);
    expect(tripDayNumber(base.startDate, localNoon(2026, 8, 31))).toBe(2);
  });

  it("ne marque en cours que si une durée réelle est disponible", () => {
    const states = classifyLiveSlots(
      [
        { label: "Brunch", time: "10:00", duration_minutes: 90 },
        { label: "Kayak", time: "14:30" },
        { label: "Dîner", time: "20:00" },
      ],
      localNoon(2026, 8, 30, 10, 30),
    );
    expect(states.map((state) => state.status)).toEqual(["current", "upcoming", "upcoming"]);
  });

  it("ne déclenche un conflit météo que pour une météo réellement gênante", () => {
    expect(hasMeaningfulWeatherConflict({ date: "2026-08-30", kind: "cloudy", label: "Nuageux", tempMin: 15, tempMax: 22, precipitationMm: 0 })).toBe(false);
    expect(hasMeaningfulWeatherConflict({ date: "2026-08-30", kind: "rain", label: "Pluie", tempMin: 15, tempMax: 20, precipitationMm: 4 })).toBe(true);
  });

  it("propose un Plan B uniquement pour une activité explicitement outdoor dans les prochaines heures", () => {
    const now = localNoon(2026, 8, 30, 12, 0);
    const [outdoor, indoor] = classifyLiveSlots(
      [
        { label: "Kayak", time: "14:30", outdoor: true },
        { label: "Musée", time: "15:00", indoor: true },
      ],
      now,
    );
    const rain = { date: "2026-08-30", kind: "rain" as const, label: "Pluie", tempMin: 15, tempMax: 20, precipitationMm: 5 };
    expect(isPlanBCandidate(outdoor, rain, now)).toBe(true);
    expect(isPlanBCandidate(indoor, rain, now)).toBe(false);
  });
});
