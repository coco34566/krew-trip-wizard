export const MIN_LEARNING_TRIPS = 20;
export const MIN_POSITIVE_LEARNING_TRIPS = 8;

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** QA, E2E, demo and explicit test trips must never train production scoring. */
export function isLearningExcludedTripName(name: unknown): boolean {
  const normalized = normalize(name);
  if (!normalized) return false;
  // TEST16 / Test15 are common QA names too: allow digits immediately after "test".
  return /(^|[^a-z0-9])(test(?=\d|[^a-z0-9]|$)|qa(?=[^a-z0-9]|$)|e2e(?=[^a-z0-9]|$)|playwright(?=[^a-z0-9]|$)|golden path(?=[^a-z0-9]|$)|demo(?=[^a-z0-9]|$))/i.test(normalized);
}

export function filterEligibleScoringFeedback<TRow extends { trip_id?: string | null }>(
  rows: TRow[],
  trips: Array<{ id: string; name?: string | null }>,
): TRow[] {
  const excludedTripIds = new Set(
    trips.filter((trip) => isLearningExcludedTripName(trip.name)).map((trip) => trip.id),
  );
  return rows.filter((row) => Boolean(row.trip_id) && !excludedTripIds.has(String(row.trip_id)));
}

export function hasEnoughLearningSignal(
  rows: Array<{ trip_id?: string | null; was_selected?: boolean | null; recommendation_id?: string | null }>,
  reactionsMap: Map<string, { likes: number; dislikes: number }>,
): boolean {
  const tripIds = new Set(rows.map((row) => row.trip_id).filter(Boolean));
  if (tripIds.size < MIN_LEARNING_TRIPS) return false;

  const positiveTripIds = new Set(
    rows
      .filter((row) => {
        if (row.was_selected) return true;
        const reaction = row.recommendation_id
          ? reactionsMap.get(String(row.recommendation_id))
          : null;
        return Boolean(reaction && reaction.likes > reaction.dislikes);
      })
      .map((row) => row.trip_id)
      .filter(Boolean),
  );
  return positiveTripIds.size >= MIN_POSITIVE_LEARNING_TRIPS;
}
