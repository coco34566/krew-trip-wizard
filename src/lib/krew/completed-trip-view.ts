import { getTripLifecycleState } from "./trip-lifecycle";

export type CompletedTripSource = {
  dates_locked?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
};

export function isCompletedTripView(
  trip: CompletedTripSource | null | undefined,
  now?: Date,
): boolean {
  if (!trip) return false;
  return getTripLifecycleState({
    datesLocked: Boolean(trip.dates_locked),
    startDate: trip.start_date,
    endDate: trip.end_date,
    now,
  }) === "completed";
}

export function availabilityProgressForDashboard(input: {
  datesLocked: boolean;
  answered: number;
  expected: number;
}) {
  if (input.datesLocked) {
    return { answered: input.answered, expected: input.answered, missing: 0 };
  }

  return {
    answered: input.answered,
    expected: input.expected,
    missing: Math.max(0, input.expected - input.answered),
  };
}
