/**
 * Fusion des candidats de découverte (règles locales + IA) — fonctions pures.
 *
 * Objectif Chantier 1 : ne plus limiter les propositions aux ~40 villes
 * codées en dur. Les deux sources sont TOUJOURS appelées puis fusionnées ici.
 */
import type { CandidateDestination } from "./destination-discovery.server";

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
    });
  }

  return [...byKey.values()].sort((a, b) => b.affinity - a.affinity);
}

/** Valeurs par défaut raisonnables pour une ville estimée par le LLM. */
export const AI_ESTIMATE_DEFAULTS = {
  rating: 3.8,
  popularity: 0.5,
  ambianceScore: 0.5,
  dailyCost: 90,
  distanceKm: 1200,
} as const;

/** Ligne `destinations` prête à l'upsert, dérivée d'une estimation IA. */
export type AiDestinationRow = {
  slug: string;
  name: string;
  country: string;
  avg_daily_cost: number;
  distance_from_paris_km: number;
  best_months: number[];
  popularity: number;
  rating: number;
  score_fete: number;
  score_aventure: number;
  score_detente: number;
  score_luxe: number;
  score_insolite: number;
  score_sportif: number;
  score_culturel: number;
  source: "ai_estimate";
  external_id: string;
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
  ambianceHints: string[] = [],
  overrides: { bestMonths?: number[] | undefined } = {},
): AiDestinationRow {
  const slug = normCity(candidate.name).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const wanted = new Set(ambianceHints.map((a) => a.trim().toLowerCase()).filter(Boolean));
  const score = (key: string) =>
    wanted.has(key) ? 0.75 : AI_ESTIMATE_DEFAULTS.ambianceScore;
  const months = (overrides.bestMonths?.length ? overrides.bestMonths : candidate.bestMonths) ?? [];

  return {
    slug: slug || `ville-${Date.now()}`,
    name: candidate.name,
    country: candidate.country?.trim() || "Europe",
    avg_daily_cost:
      Number.isFinite(candidate.dailyCost) && Number(candidate.dailyCost) > 0
        ? Math.round(Number(candidate.dailyCost))
        : AI_ESTIMATE_DEFAULTS.dailyCost,
    distance_from_paris_km:
      Number.isFinite(candidate.distanceKm) && Number(candidate.distanceKm) > 0
        ? Math.round(Number(candidate.distanceKm))
        : AI_ESTIMATE_DEFAULTS.distanceKm,
    best_months: months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12),
    popularity: AI_ESTIMATE_DEFAULTS.popularity,
    rating: AI_ESTIMATE_DEFAULTS.rating,
    score_fete: score("fete"),
    score_aventure: score("aventure"),
    score_detente: score("detente"),
    score_luxe: score("luxe"),
    score_insolite: score("insolite"),
    score_sportif: score("sportif"),
    score_culturel: score("culturel"),
    source: "ai_estimate",
    external_id: `ai:${slug}`,
  };
}