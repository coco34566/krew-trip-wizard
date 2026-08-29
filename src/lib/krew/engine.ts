export * from "./engine-legacy";

import {
  buildProposals as buildLegacyProposals,
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

function resolveHardBudgetCap(ctx: ScoringContext): number | null {
  const caps: number[] = [];

  if (ctx.hasBudgetVeto && Number(ctx.vetoBudgetMax) > 0) {
    caps.push(Number(ctx.vetoBudgetMax));
  }

  for (const preference of ctx.individualPreferences ?? []) {
    const priority = String(preference.budgetPriority ?? "").toLowerCase().trim();
    if (!["must_have", "veto", "high_priority"].includes(priority)) continue;
    const budgetMax = Number(preference.budgetMax);
    if (budgetMax > 0) caps.push(budgetMax);
  }

  return caps.length ? Math.min(...caps) : null;
}

function canProveHardBudgetExceeded(proposal: Proposal): boolean {
  // Property-web prices are discovery hints, not booking-provider quotes. Even
  // when the page reports a price, KREW must not turn that hint into a hard veto.
  // Other catalogue sources keep the historical hard-budget behaviour.
  return proposal.budget.priceSource?.accommodation !== "web";
}

/**
 * Public KREW recommendation entry point.
 *
 * Product invariants applied here before/after the historical deterministic scorer:
 * - hard budget vetoes stay hard when explicitly configured and sufficiently sourced;
 * - distance heuristics use the group's actual departure origins when known.
 *
 * All other scoring rules, including age, transport compatibility and hard
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

  const hardBudgetCap = resolveHardBudgetCap(ctx);
  const proposals = buildLegacyProposals(adjustedCatalog, ctx, limit);
  const keepWithinHardBudget = (proposal: Proposal) =>
    hardBudgetCap == null ||
    !canProveHardBudgetExceeded(proposal) ||
    proposal.budget.totalPerPerson <= hardBudgetCap;
  const eligibleProposals = proposals.filter(keepWithinHardBudget);

  const restored = eligibleProposals.map((proposal) => ({
    ...proposal,
    destination: originalDestinations.get(proposal.destination.id) ?? proposal.destination,
  })) as Proposal[];
  const runnerUps = ((proposals as any).runnerUps ?? []) as Proposal[];
  (restored as any).runnerUps = runnerUps.filter(keepWithinHardBudget);
  return restored;
}
