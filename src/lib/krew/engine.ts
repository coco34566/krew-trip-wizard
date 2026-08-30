export * from "./engine-legacy";

import {
  buildProposals as buildLegacyProposals,
  generateRejectionReason,
  type Proposal,
  type ScoringContext,
  type TravelCatalog,
} from "./engine-legacy";
import { estimateDistanceKm } from "./deep-links";

/**
 * Distance de scoring depuis les vraies villes de départ du groupe.
 * On utilise une moyenne pondérée par le nombre de voyageurs. Si une paire de
 * villes n'est pas connue par l'heuristique locale, estimateDistanceKm conserve
 * le fallback historique plutôt que d'inventer une distance.
 */
export function estimateGroupOriginDistanceKm(
  destinationName: string,
  fallbackDistanceKm: number,
  origins: ScoringContext["departureOrigins"],
): number {
  const validOrigins = (origins ?? []).filter(
    (origin) => origin.city?.trim() && Number(origin.count) > 0,
  );
  if (!validOrigins.length) return fallbackDistanceKm;

  const totalTravellers = validOrigins.reduce((sum, origin) => sum + Number(origin.count), 0);
  if (totalTravellers <= 0) return fallbackDistanceKm;

  const weighted = validOrigins.reduce((sum, origin) => {
    const distance = estimateDistanceKm(
      origin.city,
      destinationName,
      fallbackDistanceKm,
    );
    return sum + distance * Number(origin.count);
  }, 0);
  return Math.round(weighted / totalTravellers);
}

function restoreSoftBudgetSemantics(proposal: Proposal, ctx: ScoringContext): Proposal {
  const hardCap = ctx.vetoBudgetMax ?? ctx.minGroupBudget ?? null;
  if (!ctx.hasBudgetVeto || hardCap == null) return proposal;

  const overBudget = proposal.budget.totalPerPerson > hardCap;
  if (!overBudget) return proposal;

  const genericBudgetReasonIndex = proposal.matchReasons.findIndex((reason) =>
    reason.startsWith("Hors budget du plus serré"),
  );
  const warning = `⚠️ Risque de dépasser le budget maximum indiqué par un participant (${hardCap} €) — total estimé ~${Math.round(proposal.budget.totalPerPerson)} €`;
  const matchReasons = [...proposal.matchReasons];
  if (genericBudgetReasonIndex >= 0) matchReasons[genericBudgetReasonIndex] = warning;
  else matchReasons.push(warning);

  // `engine-legacy` applies -15 when hasBudgetVeto=false. The validated KREW
  // behavior keeps the historical strong -40 penalty while removing only the
  // group-level elimination, so restore the missing -25 here.
  return {
    ...proposal,
    score: proposal.score - 25,
    matchReasons,
  };
}

/**
 * Public KREW recommendation entry point.
 *
 * Product invariants applied around the historical deterministic scorer:
 * - an individual participant budget is a strong preference/warning, never a group veto;
 * - the historical strong budget penalty is preserved;
 * - distance heuristics use the group's actual departure origins when known.
 *
 * All other scoring rules, including transport compatibility and hard
 * deal-breakers, remain unchanged.
 */
export function buildProposals(
  catalog: TravelCatalog,
  ctx: ScoringContext,
  limit = 3,
): Proposal[] {
  const originalDestinations = new Map(
    catalog.destinations.map((destination) => [destination.id, destination]),
  );
  const adjustedCatalog: TravelCatalog = {
    ...catalog,
    destinations: catalog.destinations.map((destination) => ({
      ...destination,
      distance_from_paris_km: estimateGroupOriginDistanceKm(
        destination.name,
        destination.distance_from_paris_km,
        ctx.departureOrigins,
      ),
    })),
  };

  // Disable only the legacy hard `continue`. Keep vetoBudgetMax and individual
  // priorities so hardBudgetFits, individual satisfaction and warning threshold
  // are still computed. Ask legacy for the whole eligible pool, then restore the
  // historical -40 penalty before selecting the final top N.
  const scoringContext: ScoringContext = { ...ctx, hasBudgetVeto: false };
  const fullPool = buildLegacyProposals(
    adjustedCatalog,
    scoringContext,
    Math.max(limit + 3, adjustedCatalog.destinations.length),
  )
    .map((proposal) => restoreSoftBudgetSemantics(proposal, ctx))
    .sort((a, b) => b.score - a.score);

  const selected = fullPool.slice(0, limit).map((proposal) => ({
    ...proposal,
    destination: originalDestinations.get(proposal.destination.id) ?? proposal.destination,
  })) as Proposal[];

  const selectedIds = new Set(selected.map((proposal) => proposal.destination.id));
  (selected as any).runnerUps = fullPool
    .filter((proposal) => !selectedIds.has(proposal.destination.id))
    .slice(0, 3)
    .map((proposal) => ({
      name: proposal.destination.name,
      reason: generateRejectionReason(proposal),
    }));

  return selected;
}
