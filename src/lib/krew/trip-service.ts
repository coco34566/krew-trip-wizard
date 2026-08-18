/**
 * Adaptateurs entre les lignes de la base et le moteur de recommandation.
 * Isolé des fichiers `*.functions.ts` (qui doivent rester de simples wrappers).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildProposals,
  dominantAmbiance,
  getNormalizedBudgetPriority,
  type Proposal,
  type ScoringContext,
} from "./engine";
import { reportServerError } from "@/lib/server-error-reporting.server";
import { loadTravelCatalog } from "./providers.server";
import {
  discoverCandidateDestinations,
  listAreaProfilesForNames,
  listCityProfilesForNames,
} from "./destination-discovery.server";
import { discoverDestinationsWithAi } from "./destination-ai.server";
import {
  aiCandidateToDestinationRow,
  mergeCandidates,
  normCity,
  type MergedCandidate,
} from "./candidate-merge";
import {
  distanceFromParisKm,
  fetchClimate,
  geocodeDestination,
} from "@/integrations/external/geo-weather.server";
import { aggregateStayProfiles, buildStayConcepts, routeDiscovery } from "./stay-profiles";
import { attachAnchorEnrichments } from "./discovery-enrichment";

export function getEffectiveParticipantsCount(trip: any, participants: any[]): number {
  if (!trip) return Math.max(1, participants?.length || 1);
  const declaredCount = Number(trip.participants_count) || 0;
  const actualCount = Array.isArray(participants) ? participants.length : 0;
  return Math.max(declaredCount, actualCount, 1);
}

export const tripInputSchema = z.object({
  name: z.string().min(2).max(120),
  eventType: z.enum([
    "evg",
    "evjf",
    "anniversaire",
    "weekend",
    "voyage_groupe",
    "famille",
    "seminaire",
    "retraite",
    "autre",
  ]),
  celebratedPerson: z.string().max(120).optional(),
  /** Prénom de l'organisateur (pour identifier qui est qui dans le groupe). */
  organizerFirstName: z.string().min(1).max(80).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  participants: z.number().int().min(2).max(25),
  budgetPerPerson: z.number().min(50).max(20000).default(400),
  departureCity: z.string().min(2).max(80).optional(),
  groupAgeRange: z.enum(["18-25", "25-35", "35-45", "45-60", "60+"]),
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
  end_date: string | null;
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

export function buildScoringContext(
  trip: TripRow,
  prefs: PreferencesRow & Record<string, any>,
  participants?: any[],
): ScoringContext {
  const startMonth = trip.start_date
    ? new Date(trip.start_date).getMonth() + 1
    : new Date().getMonth() + 1;
  return {
    participants: getEffectiveParticipantsCount(trip, participants || []),
    budgetPerPerson: Number(prefs?.max_budget ?? trip.budget_per_person),
    nights: prefs?.duration_nights ?? 2,
    eventType: (trip as any)["event_type"] ?? prefs?.["event_type"] ?? null,
    scoringWeights: prefs?.["scoring_weights"] ?? null,
    ambiances: prefs?.ambiances ?? [],
    activityCategories: prefs?.activity_categories ?? [],
    maxDistanceKm: prefs?.max_distance_km ?? 2000,
    excludedCountries: prefs?.excluded_countries ?? [],
    desiredDestination: prefs?.desired_destination ?? null,
    letKrewDecide: prefs?.["let_krew_decide"] ?? true,
    needsCityCenter: prefs?.needs_city_center ?? true,
    startMonth,
    travelPace: prefs?.["travel_pace"] ?? null,
    dateFlexDays: prefs?.["date_flex_days"] ?? null,
    minAccommodationRating:
      prefs?.["min_accommodation_rating"] != null
        ? Number(prefs["min_accommodation_rating"])
        : null,
    minGroupBudget: prefs?.["min_group_budget"] != null ? Number(prefs["min_group_budget"]) : null,
    vetoBudgetMax: prefs?.["veto_budget_max"] != null ? Number(prefs["veto_budget_max"]) : null,
    hasBudgetVeto: Boolean(prefs?.["has_budget_veto"]),
    dealBreakerAmbiances: prefs?.["deal_breaker_ambiances"] ?? [],
    dealBreakerDestinations: prefs?.["deal_breaker_destinations"] ?? [],
    individualPreferences: prefs?.["individual_preferences"] ?? [],
    starWantedActivities: prefs?.["star_wanted_activities"] ?? [],
    starDealBreakers: prefs?.["star_deal_breakers"] ?? [],
    starWeight: prefs?.["star_weight"] ?? 1,
    dietaryConstraints: prefs?.["dietary_constraints"] ?? [],
    preferredTimeSlots: prefs?.["preferred_time_slots"] ?? [],
    acceptsSharedRoom: prefs?.["accepts_shared_room"] ?? true,
    roomTypePreferences: prefs?.["room_type_preferences"] ?? [],
    mostDemandedLodgingType:
      prefs?.["mostDemandedLodgingType"] ?? prefs?.["most_demanded_lodging_type"] ?? null,
    requiredAmenities: prefs?.["required_amenities"] ?? prefs?.["requiredAmenities"] ?? [],
    needsAccessibility: Boolean(prefs?.["needs_accessibility"]),
    maxTravelDurationHours:
      prefs?.["max_travel_duration_hours"] != null
        ? Number(prefs["max_travel_duration_hours"])
        : null,
    planeRefused: Boolean(prefs?.["plane_refused"]),
    blackoutDates: prefs?.["blackout_dates"] ?? [],
    groupWeatherPreference: prefs?.["group_weather_preference"] ?? 1.0,
    startDate: trip.start_date ?? null,
    endDate: trip.end_date ?? null,
    datesVerified: Boolean(trip.start_date && trip.end_date),
  };
}

export function resolveRecommendationDates(trip: {
  start_date?: string | null;
  end_date?: string | null;
}) {
  const startDate = trip.start_date ?? null;
  const endDate = trip.end_date ?? null;
  return { startDate, endDate, verifiedForDates: Boolean(startDate && endDate) };
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
    budget: JSON.parse(
      JSON.stringify({
        ...proposal.budget,
        subScores: proposal.subScores,
        consensusScore: proposal.consensusScore,
        minSatisfaction: proposal.minSatisfaction,
        satisfiedCount: proposal.satisfiedCount,
        participantsEvaluated: proposal.participantsEvaluated,
      }),
    ),
    activity_ids: proposal.activities.map((a) => a.id),
  };
}

export async function replaceRecommendationsSafely(
  supabase: SupabaseClient,
  tripId: string,
  rows: ReturnType<typeof serializeProposal>[],
) {
  if (!rows.length) return { replaced: false, count: 0 };
  const existing = await supabase.from("recommendations").select("id").eq("trip_id", tripId);
  if (existing.error) throw existing.error;
  const inserted = await supabase.from("recommendations").insert(rows).select("id");
  if (inserted.error) throw inserted.error;
  const oldIds = (existing.data ?? []).map((row: any) => row.id).filter(Boolean);
  if (oldIds.length) {
    const deleted = await supabase.from("recommendations").delete().in("id", oldIds);
    if (deleted.error) throw deleted.error;
  }
  return { replaced: true, count: inserted.data?.length ?? rows.length };
}

export function requiresLegacyProfileValidation(profile: GenerationReadiness["profile"]): boolean {
  return profile.legacyBypass && profile.selectedConcepts.length === 0;
}

export function selectTopDestinationProposals(proposals: Proposal[], limit = 4): Proposal[] {
  const bestByDestination = new Map<string, Proposal>();
  for (const proposal of [...proposals].sort((a, b) => b.score - a.score)) {
    if (!bestByDestination.has(proposal.destination.id)) {
      bestByDestination.set(proposal.destination.id, proposal);
    }
  }
  return [...bestByDestination.values()].slice(0, limit);
}

type ParticipantPrefRow = {
  /** Internal marker: identity resolved from trip metadata/star preferences, never persisted. */
  __isStar?: boolean;
  user_id?: string | null;
  ambiances: string[] | null;
  activity_categories: string[] | null;
  budget_max: number | string | null;
  budget_priority: string | null;
  date_flex_days: number | null;
  required_amenities: string[] | null;
  min_accommodation_rating: number | string | null;
  travel_pace: string | null;
  duration_nights_min: number | null;
  duration_nights_max: number | null;
  desired_destination: string | null;
  departure_city: string | null;
  excluded_destinations: string[] | null;
  deal_breaker_ambiances: string[] | null;
  accepts_shared_room: boolean | null;
  room_type_preference: string | null;
  preferred_time_slots: string[] | null;
  dietary_constraints: string[] | null;
  mobility_notes: string | null;
  accessibility_needs: boolean | null;
  departure_airport_or_station: string | null;
  transport_mode_accepted: string[] | null;
  max_travel_duration_hours: number | string | null;
  free_text?: string | null;
  local_mobility?: "walk_transit" | "car_if_worth_it" | "car_ok" | null;
  accommodation_role?: "base_only" | "part_of_stay" | "centerpiece" | null;
  blackout_dates: string[] | null;
  group_age_range?: string | null;
  wanted_env_type?: string | null;
  weather_preference?: number | null;
};

const STAR_VIRTUAL_USER_ID = "star-virtual-uid";

function mergeUnique(values: Array<string[] | null | undefined>): string[] {
  return [...new Set(values.flatMap((value) => value ?? []))];
}

function getExistingStarRowIndex(
  rows: ParticipantPrefRow[],
  trip: { star_user_id?: string | null; owner_id?: string | null; co_organizer_id?: string | null },
  starPreferenceUserId?: string | null,
): number {
  if (trip.star_user_id) return rows.findIndex((row) => row.user_id === trip.star_user_id);
  const preferenceBelongsToParticipant =
    starPreferenceUserId &&
    starPreferenceUserId !== trip.owner_id &&
    starPreferenceUserId !== trip.co_organizer_id;
  return preferenceBelongsToParticipant
    ? rows.findIndex((row) => row.user_id === starPreferenceUserId)
    : -1;
}

function getStarWeight(eventType: string, hasStar: boolean): number {
  if (!hasStar) return 1;
  if (eventType === "evg" || eventType === "evjf") return 3.2;
  if (eventType === "anniversaire" || eventType === "retraite") return 2.8;
  return 2.5;
}

export function aggregateLocalMobility(
  preferences: Array<{
    localMobility?: "walk_transit" | "car_if_worth_it" | "car_ok" | null;
    weight?: number;
  }>,
) {
  const scores = { walk_transit: 0, car_if_worth_it: 0, car_ok: 0 };
  let total = 0;
  for (const preference of preferences) {
    if (!preference.localMobility) continue;
    const weight = Math.max(0.1, preference.weight ?? 1);
    scores[preference.localMobility] += weight;
    total += weight;
  }
  if (!total) return { value: null, consensus: 0, scores };
  const order = ["walk_transit", "car_if_worth_it", "car_ok"] as const;
  const value = order.reduce((best, current) => (scores[current] > scores[best] ? current : best));
  return { value, consensus: scores[value] / total, scores };
}

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
      "user_id, ambiances, activity_categories, budget_max, budget_priority, date_flex_days, required_amenities, min_accommodation_rating, travel_pace, duration_nights_min, duration_nights_max, desired_destination, departure_city, excluded_destinations, deal_breaker_ambiances, accepts_shared_room, room_type_preference, preferred_time_slots, dietary_constraints, mobility_notes, accessibility_needs, departure_airport_or_station, transport_mode_accepted, max_travel_duration_hours, blackout_dates, group_age_range, wanted_env_type, weather_preference, free_text, local_mobility, accommodation_role",
    )
    .eq("trip_id", tripId);
  if (res.error) {
    console.error("aggregateParticipantPreferences", res.error.message);
    return {
      participantsCount: 0,
      ambiances: [] as string[],
      activityCategories: [] as string[],
      aggregatedBudget: null as number | null,
      minGroupBudget: null as number | null,
      vetoBudgetMax: null as number | null,
      hasBudgetVeto: false,
      requiredAmenities: [] as string[],
      minAccommodationRating: null as number | null,
      medianTravelPace: null as string | null,
      dateFlexDays: 0,
      desiredDestination: null as string | null,
      dealBreakerAmbiances: [] as string[],
      dealBreakerDestinations: [] as string[],
      individualPreferences: [] as any[],
      starWantedActivities: [] as string[],
      starDealBreakers: [] as string[],
      starWeight: 1,
      dietaryConstraints: [] as string[],
      preferredTimeSlots: [] as string[],
      departureOrigins: [] as { city: string; count: number }[],
      departureAirport: null as string | null,
      transportModes: [] as string[],
      maxTravelHours: null as number | null,
      inconsistencies: [] as { userId: string | null; message: string }[],
      vetoCount: 0,
      exclusionCount: 0,
    };
  }

  const rows = (res.data ?? []) as ParticipantPrefRow[];
  let resolvedTripMeta: any = null;
  let resolvedStarData: any = null;

  // Resolve Star identity once, merge Star-specific answers into an existing participant when
  // possible, otherwise create exactly one explicitly marked virtual Star row.
  try {
    const tripQuery = supabase
      .from("trips")
      .select(
        "event_type, celebrated_person, has_star, star_user_id, owner_id, co_organizer_id, group_age_range",
      )
      .eq("id", tripId);
    const tripMeta =
      typeof tripQuery.maybeSingle === "function"
        ? await tripQuery.maybeSingle()
        : typeof tripQuery.single === "function"
          ? await tripQuery.single()
          : await tripQuery;
    const starQuery = supabase.from("trip_star_preferences").select("*").eq("trip_id", tripId);
    const starPrefs =
      typeof starQuery.maybeSingle === "function" ? await starQuery.maybeSingle() : await starQuery;
    const starData = Array.isArray(starPrefs.data) ? starPrefs.data[0] : starPrefs.data;
    resolvedTripMeta = tripMeta.data ?? null;
    resolvedStarData = !starPrefs.error ? starData : null;

    if (!starPrefs.error && starData) {
      const existingIndex = getExistingStarRowIndex(rows, tripMeta.data ?? {}, starData.user_id);
      if (existingIndex >= 0) {
        const existing = rows[existingIndex]!;
        rows[existingIndex] = {
          ...existing,
          __isStar: true,
          ambiances: mergeUnique([existing.ambiances, starData.ambiances]),
          activity_categories: mergeUnique([
            existing.activity_categories,
            starData.wanted_activities,
          ]),
          excluded_destinations: mergeUnique([
            existing.excluded_destinations,
            starData.excluded_destinations,
          ]),
          deal_breaker_ambiances: mergeUnique([
            existing.deal_breaker_ambiances,
            starData.deal_breakers,
          ]),
          desired_destination: starData.desired_destination ?? existing.desired_destination,
          wanted_env_type: starData.wanted_env_type ?? existing.wanted_env_type,
          local_mobility: starData.local_mobility ?? existing.local_mobility,
          accommodation_role: starData.accommodation_role ?? existing.accommodation_role,
        };
      } else {
        rows.push({
          __isStar: true,
          user_id: tripMeta.data?.star_user_id ?? STAR_VIRTUAL_USER_ID,
          ambiances: starData.ambiances ?? [],
          activity_categories: starData.wanted_activities ?? [],
          budget_max: null,
          budget_priority: "nice_to_have",
          date_flex_days: 0,
          required_amenities: [],
          min_accommodation_rating: null,
          travel_pace: "equilibre",
          duration_nights_min: null,
          duration_nights_max: null,
          desired_destination: starData.desired_destination ?? null,
          departure_city: starData.departure_city ?? null,
          excluded_destinations: starData.excluded_destinations ?? [],
          deal_breaker_ambiances: starData.deal_breakers ?? [],
          accepts_shared_room: true,
          room_type_preference: "peu_importe",
          preferred_time_slots: [],
          dietary_constraints: [],
          mobility_notes: null,
          accessibility_needs: false,
          departure_airport_or_station: starData.departure_airport_or_station ?? null,
          transport_mode_accepted: ["peu importe"],
          max_travel_duration_hours: null,
          blackout_dates: [],
          wanted_env_type: starData.wanted_env_type ?? null,
          group_age_range: null,
          weather_preference: starData.weather_preference ?? 1,
          local_mobility: starData.local_mobility ?? null,
          accommodation_role: starData.accommodation_role ?? null,
        });
      }
    } else if (tripMeta.data?.star_user_id) {
      const existing = rows.find((row) => row.user_id === tripMeta.data.star_user_id);
      if (existing) existing.__isStar = true;
    }
  } catch (e) {
    console.warn("Skipped star injection in aggregateParticipantPreferences", e);
  }

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

  // Villes de départ individuelles (normalisées pour regrouper Paris/paris)
  const normCity = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const departureCityCounts = new Map<string, { city: string; count: number }>();
  for (const r of rows) {
    const raw = (r.departure_city ?? "").trim();
    if (!raw) continue;
    const key = normCity(raw);
    const existing = departureCityCounts.get(key);
    if (existing) existing.count += 1;
    else departureCityCounts.set(key, { city: raw, count: 1 });
  }
  const departureOrigins = [...departureCityCounts.values()].sort((a, b) => b.count - a.count);

  const byFrequency = (freq: Record<string, number>) =>
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);

  const dealBreakerAmbiances = Array.from(
    new Set(rows.flatMap((r) => r.deal_breaker_ambiances ?? []).filter(Boolean)),
  );
  const dealBreakerDestinations = Array.from(
    new Set(
      rows
        .flatMap((r) => r.excluded_destinations ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean),
    ),
  );

  // Veto budget : si un participant a budget_priority = must_have (ou veto/high_priority), son budget_max est un plafond dur
  const vetoBudgets = rows
    .filter((r) => getNormalizedBudgetPriority(r.budget_priority) === "must_have")
    .map((r) => Number(r.budget_max ?? 0))
    .filter((n) => n > 0);
  const vetoBudgetMax = vetoBudgets.length ? Math.min(...vetoBudgets) : null;
  const hasBudgetVeto = vetoBudgets.length > 0;

  const dietaryConstraints = Array.from(
    new Set(rows.flatMap((r) => r.dietary_constraints ?? []).filter(Boolean)),
  );
  const dietaryConstraintsRows = rows.filter(
    (r) => r.dietary_constraints && r.dietary_constraints.length > 0,
  );
  const dietaryConstraintsRatio = rows.length ? dietaryConstraintsRows.length / rows.length : 0;

  const preferredTimeSlots = (() => {
    const freq: Record<string, number> = {};
    for (const r of rows)
      for (const s of r.preferred_time_slots ?? []) freq[s] = (freq[s] ?? 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  })();

  const acceptsSharedRoom = rows.length ? rows.every((r) => r.accepts_shared_room === true) : true;
  const roomTypePreferences = Array.from(
    new Set(rows.map((r) => r.room_type_preference).filter((x): x is string => Boolean(x))),
  );

  // Type de logement le plus demandé par le groupe (majorité des réponses individuelles)
  const lodgingTypeFreq: Record<string, number> = {};
  for (const r of rows) {
    const types = r.required_amenities ?? [];
    for (const t of types) {
      if (t && t !== "peu_importe") {
        lodgingTypeFreq[t] = (lodgingTypeFreq[t] || 0) + 1;
      }
    }
  }
  let mostDemandedLodgingType: string | null = null;
  let maxLodgingCount = 0;
  for (const [t, count] of Object.entries(lodgingTypeFreq)) {
    if (count > maxLodgingCount) {
      maxLodgingCount = count;
      mostDemandedLodgingType = t;
    }
  }

  const needsAccessibility =
    rows.some((r) => r.accessibility_needs === true) ||
    rows.some((r) => Boolean((r.mobility_notes ?? "").trim()));

  const maxTravelHoursList = rows
    .map((r) => Number(r.max_travel_duration_hours ?? 0))
    .filter((n) => n > 0);
  const maxTravelDurationHours = maxTravelHoursList.length ? Math.min(...maxTravelHoursList) : null;

  const transportModes = Array.from(
    new Set(rows.flatMap((r) => r.transport_mode_accepted ?? []).filter(Boolean)),
  );
  // Si quelqu'un n'accepte que le train, le groupe doit en tenir compte
  const planeRefused = rows.some((r) => {
    const modes = (r.transport_mode_accepted ?? []).map((m) => m.toLowerCase());
    return modes.length > 0 && !modes.includes("avion") && !modes.includes("peu importe");
  });

  const blackoutDates = Array.from(
    new Set(rows.flatMap((r) => (r.blackout_dates ?? []).map((d) => String(d).slice(0, 10)))),
  ).sort();

  const departureStations = rows
    .map((r) => ({
      city: (r.departure_city ?? "").trim(),
      station: (r.departure_airport_or_station ?? "").trim(),
    }))
    .filter((x) => x.city || x.station);

  // Star : charge préférences + poids
  let starWantedActivities: string[] = [];
  let starDealBreakers: string[] = [];
  let starWeight = 1;
  let starUserId: string | null = null;
  let celebratedPerson: string | null = null;
  let starWantedEnvType: string | null = null;
  const et = String(resolvedTripMeta?.event_type ?? "").toLowerCase();
  celebratedPerson = resolvedTripMeta?.celebrated_person || null;
  starUserId = resolvedTripMeta?.star_user_id ?? null;
  const hasStar =
    Boolean(resolvedTripMeta?.has_star) ||
    Boolean(celebratedPerson) ||
    Boolean(resolvedStarData) ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(et);
  starWeight = getStarWeight(et, hasStar);
  if (resolvedStarData) {
    starWantedActivities = resolvedStarData.wanted_activities ?? [];
    starDealBreakers = resolvedStarData.deal_breakers ?? [];
    starWantedEnvType = resolvedStarData.wanted_env_type ?? null;
  }

  const individualPreferences = rows.map((r) => {
    const uid = (r.user_id as string) || null;
    const isStar = Boolean(r.__isStar || (starUserId && uid && uid === starUserId));
    return {
      ambiances: r.ambiances ?? [],
      activityCategories: r.activity_categories ?? [],
      budgetMax: Number(r.budget_max ?? 0) > 0 ? Number(r.budget_max) : null,
      budgetPriority: r.budget_priority ?? "nice_to_have",
      dealBreakerAmbiances: mergeUnique([
        r.deal_breaker_ambiances,
        // Deal-breakers star appliqués en dur si c'est la star
        isStar ? starDealBreakers : [],
      ]),
      dealBreakerDestinations: (r.excluded_destinations ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean),
      transportModes: r.transport_mode_accepted ?? ["peu importe"],
      departureCity: r.departure_city ?? null,
      maxTravelHours: Number(r.max_travel_duration_hours ?? 0) || null,
      desiredDestination: r.desired_destination ?? null,
      isStar,
      weight: isStar ? starWeight : 1,
      wantedEnvType: r.wanted_env_type ?? null,
      groupAgeRange: r.group_age_range ?? null,
      durationNightsMin: r.duration_nights_min != null ? Number(r.duration_nights_min) : null,
      durationNightsMax: r.duration_nights_max != null ? Number(r.duration_nights_max) : null,
      weatherPreference: r.weather_preference ?? 1,
      freeText: r.free_text || null,
      mobilityNotes: r.mobility_notes || null,
      localMobility: r.local_mobility ?? null,
      accommodationRole: r.accommodation_role ?? null,
    };
  });
  const localMobility = aggregateLocalMobility(individualPreferences);

  const ageRanges = rows.map((r) => r.group_age_range).filter(Boolean);
  const ageRangeFreq = frequencies(ageRanges as string[]);
  const groupAgeRange = resolvedTripMeta?.group_age_range ?? byFrequency(ageRangeFreq)[0] ?? null;

  const envTypes = rows.flatMap((r) =>
    String(r.wanted_env_type ?? "")
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter(Boolean),
  );
  const envTypeFreq = frequencies(envTypes);
  const wantedEnvTypes = byFrequency(envTypeFreq);

  // Calcul de la préférence météo moyenne du groupe + Star + Organisateur
  const weatherPrefs = rows.map((r) => Number(r.weather_preference ?? 1));
  const groupWeatherPreference = weatherPrefs.length
    ? weatherPrefs.reduce((a, b) => a + b, 0) / weatherPrefs.length
    : 1.0;

  const stayProfileAffinities = aggregateStayProfiles(individualPreferences);
  const stayConcepts = buildStayConcepts(stayProfileAffinities);
  const discoveryRoute = routeDiscovery(stayConcepts);

  // Incohérences détectées (pour l'organisateur)
  const inconsistencies: { userId: string | null; message: string }[] = [];
  for (const r of rows) {
    const desired = (r.desired_destination ?? "").trim();
    const excluded = (r.excluded_destinations ?? []).map((s) => String(s).trim().toLowerCase());
    if (desired && excluded.some((e) => e && desired.toLowerCase().includes(e))) {
      inconsistencies.push({
        userId: r.user_id ?? null,
        message: `destination souhaitée « ${desired} » aussi dans les exclusions`,
      });
    }
    if (
      getNormalizedBudgetPriority(r.budget_priority) === "must_have" &&
      !(Number(r.budget_max) > 0)
    ) {
      inconsistencies.push({
        userId: r.user_id ?? null,
        message: `budget incontournable sans budget_max renseigné`,
      });
    }
  }

  return {
    participantsCount: rows.length,
    ambianceFrequencies,
    activityCategoryFrequencies,
    ambiances: byFrequency(ambianceFrequencies).slice(0, 4),
    activityCategories: byFrequency(activityCategoryFrequencies),
    aggregatedBudget: budgets.length ? Math.round(median(budgets) as number) : null,
    minGroupBudget: budgets.length ? Math.round(Math.min(...budgets)) : null,
    /** Plafond veto (prioritaire sur médiane pour hardBudgetFits). */
    vetoBudgetMax,
    hasBudgetVeto,
    minAccommodationRating: ratings.length ? Math.max(...ratings) : null,
    requiredAmenities: Array.from(new Set(rows.flatMap((r) => r.required_amenities ?? []))),
    medianTravelPace: byFrequency(paceFreq)[0] ?? null,
    dateFlexDays: flex.length ? Math.min(...flex) : null,
    desiredDestination: byFrequency(destinationFrequencies)[0] ?? null,
    departureOrigins,
    dealBreakerAmbiances,
    dealBreakerDestinations,
    individualPreferences,
    groupLocalMobility: localMobility.value,
    localMobilityConsensus: localMobility.consensus,
    starWantedActivities,
    starDealBreakers,
    starWeight,
    celebratedPerson,
    dietaryConstraints,
    dietaryConstraintsRatio,
    preferredTimeSlots,
    acceptsSharedRoom,
    roomTypePreferences,
    mostDemandedLodgingType,
    needsAccessibility,
    maxTravelDurationHours,
    transportModes,
    planeRefused,
    blackoutDates,
    departureStations,
    inconsistencies,
    vetoCount: vetoBudgets.length,
    exclusionCount: dealBreakerDestinations.length,
    groupAgeRange,
    wantedEnvTypes,
    starWantedEnvType,
    groupWeatherPreference,
    stayProfileAffinities,
    stayConcepts,
    discoveryRoute,
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

export type GenerationReadiness = {
  canGenerate: boolean;
  answered: number;
  expected: number;
  missingLabels: string[];
  inconsistencies: { userId: string | null; message: string }[];
  quality: {
    answered: number;
    expected: number;
    vetoCount: number;
    exclusionCount: number;
    hasBudgetVeto: boolean;
    dealBreakerAmbiances: number;
    /** Dispos reçues */
    availabilityAnswered: number;
    /** Dates verrouillées par l'orga */
    datesLocked: boolean;
    lockedStart: string | null;
    lockedEnd: string | null;
  };
  checklist: {
    prefsOk: boolean;
    availabilityOk: boolean;
    datesLocked: boolean;
  };
  profile: {
    questionnairesReady: boolean;
    validated: boolean;
    legacyBypass: boolean;
    calculatedConcepts: any[];
    selectedConcepts: any[];
  };
  message?: string;
};

const MIN_ANSWERS = 1;
const MIN_ANSWER_RATIO = 0.4;

export function evaluateStayProfileGate(input: {
  answered: number;
  expected: number;
  validated: boolean;
  hasExistingRecommendations: boolean;
}) {
  const questionnairesReady =
    input.answered >= MIN_ANSWERS &&
    input.answered / Math.max(input.expected, 1) >= MIN_ANSWER_RATIO;
  const legacyBypass = input.hasExistingRecommendations;
  return {
    questionnairesReady,
    legacyBypass,
    profileValidated: input.validated || legacyBypass,
    canGenerate: legacyBypass || (questionnairesReady && input.validated),
  };
}

export async function assessGenerationReadiness(
  supabase: SupabaseClient,
  tripId: string,
): Promise<GenerationReadiness> {
  const starPrefsPromise = (() => {
    const q = supabase.from("trip_star_preferences").select("*").eq("trip_id", tripId);
    return typeof q.maybeSingle === "function" ? q.maybeSingle() : q;
  })();

  const [trip, participants, prefs, avail, starPrefsRes] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "participants_count, dates_locked, start_date, end_date, provisional_start_date, provisional_end_date, celebrated_person, has_star, star_user_id, owner_id, co_organizer_id, stay_concepts_calculated, stay_concepts_selected, stay_profile_validated_at",
      )
      .eq("id", tripId)
      .single(),
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", tripId),
    supabase.from("trip_participant_preferences").select("user_id").eq("trip_id", tripId),
    supabase.from("trip_availability").select("user_id").eq("trip_id", tripId),
    starPrefsPromise,
  ]);
  if (trip.error) throw trip.error;
  if (participants.error) throw participants.error;
  const aggregated = await aggregateParticipantPreferences(supabase, tripId);

  // prefs / avail tables may be missing in some envs
  const prefRows = prefs.error ? [] : (prefs.data ?? []);
  const prefMap = new Map<string, any>();
  for (const p of prefRows as any[]) {
    if (p.user_id) prefMap.set(p.user_id, p);
  }

  const availRows = avail.error ? [] : (avail.data ?? []);
  const availSet = new Set(availRows.map((r: any) => r.user_id).filter(Boolean));

  const celebratedPerson = trip.data?.celebrated_person;
  const hasStar = Boolean((trip.data as any)?.has_star || celebratedPerson);

  const rawParticipants = participants.data ?? [];
  const activeParticipants = rawParticipants.filter((p: any) => p.status !== "absent");

  // Find the star in the participants list strictly via star_user_id
  const starUserId = (trip.data as any)?.star_user_id || null;
  const starParticipant = starUserId
    ? activeParticipants.find((p) => p.user_id === starUserId) || null
    : null;

  // Resolve starUid safely (never use the form-filler's user ID, e.g. organizer, unless it's the actual star)
  const starUid = starParticipant?.user_id || starUserId || "star-virtual-uid";

  const starHasPrefs =
    starPrefsRes.data &&
    ((starPrefsRes.data.wanted_activities && starPrefsRes.data.wanted_activities.length > 0) ||
      (starPrefsRes.data.ambiances && starPrefsRes.data.ambiances.length > 0) ||
      starPrefsRes.data.wanted_env_type ||
      starPrefsRes.data.desired_destination ||
      starPrefsRes.data.submitted_at);
  const starHasAvail =
    starPrefsRes.data &&
    ((starPrefsRes.data.available_dates && starPrefsRes.data.available_dates.length > 0) ||
      (starPrefsRes.data.blocked_dates && starPrefsRes.data.blocked_dates.length > 0));

  const partsList: any[] = [];
  for (const p of activeParticipants) {
    const isStar = p === starParticipant;
    let hasAnswered = p.user_id ? prefMap.has(p.user_id) : false;
    let hasAnsweredAvailability = p.user_id ? availSet.has(p.user_id) : false;

    if (isStar) {
      if (starHasPrefs) hasAnswered = true;
      if (starHasAvail) hasAnsweredAvailability = true;
    }

    partsList.push({
      ...p,
      isStar,
      hasAnswered,
      hasAnsweredAvailability,
    });
  }

  const starInList = partsList.some((p) => p.isStar);
  if (hasStar && !starInList) {
    partsList.push({
      id: "star-virtual-id",
      user_id: starUid,
      isStar: true,
      hasAnswered: !!starHasPrefs,
      hasAnsweredAvailability: !!starHasAvail,
    });
  }

  const expected = Math.max(Number(trip.data?.participants_count) || 0, partsList.length, 1);
  const answered = partsList.filter((p) => p.hasAnswered).length;
  const availabilityAnswered = partsList.filter((p) => p.hasAnsweredAvailability).length;

  const datesLocked = Boolean((trip.data as any)?.dates_locked);
  const lockedStart = datesLocked ? ((trip.data as any).start_date as string | null) : null;
  const lockedEnd = datesLocked ? ((trip.data as any).end_date as string | null) : null;

  const missingLabels = partsList
    .filter((p: any) => !p.hasAnswered)
    .map((p: any) => p.display_name || p.email || "Participant");

  // Availability/date behavior is intentionally unchanged by the profile step.
  const availabilityOk = true;
  const recs = await supabase.from("recommendations").select("id").eq("trip_id", tripId);
  const gate = evaluateStayProfileGate({
    answered,
    expected,
    validated: Boolean((trip.data as any).stay_profile_validated_at),
    hasExistingRecommendations: !recs.error && Boolean(recs.data?.length),
  });
  const prefsOk = gate.questionnairesReady;
  const legacyBypass = gate.legacyBypass;
  const calculatedConcepts = prefsOk ? (aggregated.stayConcepts ?? []).slice(0, 3) : [];
  const persistedCalculated = ((trip.data as any).stay_concepts_calculated ?? []) as any[];
  const selectedConcepts = ((trip.data as any).stay_concepts_selected ?? []) as any[];
  const validated = gate.profileValidated;
  const canGenerate = gate.canGenerate;

  // Persist calculation opportunistically for admins; RLS safely rejects participant writes.
  if (
    prefsOk &&
    !(trip.data as any).stay_profile_validated_at &&
    JSON.stringify(persistedCalculated) !== JSON.stringify(calculatedConcepts)
  ) {
    await supabase
      .from("trips")
      .update({ stay_concepts_calculated: calculatedConcepts } as any)
      .eq("id", tripId);
  }

  let message: string | undefined;
  if (!prefsOk) message = "Les questionnaires n’ont pas encore atteint le seuil requis.";
  else if (!validated) message = "Validez d’abord le profil du voyage.";

  return {
    canGenerate,
    answered,
    expected,
    missingLabels: missingLabels.slice(0, 20),
    inconsistencies: aggregated.inconsistencies ?? [],
    quality: {
      answered,
      expected,
      vetoCount: aggregated.vetoCount ?? 0,
      exclusionCount: aggregated.exclusionCount ?? 0,
      hasBudgetVeto: Boolean(aggregated.hasBudgetVeto),
      dealBreakerAmbiances: (aggregated.dealBreakerAmbiances ?? []).length,
      availabilityAnswered,
      datesLocked,
      lockedStart,
      lockedEnd,
    },
    checklist: {
      prefsOk,
      availabilityOk,
      datesLocked,
    },
    profile: {
      questionnairesReady: prefsOk,
      validated,
      legacyBypass,
      calculatedConcepts: persistedCalculated.length ? persistedCalculated : calculatedConcepts,
      selectedConcepts,
    },
    ...(message ? { message } : {}),
  };
}

export async function generateRecommendationsForTrip(
  supabase: SupabaseClient,
  tripId: string,
  options?: { force?: boolean },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const readiness = await assessGenerationReadiness(supabase, tripId);
  if (!readiness.profile.validated || (!options?.force && !readiness.canGenerate)) {
    return {
      count: 0,
      skipped: true,
      readiness,
      providerErrors: [] as string[],
      shortlist: [] as string[],
    };
  }
  if (requiresLegacyProfileValidation(readiness.profile)) {
    return {
      count: 0,
      skipped: true,
      skipReason: "legacy_profile_validation_required",
      readiness: {
        ...readiness,
        message: "Validez le profil du voyage avant de régénérer les propositions existantes.",
      },
      providerErrors: [] as string[],
      shortlist: [] as string[],
    };
  }

  const [trip, preferences] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).single(),
    supabase.from("trip_preferences").select("*").eq("trip_id", tripId).maybeSingle(),
  ]);
  if (trip.error) throw trip.error;

  const aggregated = await aggregateParticipantPreferences(supabase, tripId);

  // Récupère l'historique des voyages validés passés pour cet organisateur
  let pastDestinations: { country: string; dominantAmbiance: string }[] = [];
  try {
    const { data: pastTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("status", "valide")
      .eq("owner_id", trip.data.owner_id)
      .neq("id", tripId);

    const pastTripIds = (pastTrips ?? []).map((t) => t.id);

    if (pastTripIds.length > 0) {
      const { data: recos } = await supabase
        .from("recommendations")
        .select("destinations(*)")
        .in("trip_id", pastTripIds)
        .eq("is_selected", true);

      if (recos) {
        pastDestinations = recos
          .map((r: any) => {
            const dest = r.destinations;
            if (!dest) return null;
            return {
              country: dest.country as string,
              dominantAmbiance: dominantAmbiance(dest),
            };
          })
          .filter(Boolean) as { country: string; dominantAmbiance: string }[];
      }
    }
  } catch (e) {
    console.warn("pastDestinations fetch skipped", e);
  }

  // Nuits = dates validées (start/end) si présentes, sinon durée questionnaire
  let lockedNights: number | null = null;
  const recommendationDates = resolveRecommendationDates(trip.data);
  const sd = recommendationDates.startDate;
  const ed = recommendationDates.endDate;
  if (sd && ed) {
    const ms = new Date(ed + "T12:00:00Z").getTime() - new Date(sd + "T12:00:00Z").getTime();
    const days = Math.round(ms / (24 * 3600 * 1000));
    if (days >= 1) lockedNights = days;
  }
  const resolvedDestination =
    preferences.data?.desired_destination || aggregated.desiredDestination || null;

  const letKrewDecide = preferences.data?.let_krew_decide ?? true;

  let prefsToUse = preferences.data ?? null;
  if (aggregated.participantsCount && aggregated.participantsCount > 0) {
    prefsToUse = {
      ...preferences.data,
      ambiances: aggregated.ambiances.length
        ? aggregated.ambiances
        : (preferences.data?.ambiances ?? []),
      activity_categories: aggregated.activityCategories.length
        ? aggregated.activityCategories
        : (preferences.data?.activity_categories ?? []),
      max_budget:
        aggregated.aggregatedBudget ?? preferences.data?.max_budget ?? trip.data.budget_per_person,
      duration_nights:
        lockedNights ?? preferences.data?.duration_nights ?? trip.data.duration_nights ?? 2,
      required_amenities: aggregated.requiredAmenities,
      min_accommodation_rating: aggregated.minAccommodationRating,
      travel_pace: aggregated.medianTravelPace,
      date_flex_days: aggregated.dateFlexDays,
      min_group_budget: aggregated.vetoBudgetMax ?? aggregated.minGroupBudget,
      veto_budget_max: aggregated.vetoBudgetMax,
      has_budget_veto: aggregated.hasBudgetVeto,
      deal_breaker_ambiances: aggregated.dealBreakerAmbiances,
      deal_breaker_destinations: aggregated.dealBreakerDestinations,
      individual_preferences: aggregated.individualPreferences,
      star_wanted_activities: aggregated.starWantedActivities,
      star_deal_breakers: aggregated.starDealBreakers,
      star_weight: aggregated.starWeight,
      dietary_constraints: aggregated.dietaryConstraints,
      dietary_constraints_ratio: aggregated.dietaryConstraintsRatio,
      preferred_time_slots: aggregated.preferredTimeSlots,
      accepts_shared_room: aggregated.acceptsSharedRoom,
      room_type_preferences: aggregated.roomTypePreferences,
      most_demanded_lodging_type: aggregated.mostDemandedLodgingType,
      needs_accessibility: aggregated.needsAccessibility,
      needs_city_center: aggregated.needsAccessibility
        ? true
        : (preferences.data?.needs_city_center ?? true),
      max_travel_duration_hours: aggregated.maxTravelDurationHours,
      plane_refused: aggregated.planeRefused,
      blackout_dates: aggregated.blackoutDates,
      group_weather_preference: aggregated.groupWeatherPreference,
      // Distance max resserrée si durée trajet max renseignée (~80 km/h équivalent)
      max_distance_km: aggregated.maxTravelDurationHours
        ? Math.min(
            Number(preferences.data?.max_distance_km ?? 2000),
            Math.round(Number(aggregated.maxTravelDurationHours) * 90),
          )
        : (preferences.data?.max_distance_km ?? undefined),
    } as any;
  }

  if (resolvedDestination) {
    prefsToUse = {
      ...prefsToUse,
      desired_destination: resolvedDestination,
      let_krew_decide: letKrewDecide,
    } as any;
  }

  const partsRes = await supabase.from("trip_participants").select("*").eq("trip_id", tripId);
  const participants = partsRes.data ?? [];
  const ctx = buildScoringContext(trip.data, prefsToUse, participants);
  ctx.groupWeatherPreference = aggregated.groupWeatherPreference ?? 1.0;
  ctx.groupAgeRange = aggregated.groupAgeRange ?? null;
  ctx.wantedEnvTypes = aggregated.wantedEnvTypes ?? [];
  ctx.groupLocalMobility = aggregated.groupLocalMobility ?? null;
  ctx.starWantedEnvType = aggregated.starWantedEnvType ?? null;
  if (aggregated.participantsCount && aggregated.participantsCount > 0) {
    // If we have aggregated participants count from preferences, we can still use ctx.participants as calculated from the actual/effective group count since preferences represents a subset of active members.
    ctx.participants = getEffectiveParticipantsCount(trip.data, participants);
  }
  ctx.pastDestinations = pastDestinations;
  // Fusion exclusions individuelles + trip-level
  const mergedExcluded = Array.from(
    new Set([...(ctx.excludedCountries ?? []), ...(aggregated.dealBreakerDestinations ?? [])]),
  );
  ctx.excludedCountries = mergedExcluded;
  if (aggregated.needsAccessibility) ctx.needsCityCenter = true;

  // ——— Phase 1 : budget + transport individuels → contrainte de destination ———
  ctx.departureOrigins = aggregated.departureOrigins ?? [];
  ctx.planeRefused = Boolean(aggregated.planeRefused);
  ctx.transportModes = aggregated.transportModes ?? [];
  // Si le groupe refuse l'avion, on resserre fortement la distance (train/covoit)
  if (aggregated.planeRefused) {
    ctx.maxDistanceKm = Math.min(ctx.maxDistanceKm, 900);
  }
  // Durée max de trajet → distance max approximative (~90 km/h équivalent)
  if (aggregated.maxTravelDurationHours && Number(aggregated.maxTravelDurationHours) > 0) {
    ctx.maxDistanceKm = Math.min(
      ctx.maxDistanceKm,
      Math.round(Number(aggregated.maxTravelDurationHours) * 90),
    );
  }
  // Budget : plafond veto / médiane déjà dans prefsToUse.max_budget
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

  // 1) Shortlist : fusion IA + règles locales (les deux sources sont toujours appelées)
  let shortlistNames: string[];
  let discoveryMeta: { name: string; affinity: number; reason: string }[] = [];
  let discoverySource: "forced" | "ai" | "local" | "merged" = "local";
  let mergedCandidates: MergedCandidate[] = [];
  if (resolvedDestination && !letKrewDecide) {
    shortlistNames = [resolvedDestination];
    discoveryMeta = [{ name: resolvedDestination, affinity: 100, reason: "destination demandée" }];
    discoverySource = "forced";
  } else {
    const primaryDeparture =
      (aggregated.departureOrigins?.[0]?.city as string | undefined) ||
      (trip.data.departure_city as string) ||
      "Paris";

    const discoveryInput = {
      ambiances: ctx.ambiances,
      activityCategories: ctx.activityCategories,
      budgetPerPerson: Number(ctx.budgetPerPerson) || 400,
      maxDistanceKm: ctx.maxDistanceKm,
      nights: ctx.nights,
      startMonth: ctx.startMonth,
      startDate: ctx.startDate ?? null,
      endDate: ctx.endDate ?? null,
      excludedCountries: ctx.excludedCountries,
      departureCity: primaryDeparture,
      departureOrigins: (aggregated.departureOrigins ?? []).map((origin) => ({
        origin: origin.city,
        participants: origin.count,
      })),
      acceptedTransportModes: [
        ...new Set(
          aggregated.individualPreferences.flatMap(
            (preference: any) => preference.transportModeAccepted ?? [],
          ),
        ),
      ].filter((mode): mode is string => typeof mode === "string" && mode !== "bus"),
      participants: ctx.participants,
      ...(trip.data.event_type ? { eventType: trip.data.event_type as string } : {}),
      planeRefused: Boolean((aggregated as any).planeRefused),
      maxTravelHours: (aggregated as any).maxTravelDurationHours ?? null,
      starWanted: aggregated.starWantedActivities ?? [],
      starDealBreakers: aggregated.starDealBreakers ?? [],
      wantedEnvTypes: aggregated.wantedEnvTypes ?? [],
      starWantedEnvType: aggregated.starWantedEnvType ?? null,
      groupAgeRange: aggregated.groupAgeRange ?? null,
      freeNotes: aggregated.individualPreferences.map((p: any) => p.freeText).filter(Boolean),
      stayProfiles: aggregated.stayProfileAffinities ?? [],
      selectedConcepts: readiness.profile.selectedConcepts,
      discoveryBranches: routeDiscovery(readiness.profile.selectedConcepts).branches,
      localMobility: aggregated.groupLocalMobility ?? null,
      accommodationRole:
        aggregated.individualPreferences.find((p: any) => p.accommodationRole)?.accommodationRole ??
        null,
      relevantIndividualPreferences: aggregated.individualPreferences.map((p: any) => ({
        activities: p.activityCategories,
        environment: p.wantedEnvType,
        mobility: p.localMobility,
        accommodationRole: p.accommodationRole,
        isStar: p.isStar,
      })),
      scoringSignals: {
        desiredDestination: resolvedDestination,
        letKrewDecide,
        starWeight: ctx.starWeight ?? null,
        scoringWeights: ctx.scoringWeights ?? null,
        hardConstraints: {
          hasBudgetVeto: ctx.hasBudgetVeto,
          vetoBudgetMax: ctx.vetoBudgetMax,
          minGroupBudget: ctx.minGroupBudget,
          excludedCountries: ctx.excludedCountries,
          maxDistanceKm: ctx.maxDistanceKm,
          maxTravelHours: ctx.maxTravelDurationHours,
        },
        softPreferences: {
          travelPace: ctx.travelPace,
          preferredTimeSlots: ctx.preferredTimeSlots,
        },
      },
    };

    // Les deux sources sont TOUJOURS interrogées puis fusionnées (Chantier 1)
    const [ai, ruleBased] = await Promise.all([
      discoverDestinationsWithAi(discoveryInput),
      Promise.resolve(discoverCandidateDestinations(discoveryInput, 10)),
    ]);
    if (ai.error) {
      // non bloquant — visible côté logs / providerErrors
      console.warn("[discovery] AI unavailable:", ai.error);
    }
    const aiCities = (ai.candidates ?? []).map((c) => ({
      name: c.name,
      country: c.country,
      affinity: c.affinity,
      reason: (c.why || c.reason) + (ai.cached ? " · cache" : " · IA"),
      why: c.why || c.reason,
      dailyCost: c.dailyCost,
      distanceKm: c.distanceKm,
      bestMonths: c.bestMonths,
      region: c.region,
      destinationType: c.destinationType,
      anchorPlaces: c.anchorPlaces,
      transport: c.transport,
      budgetLevel: c.budgetLevel,
      activityFit: c.activityFit,
      environmentFit: c.environmentFit,
      accommodationFit: c.accommodationFit,
      seasonFit: c.seasonFit,
    }));
    mergedCandidates = mergeCandidates(ruleBased, aiCities);

    if (resolvedDestination && letKrewDecide) {
      const normResolved = normCity(resolvedDestination);
      const exists = mergedCandidates.some((c) => normCity(c.name) === normResolved);
      if (!exists) {
        const profile = listCityProfilesForNames([resolvedDestination])[0];
        mergedCandidates.unshift({
          name: resolvedDestination,
          country: profile?.country ?? "Europe",
          affinity: 98,
          reason: "destination rêvée d'un participant (boostée)",
          source: profile ? "catalog" : "ai_estimate",
          dailyCost: profile?.dailyCost,
          distanceKm: profile?.distanceKm,
          bestMonths: profile?.bestMonths,
          destinationType: "city",
          anchorPlaces: [resolvedDestination],
        });
      } else {
        mergedCandidates = mergedCandidates.map((c) => {
          if (normCity(c.name) === normResolved) {
            return {
              ...c,
              affinity: Math.max(c.affinity, 98),
              reason: `${c.reason} · destination rêvée`,
            };
          }
          return c;
        });
        mergedCandidates.sort((a, b) => b.affinity - a.affinity);
      }
    }

    mergedCandidates = mergedCandidates.slice(0, 50);
    discoverySource = aiCities.length ? "merged" : "local";
    discoveryMeta = mergedCandidates.map((c) => ({
      name: c.name,
      affinity: c.affinity,
      reason: c.source === "ai_estimate" ? `${c.reason} · nouvelle destination` : c.reason,
    }));
    shortlistNames = mergedCandidates.map((c) => c.name);
  }

  // 1b) Matérialise les destinations scorées en catalogue (sinon l'enrichissement / scoring n'a rien à scorer)
  const profiles = listCityProfilesForNames(shortlistNames);
  const areaProfiles = listAreaProfilesForNames(shortlistNames);
  const profileKeys = new Set(profiles.map((p) => normCity(p.name)));
  for (const p of profiles) {
    const slug = normCity(p.name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    try {
      await supabaseAdmin.from("destinations").upsert(
        {
          slug: slug || `ville-${Date.now()}`,
          name: p.name,
          country: p.country,
          distance_from_paris_km: p.distanceKm,
          avg_daily_cost: p.dailyCost,
          best_months: p.bestMonths,
          score_fete: p.ambiances["fete"] ?? 0.5,
          score_detente: p.ambiances["detente"] ?? 0.5,
          score_culturel: p.ambiances["culturel"] ?? 0.5,
          score_aventure: p.ambiances["aventure"] ?? 0.5,
          score_luxe: p.ambiances["luxe"] ?? 0.5,
          score_insolite: p.ambiances["insolite"] ?? 0.5,
          score_sportif: p.ambiances["sportif"] ?? 0.5,
          source: "krew_discovery",
          external_id: `discovery:${p.name.toLowerCase()}`,
        } as any,
        { onConflict: "source,external_id" },
      );
    } catch (e) {
      reportServerError(e, {
        provider: "krew_discovery",
        kind: "catalog_upsert_local_profile",
        destination: p.name,
      });
      // fallback sans contrainte external_id unique
      try {
        const existing = await supabase
          .from("destinations")
          .select("id")
          .ilike("name", p.name)
          .maybeSingle();
        if (!existing.data) {
          await supabaseAdmin.from("destinations").insert({
            slug: slug || `ville-${Date.now()}`,
            name: p.name,
            country: p.country,
            distance_from_paris_km: p.distanceKm,
            avg_daily_cost: p.dailyCost,
            best_months: p.bestMonths,
            source: "krew_discovery",
          } as any);
        }
      } catch (fallbackErr) {
        reportServerError(fallbackErr, {
          provider: "krew_discovery",
          kind: "catalog_fallback_insert",
          destination: p.name,
        });
      }
    }
  }

  for (const area of areaProfiles) {
    const ambiance = (area as any).ambiances ?? {};
    const row = {
      slug: normCity(area.name)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      name: area.name,
      country: area.country,
      avg_daily_cost: (area as any).dailyCost,
      distance_from_paris_km: area.distanceKm,
      best_months: (area as any).bestMonths ?? [],
      popularity: 0.5,
      rating: 3.8,
      score_fete: ambiance.fete ?? 0.5,
      score_aventure: ambiance.aventure ?? 0.5,
      score_detente: ambiance.detente ?? 0.5,
      score_luxe: ambiance.luxe ?? 0.5,
      score_insolite: ambiance.insolite ?? 0.5,
      score_sportif: ambiance.sportif ?? 0.5,
      score_culturel: ambiance.culturel ?? 0.5,
      destination_type: area.destinationType ?? "region_territory",
      region_name: area.region ?? null,
      anchor_places: area.anchorPlaces ?? [area.name],
    };
    try {
      await supabaseAdmin.from("destinations").upsert(
        {
          ...row,
          source: "krew_discovery",
          external_id: `discovery:${area.name.toLowerCase()}`,
        } as any,
        { onConflict: "source,external_id" },
      );
    } catch (e) {
      reportServerError(e, {
        provider: "krew_discovery",
        kind: "catalog_upsert_area",
        destination: area.name,
      });
    }
  }

  // 1c) Villes proposées par l'IA absentes du catalogue → ligne `ai_estimate`
  //     (estimations LLM + saison réelle via Open-Meteo quand disponible).
  const aiOnly = mergedCandidates.filter(
    (c) => c.source === "ai_estimate" && !profileKeys.has(normCity(c.name)),
  );
  for (const candidate of aiOnly) {
    try {
      const known = await supabase
        .from("destinations")
        .select("id, best_months")
        .ilike("name", candidate.name)
        .maybeSingle();
      if (known.data?.id) continue;

      // Saison réelle : géocodage + normales climatiques, fallback estimation LLM
      let bestMonths: number[] | undefined = candidate.bestMonths;
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const place = await geocodeDestination(
          candidate.country ? `${candidate.name}, ${candidate.country}` : candidate.name,
        );
        if (place) {
          latitude = place.latitude;
          longitude = place.longitude;
          const climate = await fetchClimate(place.latitude, place.longitude);
          if (climate.bestMonths.length) bestMonths = climate.bestMonths;
        }
      } catch {
        /* météo indisponible → on garde l'estimation LLM */
      }

      // A geocoded AI suggestion is still exploratory: geocoding does not verify its cost or fit.
      void aiCandidateToDestinationRow(candidate, ctx.ambiances, { bestMonths });
      void latitude;
      void longitude;
    } catch (e) {
      reportServerError(e, {
        provider: "destination-ai",
        kind: "catalog_upsert_ai_estimate",
        destination: candidate.name,
      });
    }
  }

  // 2) Enrichissement API (hôtels / activités réels) UNIQUEMENT sur la shortlist scorée
  if (discoverySource === "merged") {
    // trace légère pour debug orga
    console.info("[discovery] shortlist fusionnée (IA + règles):", shortlistNames.join(", "));
  } else if (discoverySource === "local") {
    console.info("[discovery] shortlist locale scorée:", shortlistNames.join(", "));
  }

  // Destination discovery deliberately does not search live flights, properties or
  // activities. Those providers belong to their explicit downstream workflows.
  const providerErrors: string[] = [];

  // 3) Catalogue enrichi — TOUJOURS restreint à la shortlist dynamique
  //    (sans ce filtre, loadTravelCatalog recharge tout le seed SQL)
  const loadedCatalog = await loadTravelCatalog(supabase, catalogQuery);
  const catalog = attachAnchorEnrichments(
    loadedCatalog,
    loadedCatalog.destinations.filter(
      (destination) =>
        shortlistNames.some((name) => normCity(name) === normCity(destination.name)) &&
        (destination.anchor_places?.length ?? 0) > 0,
    ),
  );
  const normName = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const shortlistSet = new Set(shortlistNames.map(normName).filter(Boolean));

  const destinationsInShortlist = catalog.destinations.filter((d) => {
    if ((d as any).source === "ai_estimate") return false;
    const n = normName(d.name);
    const c = normName(d.country);
    return (
      shortlistSet.has(n) ||
      [...shortlistSet].some((s) => n.includes(s) || s.includes(n) || c.includes(s))
    );
  });

  // Préférer les logements venant des APIs (source rapidapi) quand dispo
  const apiAccIds = new Set(
    (catalog.accommodations as any[])
      .filter((a) => a.source === "rapidapi" || a.booking_url || a.best_provider)
      .map((a) => a.id),
  );

  let catalogFinal = {
    destinations: destinationsInShortlist,
    activities: catalog.activities.filter((a) =>
      destinationsInShortlist.some((d) => d.id === a.destination_id),
    ),
    accommodations: catalog.accommodations.filter((a) =>
      destinationsInShortlist.some((d) => d.id === a.destination_id),
    ),
  };

  catalogFinal.accommodations = catalogFinal.accommodations.filter(
    (a: any) =>
      !String(a.source ?? "").startsWith("property_web:") ||
      (a.price_verified === true &&
        a.availability_verified === true &&
        a.verification_state === "confirmed"),
  );
  const propertyIds = new Set(
    catalogFinal.destinations
      .filter((d: any) => d.source === "property_discovery")
      .map((d) => d.id),
  );
  if (propertyIds.size) {
    const verifiedIds = new Set(
      catalogFinal.accommodations
        .filter((a) => propertyIds.has(a.destination_id))
        .map((a) => a.destination_id),
    );
    catalogFinal.destinations = catalogFinal.destinations.filter(
      (d) => !propertyIds.has(d.id) || verifiedIds.has(d.id),
    );
  }

  if (apiAccIds.size > 0) {
    const apiAccommodations = catalogFinal.accommodations.filter((a) => apiAccIds.has(a.id));
    if (apiAccommodations.length > 0) {
      const destWithApi = new Set(apiAccommodations.map((a) => a.destination_id));
      // Garder toutes les destinations shortlist ; prioriser les hébergements API
      catalogFinal = {
        destinations: catalogFinal.destinations,
        activities: catalogFinal.activities,
        accommodations:
          apiAccommodations.length > 0
            ? [
                ...apiAccommodations,
                ...catalogFinal.accommodations.filter(
                  (a) => !apiAccIds.has(a.id) && !destWithApi.has(a.destination_id),
                ),
              ]
            : catalogFinal.accommodations,
      };
    }
  }

  // Dernier filet : si enrichissement a échoué et shortlist absente du catalogue,
  // on ne doit PAS retomber sur les 12 villes seed hors shortlist.
  if (!catalogFinal.destinations.length && shortlistNames.length) {
    // Recharge le catalogue après upsert discovery (évite shortlist vide)
    const reloaded = await loadTravelCatalog(supabase, catalogQuery);
    catalogFinal = {
      destinations: reloaded.destinations.filter((d) => {
        const n = normName(d.name);
        return shortlistSet.has(n) || [...shortlistSet].some((s) => n.includes(s) || s.includes(n));
      }),
      activities: reloaded.activities,
      accommodations: reloaded.accommodations,
    };
    catalogFinal.activities = catalogFinal.activities.filter((a) =>
      catalogFinal.destinations.some((d) => d.id === a.destination_id),
    );
    catalogFinal.accommodations = catalogFinal.accommodations.filter((a) =>
      catalogFinal.destinations.some((d) => d.id === a.destination_id),
    );
    if (!catalogFinal.destinations.length) {
      providerErrors.push(
        `Aucune destination shortlist en catalogue: ${shortlistNames.join(", ")}`,
      );
    }
  }

  // 4) Estimations Destination : aucune cotation live. Gemini fournit des ordres de
  // grandeur, complétés donnée par donnée par le fallback déterministe KREW.
  const transportByDestinationId: Record<string, number> = {};
  const transportGroupByDestinationId: Record<string, number> = {};
  const transportOriginsByDestinationId: Record<
    string,
    { city: string; count: number; pricePerPerson: number }[]
  > = {};
  const lodgingPerPersonPerNightByDestinationId: Record<string, number> = {};
  const foodPerPersonPerDayByDestinationId: Record<string, number> = {};
  const activitiesPerPersonPerDayByDestinationId: Record<string, number> = {};
  const activityFitByDestinationId: Record<string, string[]> = {};
  const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
  const departureOrigins = aggregated.departureOrigins?.length
    ? aggregated.departureOrigins
    : [{ city: tripOrigin, count: Math.max(1, ctx.participants) }];
  const countedInOrigins = departureOrigins.reduce((sum, origin) => sum + origin.count, 0);
  const originsForQuote =
    countedInOrigins < ctx.participants
      ? [...departureOrigins, { city: tripOrigin, count: ctx.participants - countedInOrigins }]
      : departureOrigins;
  const fallbackTransport = (distanceKm: number) =>
    distanceKm <= 350
      ? 45
      : distanceKm <= 900
        ? 90
        : distanceKm <= 1600
          ? 130
          : Math.round(130 + (distanceKm - 1600) * 0.05);

  const acceptedModesSet = new Set(
    (ctx.transportModes ?? []).map((m) => m.toLowerCase().trim()),
  );
  const hasModeConstraints = acceptedModesSet.size > 0 && !acceptedModesSet.has("peu importe");

  for (const destination of catalogFinal.destinations) {
    const candidate = mergedCandidates.find(
      (item) => normCity(item.name) === normCity(destination.name),
    );
    if (!candidate) continue;
    const byOrigin = originsForQuote.map((origin) => {
      let candidateTransportInfo: { modes: string[]; approxHours: number } | undefined;
      if (candidate.transport) {
        const normOriginCity = normCity(origin.city);
        for (const [key, val] of Object.entries(candidate.transport)) {
          if (normCity(key) === normOriginCity) {
            candidateTransportInfo = val;
            break;
          }
        }
      }

      const modes = candidateTransportInfo?.modes ?? [];
      const hasCompatibleMode =
        !hasModeConstraints ||
        modes.some((m) => {
          const normM = m.toLowerCase().trim();
          return (
            acceptedModesSet.has(normM) ||
            (normM === "flight" && acceptedModesSet.has("avion")) ||
            (normM === "train" && acceptedModesSet.has("train")) ||
            (normM === "car" && (acceptedModesSet.has("voiture") || acceptedModesSet.has("covoiturage")))
          );
        });

      const maxHours = ctx.maxTravelDurationHours;
      const durationHours = candidateTransportInfo?.approxHours ?? null;
      const durationCompatible =
        maxHours == null || durationHours == null || durationHours <= maxHours;

      const pricePerPerson = fallbackTransport(destination.distance_from_paris_km);

      return {
        city: origin.city,
        count: origin.count,
        pricePerPerson,
        hasCompatibleMode,
        durationCompatible,
      };
    });

    const groupTotal = byOrigin.reduce(
      (sum, origin) => sum + origin.pricePerPerson * origin.count,
      0,
    );
    const people = byOrigin.reduce((sum, origin) => sum + origin.count, 0);
    if (people > 0) {
      transportByDestinationId[destination.id] = groupTotal / people;
      transportGroupByDestinationId[destination.id] = groupTotal;
      transportOriginsByDestinationId[destination.id] = byOrigin.map((o) => ({
        city: o.city,
        count: o.count,
        pricePerPerson: o.pricePerPerson,
      }));
    }

    if (candidate.dailyCost != null && Number.isFinite(candidate.dailyCost) && candidate.dailyCost > 0) {
      lodgingPerPersonPerNightByDestinationId[destination.id] = Math.round(candidate.dailyCost * 0.5);
      foodPerPersonPerDayByDestinationId[destination.id] = Math.round(candidate.dailyCost * 0.35);
      activitiesPerPersonPerDayByDestinationId[destination.id] = Math.round(candidate.dailyCost * 0.15);
    }

    if (Array.isArray(candidate.activityFit)) {
      activityFitByDestinationId[destination.id] = candidate.activityFit;
    }
  }

  const ctxWithTransport: ScoringContext = {
    ...ctx,
    transportByDestinationId,
    transportGroupByDestinationId,
    transportOriginsByDestinationId,
    departureOrigins: originsForQuote,
    lodgingPerPersonPerNightByDestinationId,
    foodPerPersonPerDayByDestinationId,
    activitiesPerPersonPerDayByDestinationId,
    activityFitByDestinationId,
  };

  // 5) Scoring final → 4 destinations. The Top 3 product rule applies to
  // stay concepts, while the established destination UI displays four options.
  // Poids depuis DB si dispo
  try {
    const eventKey = ((trip.data.event_type as string) || "default").toLowerCase();
    const { data: wRow } = await supabase
      .from("scoring_weights")
      .select("*")
      .eq("event_type", eventKey)
      .maybeSingle();
    if (wRow) {
      ctxWithTransport.scoringWeights = {
        ambiance: Number(wRow.ambiance_weight),
        activities: Number(wRow.activities_weight),
        budget: Number(wRow.budget_weight),
        distance: Number(wRow.distance_weight),
        season: Number(wRow.season_weight),
        quality: Number(wRow.quality_weight),
        consensus: Number(wRow.consensus_weight ?? 18),
        minSatisfaction: Number(wRow.min_satisfaction_weight ?? 15),
      };
    }
    ctxWithTransport.eventType = eventKey;
  } catch {
    /* table absente → défauts engine */
  }

  let proposals = selectTopDestinationProposals(
    buildProposals(catalogFinal, ctxWithTransport, 20),
    4,
  );

  // Les rationales utilisent les match reasons déterministes et la raison déjà
  // fournie par l'unique appel Gemini de discovery.
  const llmRationales = false;

  // Enregistre les sous-scores de toutes les propositions proposées (pour feedback ultérieur)
  try {
    const eventKey = ((trip.data.event_type as string) || "default").toLowerCase();
    for (let i = 0; i < proposals.length; i++) {
      const prop = proposals[i]!;
      await supabase.from("scoring_feedback").insert({
        trip_id: tripId,
        destination_id: prop.destination.id,
        event_type: eventKey,
        rank_in_top: i + 1,
        was_selected: false,
        final_score: prop.score,
        s_ambiance: prop.subScores.sAmbiance,
        s_activities: prop.subScores.sActivities,
        s_budget: prop.subScores.sBudget,
        s_distance: prop.subScores.sDistance,
        s_season: prop.subScores.sSeason,
        s_quality: prop.subScores.sQuality,
        s_consensus: prop.subScores.sConsensus,
        s_min_satisfaction: prop.subScores.sMinSatisfaction,
      });
    }
  } catch {
    /* feedback table optionnelle */
  }

  const rows = proposals.map((p) => serializeProposal(tripId, p));
  if (!rows.length) {
    return {
      count: 0,
      generationState: "no_admissible_proposals",
      providerErrors,
      shortlist: shortlistNames,
      apiAccommodations: apiAccIds.size,
      llmRationales,
      readiness,
    };
  }
  await replaceRecommendationsSafely(supabase, tripId, rows);

  const runnerUps = (proposals as any).runnerUps || [];
  const updated = await supabase
    .from("trips")
    .update({
      ...(rows.length ? { status: "propositions" } : {}),
      runner_ups: runnerUps,
    })
    .eq("id", tripId);
  if (updated.error) throw updated.error;

  return {
    count: rows.length,
    generationState: rows.length ? "generated" : "no_admissible_proposals",
    providerErrors,
    shortlist: shortlistNames,
    apiAccommodations: apiAccIds.size,
    transportQuotes: Object.keys(transportByDestinationId).length,
    departureOrigins: originsForQuote,
    readiness,
    llmRationales,
  };
}
