export type AvailabilityCounterDisplay =
  | { state: "loading" }
  | { state: "ready"; answered: number; expected: number };

export function getAvailabilityCounterDisplay(input: {
  centralizedLoaded: boolean;
  answered?: number | null;
  expected?: number | null;
}): AvailabilityCounterDisplay {
  if (!input.centralizedLoaded) return { state: "loading" };
  return {
    state: "ready",
    answered: Math.max(0, input.answered ?? 0),
    expected: Math.max(0, input.expected ?? 0),
  };
}
