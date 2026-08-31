export * from "./trip-service-legacy";

import {
  aggregateParticipantPreferences as aggregateLegacyParticipantPreferences,
  assessGenerationReadiness as assessLegacyGenerationReadiness,
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

/**
 * Once dates are locked and the trip profile has already been validated, the
 * response phase is closed. A participant joining later must not make an
 * already-approved trip become non-generatable because the denominator grew.
 *
 * We deliberately keep the legacy readiness calculation for pre-validation
 * trips: locking dates alone must never bypass the minimum questionnaire signal.
 */
export async function assessGenerationReadiness(
  ...args: Parameters<typeof assessLegacyGenerationReadiness>
): Promise<Awaited<ReturnType<typeof assessLegacyGenerationReadiness>>> {
  const readiness = await assessLegacyGenerationReadiness(...args);
  const responsePhaseClosed = Boolean(
    readiness.quality?.datesLocked && readiness.profile?.validated,
  );

  if (!responsePhaseClosed) return readiness;

  return {
    ...readiness,
    canGenerate: true,
    message: undefined,
    checklist: {
      ...readiness.checklist,
      prefsOk: true,
    },
    profile: {
      ...readiness.profile,
      questionnairesReady: true,
    },
  };
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
