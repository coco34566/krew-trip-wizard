/**
 * Fusion des candidats de découverte (règles locales + IA) — fonctions pures.
 *
 * Objectif Chantier 1 : ne plus limiter les propositions aux ~40 villes
 * codées en dur. Les deux sources sont TOUJOURS appelées puis fusionnées ici.
 */
import type { CandidateDestination, DestinationType } from "./destination-discovery.server";
import type { AiCandidate, BudgetFit, SeasonFit, TransportPlausibility } from "./destination-ai.server";

/** Candidate estimate coming from LLM or local discovery. */
export type AiEstimate = AiCandidate;

export type CandidateSource = "gemini" | "local" | "merged";

export type MergedCandidate = {
  name: string;
  country?: string | undefined;
  affinity: number;
  reason: string;
  why?: string | undefined;
  source: CandidateSource;
  budgetFit?: BudgetFit | undefined;
  budgetReason?: string | undefined;
  transport?: Record<
    string,
    {
      plausibleModes: string[];
      plausibility: TransportPlausibility;
    }
  > | undefined;
  activityFit?: string[] | undefined;
  environmentFit?: string[] | undefined;
  accommodationFit?: string[] | undefined;
  seasonFit?: SeasonFit | undefined;
  dailyCost?: number | undefined;
  distanceKm?: number | undefined;
  bestMonths?: number[] | undefined;
  region?: string | null | undefined;
  destinationType?: DestinationType;
  anchorPlaces?: string[];
  verificationState?: "verified" | "estimated" | "unknown";
};

/** Normalisation de nom de ville (identique à `norm()` de la découverte locale). */
export function normCity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Fusionne les candidats règles + IA, dédupliqués par nom normalisé.
 * La source `catalog` gagne en cas de doublon (données réelles), mais on
 * conserve l'affinité la plus élevée des deux.
 */
export function mergeCandidates(
  ruleBased: CandidateDestination[],
  aiBased: AiEstimate[],
): MergedCandidate[] {
  const byKey = new Map<string, MergedCandidate>();

  for (const c of ruleBased) {
    const key = normCity(c.name);
    if (!key) continue;
    byKey.set(key, {
      name: c.name,
      country: c.country,
      affinity: c.affinity,
      reason: c.reason,
      why: c.reason,
      source: "local",
      distanceKm: c.distanceKm,
      region: c.region ?? null,
      destinationType: c.destinationType ?? "city",
      anchorPlaces: c.anchorPlaces ?? [c.name],
      verificationState: "verified",
    });
  }

  for (const c of aiBased) {
    const key = normCity(c.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        affinity: Math.max(existing.affinity, c.affinity),
        reason: existing.reason,
        why: c.why || existing.why || c.reason,
        source: "merged",
        bestMonths: existing.bestMonths ?? c.bestMonths,
        dailyCost: existing.dailyCost ?? c.dailyCost,
        region: existing.region ?? c.region ?? null,
        anchorPlaces: existing.anchorPlaces?.length
          ? existing.anchorPlaces
          : (c.anchorPlaces ?? []),
        budgetFit: c.budgetFit ?? existing.budgetFit,
        budgetReason: c.budgetReason ?? existing.budgetReason,
        transport: c.transport ?? existing.transport,
        activityFit: c.activityFit ?? existing.activityFit,
        environmentFit: c.environmentFit ?? existing.environmentFit,
        accommodationFit: c.accommodationFit ?? existing.accommodationFit,
        seasonFit: c.seasonFit ?? existing.seasonFit,
      });
      continue;
    }
    byKey.set(key, {
      name: c.name,
      country: c.country,
      affinity: c.affinity,
      reason: c.reason,
      why: c.why || c.reason,
      source: "gemini",
      dailyCost: c.dailyCost,
      distanceKm: c.distanceKm,
      bestMonths: c.bestMonths,
      region: c.region ?? null,
      destinationType: c.destinationType ?? "city",
      anchorPlaces: c.anchorPlaces?.length ? c.anchorPlaces : [c.name],
      verificationState: "estimated",
      budgetFit: c.budgetFit,
      budgetReason: c.budgetReason,
      transport: c.transport,
      activityFit: c.activityFit,
      environmentFit: c.environmentFit,
      accommodationFit: c.accommodationFit,
      seasonFit: c.seasonFit,
    });
  }

  return [...byKey.values()].sort((a, b) => b.affinity - a.affinity);
}

/** Ligne `destinations` prête à l'upsert, dérivée d'une estimation IA. */
export type AiDestinationRow = {
  slug: string;
  name: string;
  country: string;
  avg_daily_cost: number | null;
  distance_from_paris_km: number | null;
  best_months: number[];
  popularity: null;
  rating: null;
  score_fete: null;
  score_aventure: null;
  score_detente: null;
  score_luxe: null;
  score_insolite: null;
  score_sportif: null;
  score_culturel: null;
  source: "ai_estimate";
  external_id: string;
  destination_type: DestinationType;
  region_name: string | null;
  anchor_places: string[];
  verification_state: "estimated" | "unknown";
};

/**
 * Transforme une ville estimée par l'IA en ligne catalogue exploitable par
 * `engine.ts` (fonction pure, aucune I/O).
 *
 * @param ambianceHints ambiances demandées par le groupe : on les valorise
 *   légèrement puisque le LLM a proposé la ville pour ces ambiances.
 */
export function aiCandidateToDestinationRow(
  candidate: MergedCandidate,
  _ambianceHints: string[] = [],
  overrides: { bestMonths?: number[] | undefined } = {},
): AiDestinationRow {
  const slug = normCity(candidate.name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const months = (overrides.bestMonths?.length ? overrides.bestMonths : candidate.bestMonths) ?? [];

  return {
    slug: slug || `ville-${Date.now()}`,
    name: candidate.name,
    country: candidate.country?.trim() || "Europe",
    avg_daily_cost: null,
    distance_from_paris_km: null,
    best_months: months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    popularity: null,
    rating: null,
    score_fete: null,
    score_aventure: null,
    score_detente: null,
    score_luxe: null,
    score_insolite: null,
    score_sportif: null,
    score_culturel: null,
    source: "ai_estimate",
    external_id: `ai:${slug}`,
    destination_type: candidate.destinationType ?? "city",
    region_name: candidate.region ?? null,
    anchor_places: candidate.anchorPlaces ?? [candidate.name],
    verification_state: candidate.verificationState === "estimated" ? "estimated" : "unknown",
  };
}
