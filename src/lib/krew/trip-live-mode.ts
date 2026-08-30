import type { TripWeatherDay } from "./trip-weather";

export type LiveTripSlot = Record<string, unknown> & {
  label?: string;
  time?: string;
  type?: string;
};

export type LiveSlotState = {
  slot: LiveTripSlot;
  slotIndex: number;
  status: "past" | "current" | "upcoming" | "untimed";
  startMinutes: number | null;
  endMinutes: number | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localCalendarDateKey(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dateKeyToUtcDay(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function isTripLiveMode(input: {
  datesLocked: boolean;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): boolean {
  if (!input.datesLocked || !input.startDate) return false;
  const today = localCalendarDateKey(input.now ?? new Date());
  const start = input.startDate.slice(0, 10);
  const end = (input.endDate || input.startDate).slice(0, 10);
  return today >= start && today <= end;
}

export function tripDayNumber(startDate: string | null | undefined, now = new Date()): number | null {
  if (!startDate) return null;
  const start = dateKeyToUtcDay(startDate.slice(0, 10));
  const today = dateKeyToUtcDay(localCalendarDateKey(now));
  if (start == null || today == null) return null;
  return today - start + 1;
}

export function parseClockMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationMinutes(slot: LiveTripSlot): number | null {
  const direct = Number(slot.durationMinutes ?? slot.duration_minutes);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const hours = Number(slot.durationHours ?? slot.duration_hours);
  if (Number.isFinite(hours) && hours > 0) return hours * 60;
  return null;
}

export function classifyLiveSlots(slots: LiveTripSlot[], now = new Date()): LiveSlotState[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.map((slot, slotIndex) => {
    const startMinutes = parseClockMinutes(slot.time);
    if (startMinutes == null) {
      return { slot, slotIndex, status: "untimed", startMinutes: null, endMinutes: null };
    }
    const explicitEndMinutes = parseClockMinutes(slot.endTime ?? slot.end_time);
    const duration = durationMinutes(slot);
    const endMinutes =
      explicitEndMinutes != null
        ? explicitEndMinutes
        : duration != null
          ? startMinutes + duration
          : null;
    const status =
      nowMinutes < startMinutes
        ? "upcoming"
        : endMinutes != null && nowMinutes < endMinutes
          ? "current"
          : "past";
    return { slot, slotIndex, status, startMinutes, endMinutes };
  });
}

export function isActivityLikeSlot(slot: LiveTripSlot): boolean {
  const type = String(slot.type ?? "").toLowerCase();
  return type !== "transport" && type !== "hotel" && type !== "accommodation";
}

export function isExplicitOutdoorSlot(slot: LiveTripSlot): boolean {
  const category = String(slot.category ?? "").toLowerCase();
  return (
    category === "sport_outdoor" ||
    slot.outdoor === true ||
    slot.isOutdoor === true ||
    slot.weatherSensitive === true ||
    String(slot.environment ?? "").toLowerCase() === "outdoor" ||
    String(slot.locationType ?? "").toLowerCase() === "outdoor"
  );
}

export function hasMeaningfulWeatherConflict(weather: TripWeatherDay | null | undefined): boolean {
  if (!weather) return false;
  if (weather.kind === "storm" || weather.kind === "snow") return true;
  if (weather.precipitationMm >= 3) return true;
  return weather.kind === "rain" && weather.precipitationMm >= 2;
}

export function isPlanBCandidate(
  state: LiveSlotState,
  weather: TripWeatherDay | null | undefined,
  now = new Date(),
): boolean {
  if (state.status !== "upcoming" || state.startMinutes == null) return false;
  if (!isActivityLikeSlot(state.slot) || !isExplicitOutdoorSlot(state.slot)) return false;
  if (!hasMeaningfulWeatherConflict(weather)) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesUntil = state.startMinutes - nowMinutes;
  return minutesUntil >= 0 && minutesUntil <= 6 * 60;
}
