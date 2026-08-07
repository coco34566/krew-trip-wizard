/**
 * Adaptateurs entre les lignes de la base et le moteur de recommandation.
 * Isolé des fichiers `*.functions.ts` (qui doivent rester de simples wrappers).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildProposals, type Proposal, type ScoringContext } from "./engine";
import { loadTravelCatalog } from "./providers.server";

export const tripInputSchema = z.object({
  name: z.string().min(2).max(120),
  eventType: z.enum(["evg", "evjf", "anniversaire", "weekend", "voyage_groupe"]),
  celebratedPerson: z.string().max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  participants: z.number().int().min(2).max(80),
  budgetPerPerson: z.number().min(50).max(20000),
  departureCity: z.string().min(2).max(80),
  averageAge: z.number().int().min(16).max(99).optional(),
  relation: z.string().max(120).optional(),
  ambiances: z.array(z.string()).default([]),
  activityCategories: z.array(z.string()).default([]),
  desiredDestination: z.string().max(120).optional(),
  letKrewDecide: z.boolean().default(true),
  maxDistanceKm: z.number().int().min(100).max(15000).default(2000),
  excludedCountries: z.array(z.string()).default([]),
  durationNights: z.number().int().min(1).max(21).default(2),
  maxBudget: z.number().optional(),
  needsCityCenter: z.boolean().default(true),
  mobilityNotes: z.string().max(500).optional(),
  dietaryConstraints: z.array(z.string()).default([]),
  availabilityNotes: z.string().max(500).optional(),
});

export type TripInput = z.infer<typeof tripInputSchema>;

type TripRow = {
  participants_count: number;
  budget_per_person: number;
  start_date: string | null;
};

type PreferencesRow = {
  ambiances: string[] | null;
  activity_categories: string[] | null;
  max_distance_km: number | null;
  excluded_countries: string[] | null;
  desired_destination: string | null;
  let_krew_decide: boolean | null;
  duration_nights: number | null;
  needs_city_center: boolean | null;
  max_budget: number | null;
} | null;

export function buildScoringContext(trip: TripRow, prefs: PreferencesRow): ScoringContext {
  const startMonth = trip.start_date ? new Date(trip.start_date).getMonth() + 1 : new Date().getMonth() + 1;
  return {
    participants: trip.participants_count,
    budgetPerPerson: Number(prefs?.max_budget ?? trip.budget_per_person),
    nights: prefs?.duration_nights ?? 2,
    ambiances: prefs?.ambiances ?? [],
    activityCategories: prefs?.activity_categories ?? [],
    maxDistanceKm: prefs?.max_distance_km ?? 2000,
    excludedCountries: prefs?.excluded_countries ?? [],
    desiredDestination: prefs?.desired_destination ?? null,
    letKrewDecide: prefs?.let_krew_decide ?? true,
    needsCityCenter: prefs?.needs_city_center ?? true,
    startMonth,
  };
}

export function serializeProposal(tripId: string, proposal: Proposal) {
  return {
    trip_id: tripId,
    destination_id: proposal.destination.id,
    accommodation_id: proposal.accommodation?.id ?? null,
    score: proposal.score,
    rationale: proposal.rationale,
    match_reasons: proposal.matchReasons,
    itinerary: JSON.parse(JSON.stringify(proposal.itinerary)),
    budget: JSON.parse(JSON.stringify(proposal.budget)),
    activity_ids: proposal.activities.map((a) => a.id),
  };
}
/** Réponse individuelle au questionnaire (colonnes de `trip_participant_preferences`). */
type ParticipantPrefRow = {
  ambiances: string[] | null;
  activity_categories: string[] | null;
  budget_max: number | string | null;
  date_flex_days: number | null;
  required_amenities: string[] | null;
  min_accommodation_rating: number | string | null;
  travel_pace: string | null;
  duration_nights_min: number | null;
  duration_nights_max: number | null;
  desired_destination: string | null;
};

function frequencies(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Agrège les questionnaires individuels d'un voyage en un profil de groupe
 * exploitable par le moteur de scoring.
 */
export async function aggregateParticipantPreferences(
  supabase: { from: (table: string) => any },
  tripId: string,
) {
  const res = await supabase
    .from("trip_participant_preferences")
    .select(
      "ambiances, activity_categories, budget_max, date_flex_days, required_amenities, min_accommodation_rating, travel_pace, duration_nights_min, duration_nights_max, desired_destination",
    )
    .eq("trip_id", tripId);
  if (res.error) throw res.error;

  const rows = (res.data ?? []) as ParticipantPrefRow[];
  const ambianceFrequencies = frequencies(rows.flatMap((r) => r.ambiances ?? []));
  const activityCategoryFrequencies = frequencies(rows.flatMap((r) => r.activity_categories ?? []));
  const budgets = rows.map((r) => Number(r.budget_max ?? 0)).filter((n) => n > 0);
  const ratings = rows.map((r) => Number(r.min_accommodation_rating ?? 0)).filter((n) => n > 0);
  const flex = rows.map((r) => Number(r.date_flex_days ?? 0)).filter((n) => n >= 0);
  const paces = rows.map((r) => r.travel_pace).filter((p): p is string => Boolean(p));
  const paceFreq = frequencies(paces);
  const destinations = rows
    .map((r) => r.desired_destination?.trim())
    .filter((d): d is string => Boolean(d));
  const destinationFrequencies = frequencies(destinations);

  const byFrequency = (freq: Record<string, number>) =>
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

  return {
    participantsCount: rows.length,
    ambianceFrequencies,
    activityCategoryFrequencies,
    ambiances: byFrequency(ambianceFrequencies).slice(0, 4),
    activityCategories: byFrequency(activityCategoryFrequencies),
    /** Budget du groupe : le plus contraignant raisonnable (médiane basse). */
    aggregatedBudget: budgets.length ? Math.round(median(budgets) as number) : null,
    minAccommodationRating: ratings.length ? Math.max(...ratings) : null,
    requiredAmenities: Array.from(new Set(rows.flatMap((r) => r.required_amenities ?? []))),
    medianTravelPace: byFrequency(paceFreq)[0] ?? null,
    dateFlexDays: flex.length ? Math.min(...flex) : null,
    /** Destination la plus citée parmi les réponses individuelles (mode). */
    desiredDestination: byFrequency(destinationFrequencies)[0] ?? null,
  };
}

/**
 * Résout la destination souhaitée d'un voyage :
 * 1. celle saisie par l'organisateur à la création (`trip_preferences`) ;
 * 2. sinon, la plus citée dans les questionnaires individuels des participants.
 * Renvoie `null` si personne n'a exprimé de destination précise (le groupe
 * laisse Krew décider).
 */
export async function resolveDesiredDestination(
  supabase: { from: (table: string) => any },
  tripId: string,
): Promise<string | null> {
  const prefsRes = await supabase
    .from("trip_preferences")
    .select("desired_destination")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (prefsRes.error) throw prefsRes.error;
  if (prefsRes.data?.desired_destination) return prefsRes.data.desired_destination as string;

  const aggregated = await aggregateParticipantPreferences(supabase, tripId);
  return aggregated.desiredDestination;
}

export async function generateRecommendationsForTrip(
  supabase: SupabaseClient,
  tripId: string,
) {
  const [trip, preferences] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("trip_preferences").select("*").eq("trip_id", tripId).maybeSingle(),
  ]);
  if (trip.error) throw trip.error;

  const aggregated = await aggregateParticipantPreferences(supabase, tripId);
  const resolvedDestination = preferences.data?.desired_destination || aggregated.desiredDestination || null;

  // Si le groupe vise une destination précise, on rafraîchit d'abord le
  // catalogue (hôtels Booking/Hotels.com/Kayak + activités réelles) avant de
  // scorer, pour que les suggestions ne restent pas sur les données de seed.
  const providerErrors: string[] = [];
  if (resolvedDestination) {
    try {
      const { refreshExternalCatalogForTrip } = await import("@/lib/external/search-hotels.functions");
      const externalRes = await refreshExternalCatalogForTrip(supabase, tripId, resolvedDestination);
      if (externalRes.providerErrors?.length) providerErrors.push(...externalRes.providerErrors);
    } catch (e) {
      providerErrors.push(`recherche externe: ${String(e).slice(0, 200)}`);
    }
  }

  let prefsToUse = preferences.data ?? null;
  if (aggregated.participantsCount && aggregated.participantsCount > 0) {
    prefsToUse = {
      ...preferences.data,
      ambiances: aggregated.ambiances.length ? aggregated.ambiances : preferences.data?.ambiances ?? [],
      activity_categories: aggregated.activityCategories.length
        ? aggregated.activityCategories
        : preferences.data?.activity_categories ?? [],
      ambiance_frequencies: aggregated.ambianceFrequencies,
      activity_category_frequencies: aggregated.activityCategoryFrequencies,
      max_budget: aggregated.aggregatedBudget ?? preferences.data?.max_budget ?? trip.data.budget_per_person,
      duration_nights: preferences.data?.duration_nights ?? trip.data.duration_nights ?? 2,
      required_amenities: aggregated.requiredAmenities,
      min_accommodation_rating: aggregated.minAccommodationRating,
      travel_pace: aggregated.medianTravelPace,
    } as any;
  }
  // La destination résolue (organisateur ou vote des participants) prime
  // toujours sur celle de `trip_preferences` seule, et active le filtre de
  // scoring correspondant même si `let_krew_decide` n'a pas été décoché.
  if (resolvedDestination) {
    prefsToUse = {
      ...prefsToUse,
      desired_destination: resolvedDestination,
      let_krew_decide: false,
    } as any;
  }

  const ctx = buildScoringContext(trip.data, prefsToUse);
  const catalog = await loadTravelCatalog(supabase, {
    maxDistanceKm: ctx.maxDistanceKm,
    excludedCountries: ctx.excludedCountries,
    participants: ctx.participants,
    nights: ctx.nights,
    startDate: trip.data.start_date,
    dateFlexDays: aggregated.dateFlexDays ?? undefined,
    requiredAmenities: aggregated.requiredAmenities ?? undefined,
    minAccommodationRating: aggregated.minAccommodationRating ?? undefined,
  });
  const proposals = buildProposals(catalog, ctx, 3);

  const deleted = await supabase.from("recommendations").delete().eq("trip_id", tripId);
  if (deleted.error) throw deleted.error;

  const rows = proposals.map((p) => serializeProposal(tripId, p));
  if (rows.length) {
    const inserted = await supabase.from("recommendations").insert(rows);
    if (inserted.error) throw inserted.error;
  }

  const updated = await supabase.from("trips").update({ status: "propositions" }).eq("id", tripId);
  if (updated.error) throw updated.error;

  return { count: rows.length, providerErrors };
}
