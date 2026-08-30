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

  it("utilise endTime en priorité pour déterminer une activité en cours", () => {
    const states = classifyLiveSlots(
      [
        { label: "Brunch", time: "10:00", endTime: "11:45", durationMinutes: 30 },
        { label: "Kayak", time: "14:30" },
        { label: "Dîner", time: "20:00" },
      ],
      localNoon(2026, 8, 30, 11, 15),
    );
    expect(states.map((state) => state.status)).toEqual(["current", "upcoming", "upcoming"]);
    expect(states[0].endMinutes).toBe(11 * 60 + 45);
  });

  it("ne déclenche un conflit météo que pour une météo réellement gênante", () => {
    expect(hasMeaningfulWeatherConflict({ date: "2026-08-30", kind: "cloudy", label: "Nuageux", tempMin: 15, tempMax: 22, precipitationMm: 0 })).toBe(false);
    expect(hasMeaningfulWeatherConflict({ date: "2026-08-30", kind: "rain", label: "Pluie", tempMin: 15, tempMax: 20, precipitationMm: 4 })).toBe(true);
  });

  it("reconnaît la catégorie KREW sport_outdoor sans heuristique sur le nom", () => {
    const now = localNoon(2026, 8, 30, 12, 0);
    const [outdoor, indoor] = classifyLiveSlots(
      [
        { label: "Session", time: "14:30", category: "sport_outdoor" },
        { label: "Musée", time: "15:00", category: "culture" },
      ],
      now,
    );
    const rain = { date: "2026-08-30", kind: "rain" as const, label: "Pluie", tempMin: 15, tempMax: 20, precipitationMm: 5 };
    expect(isPlanBCandidate(outdoor, rain, now)).toBe(true);
    expect(isPlanBCandidate(indoor, rain, now)).toBe(false);
  });
});
