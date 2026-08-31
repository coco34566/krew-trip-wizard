import * as legacy from "./activity-ai.server";
import type {
  ActivityAiInput,
  ItineraryDayPlan,
  KrewSkeleton,
} from "./activity-ai.server";

export * from "./activity-ai.server";

/**
 * The selected transport remains individual. Only the group planning boundary is
 * normalized to the median/majority so one late arrival or early departure does
 * not block the whole group.
 */
export function normalizePlanningTransportMajority(input: ActivityAiInput): ActivityAiInput {
  const picks = input.transportPicksSummary ?? [];
  if (!picks.length) return input;

  const majorityArrival = legacy.aggregateMajorityTimePreference(
    picks.map((pick) => pick.arrival),
  );
  const majorityDeparture = legacy.aggregateMajorityTimePreference(
    picks.map((pick) => pick.departure),
  );

  return {
    ...input,
    latestGroupArrival: majorityArrival ?? input.latestGroupArrival ?? null,
    earliestGroupDeparture: majorityDeparture ?? input.earliestGroupDeparture ?? null,
  };
}

export function buildKrewSkeleton(input: ActivityAiInput): KrewSkeleton {
  return legacy.buildKrewSkeleton(normalizePlanningTransportMajority(input));
}

export async function geminiEnrichSkeleton(
  skeleton: KrewSkeleton,
  input: ActivityAiInput,
): ReturnType<typeof legacy.geminiEnrichSkeleton> {
  return legacy.geminiEnrichSkeleton(skeleton, normalizePlanningTransportMajority(input));
}

export function adjustItineraryTransferTimes(
  days: ItineraryDayPlan[],
  input: ActivityAiInput,
): ItineraryDayPlan[] {
  return legacy.adjustItineraryTransferTimes(days, normalizePlanningTransportMajority(input));
}
