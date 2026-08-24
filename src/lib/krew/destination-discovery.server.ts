export {
  listAreaProfilesForNames,
  listCityProfilesForNames,
} from "./destination-discovery-legacy.server";
export type {
  CandidateDestination,
  DestinationType,
} from "./destination-discovery-legacy.server";

import {
  discoverCandidateDestinations as discoverLegacyCandidates,
  type CandidateDestination,
  type DiscoveryInput as LegacyDiscoveryInput,
} from "./destination-discovery-legacy.server";
import { estimateDistanceKm } from "./deep-links";

export type DiscoveryInput = LegacyDiscoveryInput & {
  departureOrigins?: Array<{ origin?: string; city?: string; participants?: number; count?: number }>;
};

function effectiveDistance(
  candidate: CandidateDestination,
  input: DiscoveryInput,
): number {
  const origins = (input.departureOrigins ?? [])
    .map((origin) => ({
      city: String(origin.city ?? origin.origin ?? "").trim(),
      count: Number(origin.count ?? origin.participants ?? 0),
    }))
    .filter((origin) => origin.city && origin.count > 0);

  const fallbackOrigins = origins.length
    ? origins
    : input.departureCity?.trim()
      ? [{ city: input.departureCity.trim(), count: Math.max(1, input.participants || 1) }]
      : [];
  if (!fallbackOrigins.length) return candidate.distanceKm;

  const total = fallbackOrigins.reduce((sum, origin) => sum + origin.count, 0);
  const weighted = fallbackOrigins.reduce(
    (sum, origin) =>
      sum +
      estimateDistanceKm(origin.city, candidate.name, candidate.distanceKm) * origin.count,
    0,
  );
  return Math.round(weighted / Math.max(1, total));
}

/**
 * Candidate discovery uses real group departure origins when they are known.
 * The legacy catalogue distances are only used as fallback for city pairs not
 * represented by the local distance heuristic.
 */
export function discoverCandidateDestinations(
  input: DiscoveryInput,
  limit = 8,
): CandidateDestination[] {
  // Ask legacy discovery for the complete knowledge-base pool so a Paris-based
  // prefilter cannot discard a destination before the real origins are applied.
  const broadInput: LegacyDiscoveryInput = {
    ...input,
    maxDistanceKm: Math.max(input.maxDistanceKm, 3000),
  };
  const candidates = discoverLegacyCandidates(broadInput, 200);
  const broadDenominator = Math.max(400, broadInput.maxDistanceKm);
  const actualDenominator = Math.max(400, input.maxDistanceKm);

  return candidates
    .map((candidate) => {
      const distanceKm = effectiveDistance(candidate, input);
      let affinity = candidate.affinity;
      if (candidate.destinationType === "city") {
        const oldDistanceScore = Math.max(
          0.15,
          1 - candidate.distanceKm / broadDenominator,
        );
        const actualDistanceScore = Math.max(
          0.15,
          1 - distanceKm / actualDenominator,
        );
        affinity += (actualDistanceScore - oldDistanceScore) * 10;
      }
      return {
        ...candidate,
        distanceKm,
        affinity: Math.round(affinity * 10) / 10,
      };
    })
    .filter((candidate) => candidate.distanceKm <= input.maxDistanceKm * 1.2)
    .sort((a, b) => b.affinity - a.affinity)
    .slice(0, limit);
}
