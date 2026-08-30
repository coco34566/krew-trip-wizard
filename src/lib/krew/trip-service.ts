export * from "./trip-service-legacy";

import {
  aggregateParticipantPreferences as aggregateLegacyParticipantPreferences,
  getDestinationBriefContext as getLegacyDestinationBriefContext,
} from "./trip-service-legacy";

function softenDiscoveryBudget<T extends Record<string, any>>(aggregated: T): T {
  return {
    ...aggregated,
    // External discovery/provider queries must not treat one participant's
    // personal ceiling as a group-level hard filter.
    hasBudgetVeto: false,
    minGroupBudget: null,
  };
}

export async function aggregateParticipantPreferences(
  ...args: Parameters<typeof aggregateLegacyParticipantPreferences>
): Promise<Awaited<ReturnType<typeof aggregateLegacyParticipantPreferences>>> {
  const aggregated = await aggregateLegacyParticipantPreferences(...args);
  return softenDiscoveryBudget(aggregated);
}

export async function getDestinationBriefContext(
  ...args: Parameters<typeof getLegacyDestinationBriefContext>
): Promise<Awaited<ReturnType<typeof getLegacyDestinationBriefContext>>> {
  const context = await getLegacyDestinationBriefContext(...args);

  return {
    ...context,
    // Preserve the original aggregated/scoring budget signal so the final
    // recommender can apply the strong penalty and explicit warning.
    aggregated: context.aggregated,
    scoringContext: context.scoringContext,
    // Only discovery constraints are softened: a provider/LLM must not discard
    // a destination before KREW has a chance to score and explain it.
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
