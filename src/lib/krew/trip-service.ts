export * from "./trip-service-legacy";

import {
  aggregateParticipantPreferences as aggregateLegacyParticipantPreferences,
  getDestinationBriefContext as getLegacyDestinationBriefContext,
} from "./trip-service-legacy";

function softenAggregatedBudget<T extends Record<string, any>>(aggregated: T): T {
  return {
    ...aggregated,
    // Product rule: an individual participant budget can lower the score and
    // trigger a warning, but it must never remove a destination for the group.
    hasBudgetVeto: false,
    // Prevent downstream accommodation search from treating the lowest personal
    // budget as a hard provider-side ceiling. Keep vetoBudgetMax as an indicative
    // warning threshold for explanations where it is already consumed softly.
    minGroupBudget: null,
  };
}

export async function aggregateParticipantPreferences(
  ...args: Parameters<typeof aggregateLegacyParticipantPreferences>
): Promise<Awaited<ReturnType<typeof aggregateLegacyParticipantPreferences>>> {
  const aggregated = await aggregateLegacyParticipantPreferences(...args);
  return softenAggregatedBudget(aggregated);
}

export async function getDestinationBriefContext(
  ...args: Parameters<typeof getLegacyDestinationBriefContext>
): Promise<Awaited<ReturnType<typeof getLegacyDestinationBriefContext>>> {
  const context = await getLegacyDestinationBriefContext(...args);
  const aggregated = softenAggregatedBudget(context.aggregated as Record<string, any>);

  return {
    ...context,
    aggregated,
    scoringContext: {
      ...context.scoringContext,
      hasBudgetVeto: false,
      minGroupBudget: null,
    },
    discoveryInput: {
      ...context.discoveryInput,
      scoringSignals: {
        ...context.discoveryInput.scoringSignals,
        hardConstraints: {
          ...context.discoveryInput.scoringSignals.hardConstraints,
          hasBudgetVeto: false,
          vetoBudgetMax: null,
          minGroupBudget: null,
        },
      },
    },
  } as Awaited<ReturnType<typeof getLegacyDestinationBriefContext>>;
}
