/**
 * Fusion des candidats de découverte (règles locales + IA) — fonctions pures.
 *
 * Objectif Chantier 1 : ne plus limiter les propositions aux ~40 villes
 * codées en dur. Les deux sources sont TOUJOURS appelées puis fusionnées ici.
 */
import type { CandidateDestination, DestinationType } from "./destination-discovery.server";

/** Estimation compacte renvoyée par le LLM pour une ville hors catalogue. */
export type AiEstimate = {
  name: string;
  country?: string | undefined;
  affinity: number;
  reason: string;
  /** Coût journalier moyen €/pers estimé par le LLM. */
  dailyCost?: number | undefined;
  /** Distance approximative km depuis la ville de départ. */
  distanceKm?: number | undefined;
  /** 2-3 mois idéaux (1-12). */
  bestMonths?: number[] | undefined;
  region?: string | undefined;
  destinationType?: DestinationType | undefined;
  anchorPlaces?: string[] | undefined;
  candidateClass?: "strong_match" | "smart_compromise" | "gem" | undefined;
  matchedSignals?: string[] | undefined;
  compromiseFor?: string[] | undefined;
  confidence?: number | undefined;
  strongMatches?: string[] | undefined;
  groupsSatisfied?: string[] | undefined;
  starMatches?: string[] | undefined;
  potentialWeaknesses?: string[] | undefined;
  hardConstraintAssessment?: Record<string, string> | undefined;
};

export type MergedCandidate = {
  name: string;
  country?: string | undefined;
  affinity: number;
  reason: string;
  /** `catalog` = profil connu / table destinations, `ai_estimate` = ville estimée par le LLM. */
  source: "catalog" | "ai_estimate";
  dailyCost?: number | undefined;
  distanceKm?: number | undefined;
  bestMonths?: number[] | undefined;
  region?: string | undefined;
  destinationType?: DestinationType;
  anchorPlaces?: string[];
  verificationState?: "verified" | "estimated" | "unknown";
  provenance: Array<"local" | "gemini">;
  candidateClass?: "strong_match" | "smart_compromise" | "gem" | undefined;
  matchedSignals?: string[] | undefined;
  compromiseFor?: string[] | undefined;
  confidence?: number | undefined;
  strongMatches?: string[] | undefined;
  groupsSatisfied?: string[] | undefined;
  starMatches?: string[] | undefined;
  potentialWeaknesses?: string[] | undefined;
  hardConstraintAssessment?: Record<string, string> | undefined;
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
      source: "catalog",
      distanceKm: c.distanceKm,
      region: c.region,
      destinationType: c.destinationType ?? "city",
      anchorPlaces: c.anchorPlaces ?? [c.name],
      verificationState: "verified",
      provenance: ["local"],
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
        bestMonths: existing.bestMonths ?? c.bestMonths,
        dailyCost: existing.dailyCost ?? c.dailyCost,
        region: existing.region ?? c.region,
        anchorPlaces: existing.anchorPlaces?.length
          ? existing.anchorPlaces
          : (c.anchorPlaces ?? []),
        provenance: ["local", "gemini"],
        candidateClass: c.candidateClass,
        matchedSignals: c.matchedSignals,
        compromiseFor: c.compromiseFor,
        confidence: c.confidence,
        strongMatches: c.strongMatches,
        groupsSatisfied: c.groupsSatisfied,
        starMatches: c.starMatches,
        potentialWeaknesses: c.potentialWeaknesses,
        hardConstraintAssessment: c.hardConstraintAssessment,
      });
      continue;
    }
    byKey.set(key, {
      name: c.name,
      country: c.country,
      affinity: c.affinity,
      reason: c.reason,
      source: "ai_estimate",
      dailyCost: c.dailyCost,
      distanceKm: c.distanceKm,
      bestMonths: c.bestMonths,
      region: c.region,
      destinationType: c.destinationType ?? "city",
      anchorPlaces: c.anchorPlaces?.length ? c.anchorPlaces : [c.name],
      verificationState: "estimated",
      provenance: ["gemini"],
      candidateClass: c.candidateClass,
      matchedSignals: c.matchedSignals,
      compromiseFor: c.compromiseFor,
      confidence: c.confidence,
      strongMatches: c.strongMatches,
      groupsSatisfied: c.groupsSatisfied,
      starMatches: c.starMatches,
      potentialWeaknesses: c.potentialWeaknesses,
      hardConstraintAssessment: c.hardConstraintAssessment,
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
    avg_daily_cost: candidate.dailyCost ?? null,
    distance_from_paris_km: candidate.distanceKm ?? null,
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
