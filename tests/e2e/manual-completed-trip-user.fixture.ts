export type CompletedTripUserFixture = {
  tripId: string;
  tripName: string;
  organizerUrl: string;
  participantUrl?: string;
};

/**
 * Contract for the manual completed-trip user test.
 *
 * The caller must provide a dedicated E2E trip whose dates are locked and whose
 * end date is already in the past. The participant URL, when supplied, must point
 * to the same dedicated trip for an account that joined through a valid invitation.
 * This helper performs no automatic DB writes and never bypasses auth or RLS.
 */
export function getCompletedTripUserFixtureFromEnv(): CompletedTripUserFixture {
  const organizerUrl = process.env.KREW_COMPLETED_TRIP_URL;
  if (!organizerUrl) {
    throw new Error(
      "KREW_COMPLETED_TRIP_URL is required for the manual completed-trip user test.",
    );
  }

  const match = organizerUrl.match(/\/trips\/([^/?#]+)/);
  return {
    tripId: match?.[1] ?? "manual-completed-trip",
    tripName: process.env.KREW_COMPLETED_TRIP_NAME ?? "E2E — Retour de voyage",
    organizerUrl,
    participantUrl: process.env.KREW_COMPLETED_TRIP_PARTICIPANT_URL || undefined,
  };
}
