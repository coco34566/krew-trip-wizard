export type TripLifecycleState = "future" | "live" | "completed";

export type TripLifecycleInput = {
  datesLocked: boolean;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
};

function parseDateOnly(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function todayDateOnly(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Canonical temporal lifecycle for a trip.
 * Locked dates are deliberately the source of truth: the historical status enum
 * must not be required to advance a trip to its live/completed state.
 */
export function getTripLifecycleState(input: TripLifecycleInput): TripLifecycleState {
  if (!input.datesLocked) return "future";

  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate ?? input.startDate);
  if (start == null || end == null) return "future";

  const today = todayDateOnly(input.now ?? new Date());
  if (today > end) return "completed";
  if (today >= start) return "live";
  return "future";
}

export function isTripCompleted(input: TripLifecycleInput): boolean {
  return getTripLifecycleState(input) === "completed";
}

export function isTripLive(input: TripLifecycleInput): boolean {
  return getTripLifecycleState(input) === "live";
}
