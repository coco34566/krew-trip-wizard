export type DashboardResponseState =
  | { state: "loading" }
  | {
      state: "ready";
      preferencesExpected: number;
      preferencesAnswered: number;
      availabilityExpected: number;
      availabilityAnswered: number;
    };

export function getDashboardResponseState(input: {
  progressReady: boolean;
  datesLocked: boolean;
  preferencesExpected?: number | null;
  preferencesAnswered?: number | null;
  availabilityExpected?: number | null;
  availabilityAnswered?: number | null;
}): DashboardResponseState {
  if (!input.progressReady) return { state: "loading" };

  const preferencesExpected = Math.max(0, input.preferencesExpected ?? 0);
  const availabilityExpected = Math.max(0, input.availabilityExpected ?? 0);
  const rawPreferencesAnswered = Math.max(0, input.preferencesAnswered ?? 0);
  const rawAvailabilityAnswered = Math.max(0, input.availabilityAnswered ?? 0);

  return {
    state: "ready",
    preferencesExpected,
    preferencesAnswered: input.datesLocked ? preferencesExpected : rawPreferencesAnswered,
    availabilityExpected,
    availabilityAnswered: input.datesLocked ? availabilityExpected : rawAvailabilityAnswered,
  };
}
