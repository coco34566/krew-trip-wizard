/**
 * Adaptateurs entre les lignes de la base et le moteur de recommandation.
 * Isolé des fichiers `*.functions.ts` (qui doivent rester de simples wrappers).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildProposals, type Proposal, type ScoringContext } from "./engine";
import { loadTravelCatalog } from "./providers.server";
import { discoverCandidateDestinations } from "./destination-discovery.server";

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
  const startMonth = trip.start_date
    ? new Date(trip.start_date).getMonth() + 1
    : new Date().getMonth() + 1;
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
  return sorted.length % 2
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
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
    aggregatedBudget: budgets.length ? Math.round(median(budgets) as number) : null,
    minAccommodationRating: ratings.length ? Math.max(...ratings) : null,
    requiredAmenities: Array.from(new Set(rows.flatMap((r) => r.required_amenities ?? []))),
    medianTravelPace: byFrequency(paceFreq)[0] ?? null,
    dateFlexDays: flex.length ? Math.min(...flex) : null,
    desiredDestination: byFrequency(destinationFrequencies)[0] ?? null,
  };
}

/**
 * Résout la destination souhaitée :
 * 1. trip_preferences (organisateur)
 * 2. recommandation validée (is_selected)
 * 3. mode des questionnaires participants
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

  const selectedRes = await supabase
    .from("recommendations")
    .select("destinations(name)")
    .eq("trip_id", tripId)
    .eq("is_selected", true)
    .maybeSingle();
  if (selectedRes.error) throw selectedRes.error;
  const selectedName = (selectedRes.data as any)?.destinations?.name;
  if (typeof selectedName === "string" && selectedName.trim()) return selectedName.trim();

  const aggregated = await aggregateParticipantPreferences(supabase, tripId);
  return aggregated.desiredDestination;
}

/** Enrichit le catalogue via les APIs pour une liste de destinations (max 5). */
async function enrichCatalogWithExternalApis(
  supabase: SupabaseClient,
  tripId: string,
  destinationNames: string[],
): Promise<string[]> {
  if (!destinationNames.length) return [];

  const { refreshExternalCatalogForTrip } = await import("@/lib/external/search-hotels.functions");
  const providerErrors: string[] = [];

  for (const destName of destinationNames.slice(0, 5)) {
    try {
      const externalRes = await refreshExternalCatalogForTrip(supabase, tripId, destName);
      if (externalRes.providerErrors?.length) {
        providerErrors.push(...externalRes.providerErrors.map((e) => `${destName}: ${e}`));
      }
    } catch (e) {
      providerErrors.push(`${destName}: ${String(e).slice(0, 200)}`);
    }
  }

  return providerErrors;
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
  const resolvedDestination =
    preferences.data?.desired_destination || aggregated.desiredDestination || null;

  let prefsToUse = preferences.data ?? null;
  if (aggregated.participantsCount && aggregated.participantsCount > 0) {
    prefsToUse = {
      ...preferences.data,
      ambiances: aggregated.ambiances.length
        ? aggregated.ambiances
        : preferences.data?.ambiances ?? [],
      activity_categories: aggregated.activityCategories.length
        ? aggregated.activityCategories
        : preferences.data?.activity_categories ?? [],
      max_budget:
        aggregated.aggregatedBudget ??
        preferences.data?.max_budget ??
        trip.data.budget_per_person,
      duration_nights: preferences.data?.duration_nights ?? trip.data.duration_nights ?? 2,
      required_amenities: aggregated.requiredAmenities,
      min_accommodation_rating: aggregated.minAccommodationRating,
      travel_pace: aggregated.medianTravelPace,
    } as any;
  }

  if (resolvedDestination) {
    prefsToUse = {
      ...prefsToUse,
      desired_destination: resolvedDestination,
      let_krew_decide: false,
    } as any;
  }

  const ctx = buildScoringContext(trip.data, prefsToUse);
  const catalogQuery = {
    maxDistanceKm: ctx.maxDistanceKm,
    excludedCountries: ctx.excludedCountries,
    participants: ctx.participants,
    nights: ctx.nights,
    startDate: trip.data.start_date as string | null,
    dateFlexDays: aggregated.dateFlexDays ?? undefined,
    requiredAmenities: aggregated.requiredAmenities ?? undefined,
    minAccommodationRating: aggregated.minAccommodationRating ?? undefined,
  };

  // 1) Shortlist dynamique : destination forcée OU découverte par critères (plus de seed)
  let shortlistNames: string[];
  if (resolvedDestination) {
    shortlistNames = [resolvedDestination];
  } else {
    const candidates = discoverCandidateDestinations(
      {
        ambiances: ctx.ambiances,
        activityCategories: ctx.activityCategories,
        budgetPerPerson: ctx.budgetPerPerson,
        maxDistanceKm: ctx.maxDistanceKm,
        nights: ctx.nights,
        startMonth: ctx.startMonth,
        excludedCountries: ctx.excludedCountries,
        departureCity: (trip.data.departure_city as string) || "Paris",
        participants: ctx.participants,
        eventType: (trip.data.event_type as string) || undefined,
      },
      6,
    );
    shortlistNames = candidates.map((c) => c.name);
    // Fallback de sécurité si aucun candidat (critères trop stricts)
    if (!shortlistNames.length) {
      shortlistNames = ["Barcelone", "Budapest", "Lisbonne"];
    }
  }

  // 2) APIs logements + activités (Booking, TripAdvisor, …) pour chaque candidate
  const providerErrors = await enrichCatalogWithExternalApis(supabase, tripId, shortlistNames);

  // 3) Catalogue enrichi
  const catalog = await loadTravelCatalog(supabase, catalogQuery);

  // Préférer les logements venant des APIs (source rapidapi)
  const apiAccIds = new Set(
    (catalog.accommodations as any[])
      .filter((a) => a.source === "rapidapi" || a.booking_url || a.best_provider)
      .map((a) => a.id),
  );

  let catalogFinal = catalog;
  if (apiAccIds.size > 0) {
    const apiAccommodations = catalog.accommodations.filter((a) => apiAccIds.has(a.id));
    const destWithApi = new Set(apiAccommodations.map((a) => a.destination_id));
    catalogFinal = {
      destinations: catalog.destinations.filter((d) => destWithApi.has(d.id)),
      activities: catalog.activities,
      accommodations: apiAccommodations,
    };
  }

  // 4) Transport Kayak par destination
  const transportByDestinationId: Record<string, number> = {};
  try {
    const { searchTransportRoundTrip } = await import("@/integrations/external/transport.server");
    const originCity = (trip.data.departure_city as string) || "Paris";

    let checkin = (trip.data.start_date as string | null) ?? null;
    let checkout = (trip.data.end_date as string | null) ?? null;
    if (!checkin) {
      const d = new Date();
      d.setDate(d.getDate() + 21);
      checkin = d.toISOString().slice(0, 10);
    }
    if (!checkout) {
      const d = new Date(checkin);
      d.setDate(d.getDate() + (ctx.nights || 2));
      checkout = d.toISOString().slice(0, 10);
    }

    for (const dest of catalogFinal.destinations.slice(0, 5)) {
      try {
        const quote = await searchTransportRoundTrip({
          originCity,
          destinationCity: dest.name,
          departDate: checkin,
          returnDate: checkout,
          adults: Math.min(ctx.participants, 9),
          distanceKm: dest.distance_from_paris_km,
        });
        transportByDestinationId[dest.id] = quote.pricePerPerson;
        if (quote.rawError) {
          providerErrors.push(`transport ${dest.name}: ${quote.rawError}`);
        }
      } catch (e) {
        providerErrors.push(`transport ${dest.name}: ${String(e).slice(0, 150)}`);
      }
    }
  } catch (e) {
    providerErrors.push(`transport module: ${String(e).slice(0, 150)}`);
  }

  const ctxWithTransport: ScoringContext = {
    ...ctx,
    transportByDestinationId,
  };

  // 5) Scoring final → top 3
  const proposals = buildProposals(catalogFinal, ctxWithTransport, 3);

  const deleted = await supabase.from("recommendations").delete().eq("trip_id", tripId);
  if (deleted.error) throw deleted.error;

  const rows = proposals.map((p) => serializeProposal(tripId, p));
  if (rows.length) {
    const inserted = await supabase.from("recommendations").insert(rows);
    if (inserted.error) throw inserted.error;
  }

  const updated = await supabase.from("trips").update({ status: "propositions" }).eq("id", tripId);
  if (updated.error) throw updated.error;

  return {
    count: rows.length,
    providerErrors,
    shortlist: shortlistNames,
    apiAccommodations: apiAccIds.size,
    transportQuotes: Object.keys(transportByDestinationId).length,
  };
}