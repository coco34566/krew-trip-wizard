/**
 * Adaptateurs entre les lignes de la base et le moteur de recommandation.
 * Isolé des fichiers `*.functions.ts` (qui doivent rester de simples wrappers).
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildProposals, type Proposal, type ScoringContext } from "./engine";
import { loadTravelCatalog } from "./providers.server";
import { discoverCandidateDestinations, listCityProfilesForNames } from "./destination-discovery.server";
import { discoverDestinationsWithAi } from "./destination-ai.server";
import {
  aiCandidateToDestinationRow,
  mergeCandidates,
  normCity,
  type MergedCandidate,
} from "./candidate-merge";
import { fetchClimate, geocodeDestination } from "@/integrations/external/geo-weather.server";

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
  departureCity: z.string().min(2).max(80).default("Paris"),
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

export function buildScoringContext(trip: TripRow, prefs: PreferencesRow & Record<string, any>): ScoringContext {
  const startMonth = trip.start_date
    ? new Date(trip.start_date).getMonth() + 1
    : new Date().getMonth() + 1;
  return {
    participants: trip.participants_count,
    budgetPerPerson: Number(prefs?.max_budget ?? trip.budget_per_person),
    nights: prefs?.duration_nights ?? 2,
    eventType: (trip as any).event_type ?? prefs?.event_type ?? null,
    scoringWeights: prefs?.scoring_weights ?? null,
    ambiances: prefs?.ambiances ?? [],
    activityCategories: prefs?.activity_categories ?? [],
    maxDistanceKm: prefs?.max_distance_km ?? 2000,
    excludedCountries: prefs?.excluded_countries ?? [],
    desiredDestination: prefs?.desired_destination ?? null,
    letKrewDecide: prefs?.let_krew_decide ?? true,
    needsCityCenter: prefs?.needs_city_center ?? true,
    startMonth,
    travelPace: prefs?.travel_pace ?? null,
    dateFlexDays: prefs?.date_flex_days ?? null,
    minAccommodationRating:
      prefs?.min_accommodation_rating != null ? Number(prefs.min_accommodation_rating) : null,
    minGroupBudget: prefs?.min_group_budget != null ? Number(prefs.min_group_budget) : null,
    vetoBudgetMax: prefs?.veto_budget_max != null ? Number(prefs.veto_budget_max) : null,
    hasBudgetVeto: Boolean(prefs?.has_budget_veto),
    dealBreakerAmbiances: prefs?.deal_breaker_ambiances ?? [],
    dealBreakerDestinations: prefs?.deal_breaker_destinations ?? [],
    individualPreferences: prefs?.individual_preferences ?? [],
    starWantedActivities: prefs?.star_wanted_activities ?? [],
    starDealBreakers: prefs?.star_deal_breakers ?? [],
    starWeight: prefs?.star_weight ?? 1,
    dietaryConstraints: prefs?.dietary_constraints ?? [],
    preferredTimeSlots: prefs?.preferred_time_slots ?? [],
    acceptsSharedRoom: prefs?.accepts_shared_room ?? true,
    roomTypePreferences: prefs?.room_type_preferences ?? [],
    needsAccessibility: Boolean(prefs?.needs_accessibility),
    maxTravelDurationHours:
      prefs?.max_travel_duration_hours != null ? Number(prefs.max_travel_duration_hours) : null,
    planeRefused: Boolean(prefs?.plane_refused),
    blackoutDates: prefs?.blackout_dates ?? [],
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

type ParticipantPrefRow = {
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
  blackout_dates: string[] | null;
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
      "user_id, ambiances, activity_categories, budget_max, budget_priority, date_flex_days, required_amenities, min_accommodation_rating, travel_pace, duration_nights_min, duration_nights_max, desired_destination, departure_city, excluded_destinations, deal_breaker_ambiances, accepts_shared_room, room_type_preference, preferred_time_slots, dietary_constraints, mobility_notes, accessibility_needs, departure_airport_or_station, transport_mode_accepted, max_travel_duration_hours, blackout_dates",
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

  // Veto budget : si un participant a budget_priority = veto, son budget_max est un plafond dur
  const vetoBudgets = rows
    .filter((r) => String(r.budget_priority ?? "").toLowerCase() === "veto")
    .map((r) => Number(r.budget_max ?? 0))
    .filter((n) => n > 0);
  const vetoBudgetMax = vetoBudgets.length ? Math.min(...vetoBudgets) : null;
  const hasBudgetVeto = vetoBudgets.length > 0;

  const dietaryConstraints = Array.from(
    new Set(rows.flatMap((r) => r.dietary_constraints ?? []).filter(Boolean)),
  );
  const preferredTimeSlots = (() => {
    const freq: Record<string, number> = {};
    for (const r of rows) for (const s of r.preferred_time_slots ?? []) freq[s] = (freq[s] ?? 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  })();

  const acceptsSharedRoom = rows.length
    ? rows.every((r) => r.accepts_shared_room === true)
    : true;
  const roomTypePreferences = Array.from(
    new Set(rows.map((r) => r.room_type_preference).filter((x): x is string => Boolean(x))),
  );
  const needsAccessibility =
    rows.some((r) => r.accessibility_needs === true) ||
    rows.some((r) => Boolean((r.mobility_notes ?? "").trim()));

  const maxTravelHoursList = rows
    .map((r) => Number(r.max_travel_duration_hours ?? 0))
    .filter((n) => n > 0);
  const maxTravelDurationHours = maxTravelHoursList.length
    ? Math.min(...maxTravelHoursList)
    : null;

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
  try {
    const tripMeta = await supabase
      .from("trips")
      .select("event_type, celebrated_person, has_star, star_user_id")
      .eq("id", tripId)
      .maybeSingle();
    const et = String(tripMeta.data?.event_type ?? "").toLowerCase();
    celebratedPerson = (tripMeta.data?.celebrated_person as string) || null;
    starUserId = (tripMeta.data as any)?.star_user_id ?? null;
    const hasStar =
      Boolean((tripMeta.data as any)?.has_star) ||
      Boolean(celebratedPerson) ||
      ["evg", "evjf", "anniversaire", "retraite"].includes(et);
    // Poids Star : toujours plus fort que le reste du groupe
    if (hasStar) {
      if (et === "evg" || et === "evjf") starWeight = 3.2;
      else if (et === "anniversaire" || et === "retraite") starWeight = 2.8;
      else starWeight = 2.5;
    } else {
      starWeight = 1;
    }
    const starPrefs = await supabase
      .from("trip_star_preferences")
      .select("*")
      .eq("trip_id", tripId)
      .maybeSingle();
    if (starPrefs.data) {
      starWantedActivities = starPrefs.data.wanted_activities ?? [];
      starDealBreakers = starPrefs.data.deal_breakers ?? [];
      if (!starUserId && starPrefs.data.user_id) starUserId = starPrefs.data.user_id;
      // Si le questionnaire star est rempli, on force un poids élevé même hors EVG
      if (starWeight < 2.5) starWeight = 2.5;
    }

    // Map prénom → user_id pour identifier la star parmi les participants
    const parts = await supabase
      .from("trip_participants")
      .select("user_id, display_name, email")
      .eq("trip_id", tripId);
    if (!parts.error && celebratedPerson) {
      const needle = celebratedPerson
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .trim();
      for (const p of parts.data ?? []) {
        const name = String(p.display_name ?? "")
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .trim();
        if (name && (name === needle || name.includes(needle) || needle.includes(name))) {
          if (p.user_id) starUserId = p.user_id;
          break;
        }
      }
    }
  } catch {
    /* table absente → ignore */
  }

  const individualPreferences = rows.map((r) => {
    const uid = (r.user_id as string) || null;
    const isStar = Boolean(starUserId && uid && uid === starUserId);
    return {
      ambiances: r.ambiances ?? [],
      activityCategories: r.activity_categories ?? [],
      budgetMax: Number(r.budget_max ?? 0) > 0 ? Number(r.budget_max) : null,
      budgetPriority: r.budget_priority ?? "preference",
      dealBreakerAmbiances: [
        ...(r.deal_breaker_ambiances ?? []),
        // Deal-breakers star appliqués en dur si c'est la star
        ...(isStar ? starDealBreakers : []),
      ],
      dealBreakerDestinations: (r.excluded_destinations ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean),
      transportModes: r.transport_mode_accepted ?? ["peu importe"],
      maxTravelHours: Number(r.max_travel_duration_hours ?? 0) || null,
      isStar,
      weight: isStar ? starWeight : 1,
    };
  });

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
    if (String(r.budget_priority ?? "").toLowerCase() === "veto" && !(Number(r.budget_max) > 0)) {
      inconsistencies.push({
        userId: r.user_id ?? null,
        message: `veto budget sans budget_max renseigné`,
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
    starWantedActivities,
    starDealBreakers,
    starWeight,
    celebratedPerson,
    dietaryConstraints,
    preferredTimeSlots,
    acceptsSharedRoom,
    roomTypePreferences,
    needsAccessibility,
    maxTravelDurationHours,
    transportModes,
    planeRefused,
    blackoutDates,
    departureStations,
    inconsistencies,
    vetoCount: vetoBudgets.length,
    exclusionCount: dealBreakerDestinations.length,
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
  message?: string;
};

const MIN_ANSWERS = 1;
const MIN_ANSWER_RATIO = 0.4;

export async function assessGenerationReadiness(
  supabase: SupabaseClient,
  tripId: string,
): Promise<GenerationReadiness> {
  const [trip, participants, prefs, avail, aggregated] = await Promise.all([
    supabase
      .from("trips")
      .select("participants_count, dates_locked, start_date, end_date, provisional_start_date, provisional_end_date")
      .eq("id", tripId)
      .single(),
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", tripId),
    supabase.from("trip_participant_preferences").select("user_id").eq("trip_id", tripId),
    supabase.from("trip_availability").select("user_id").eq("trip_id", tripId),
    aggregateParticipantPreferences(supabase, tripId),
  ]);
  if (trip.error) throw trip.error;
  if (participants.error) throw participants.error;
  // prefs / avail tables may be missing in some envs
  const prefRows = prefs.error ? [] : (prefs.data ?? []);
  const availRows = avail.error ? [] : (avail.data ?? []);

  const expected = Math.max(
    Number(trip.data?.participants_count) || 0,
    (participants.data ?? []).length,
    1,
  );
  const answeredIds = new Set(
    (prefRows as any[]).map((p: any) => p.user_id).filter(Boolean),
  );
  const answered = answeredIds.size;
  const availabilityAnswered = new Set(
    (availRows as any[]).map((p: any) => p.user_id).filter(Boolean),
  ).size;

  const datesLocked = Boolean((trip.data as any)?.dates_locked);
  const lockedStart = datesLocked
    ? ((trip.data as any).start_date as string | null)
    : null;
  const lockedEnd = datesLocked
    ? ((trip.data as any).end_date as string | null)
    : null;

  const missingLabels = (participants.data ?? [])
    .filter((p: any) => p.user_id && !answeredIds.has(p.user_id))
    .map((p: any) => p.display_name || p.email || "Participant")
    .concat(
      (participants.data ?? [])
        .filter((p: any) => !p.user_id)
        .map((p: any) => `${p.email || "invité"} (pas encore rejoint)`),
    );

  const minRequired = Math.max(MIN_ANSWERS, Math.ceil(expected * MIN_ANSWER_RATIO));
  const minAvail = Math.max(1, Math.ceil(expected * MIN_ANSWER_RATIO));
  const prefsOk = answered >= minRequired;
  const availabilityOk = availabilityAnswered >= minAvail;
  // Dates must be validated (locked) before launching destination API searches
  const canGenerate = prefsOk && availabilityOk && datesLocked;

  const blockers: string[] = [];
  if (!prefsOk) {
    blockers.push(
      `préférences ${answered}/${expected} (min. ${minRequired})`,
    );
  }
  if (!availabilityOk) {
    blockers.push(
      `disponibilités ${availabilityAnswered}/${expected} (min. ${minAvail})`,
    );
  }
  if (!datesLocked) {
    blockers.push("dates non validées par l'organisateur");
  }

  let message: string | undefined;
  if (!canGenerate) {
    message = `Pas prêt pour les recherches destinations : ${blockers.join(" · ")}.`;
  }

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
    message,
  };
}

export async function generateRecommendationsForTrip(
  supabase: SupabaseClient,
  tripId: string,
  options?: { force?: boolean },
) {
  const readiness = await assessGenerationReadiness(supabase, tripId);
  if (!options?.force && !readiness.canGenerate) {
    return {
      count: 0,
      skipped: true,
      readiness,
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

  // Nuits = dates validées (start/end) si présentes, sinon durée questionnaire
  let lockedNights: number | null = null;
  let sd = trip.data.start_date as string | null;
  let ed = trip.data.end_date as string | null;
  // Mode test (force) : dates fictives si absentes pour pouvoir scorer
  if (options?.force && (!sd || !ed)) {
    const d0 = new Date();
    d0.setDate(d0.getDate() + 28);
    // prochain vendredi
    d0.setDate(d0.getDate() + ((5 - d0.getDay() + 7) % 7));
    sd = d0.toISOString().slice(0, 10);
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() + 2);
    ed = d1.toISOString().slice(0, 10);
    // n'écrit pas en base — uniquement pour le scoring de cette génération
    (trip.data as any).start_date = sd;
    (trip.data as any).end_date = ed;
  }
  if (sd && ed) {
    const ms = new Date(ed + "T12:00:00Z").getTime() - new Date(sd + "T12:00:00Z").getTime();
    const days = Math.round(ms / (24 * 3600 * 1000));
    if (days >= 1) lockedNights = days;
  }
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
      duration_nights: lockedNights ?? preferences.data?.duration_nights ?? trip.data.duration_nights ?? 2,
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
      preferred_time_slots: aggregated.preferredTimeSlots,
      accepts_shared_room: aggregated.acceptsSharedRoom,
      room_type_preferences: aggregated.roomTypePreferences,
      needs_accessibility: aggregated.needsAccessibility,
      needs_city_center: aggregated.needsAccessibility
        ? true
        : preferences.data?.needs_city_center ?? true,
      max_travel_duration_hours: aggregated.maxTravelDurationHours,
      plane_refused: aggregated.planeRefused,
      blackout_dates: aggregated.blackoutDates,
      // Distance max resserrée si durée trajet max renseignée (~80 km/h équivalent)
      max_distance_km: aggregated.maxTravelDurationHours
        ? Math.min(
            Number(preferences.data?.max_distance_km ?? 2000),
            Math.round(Number(aggregated.maxTravelDurationHours) * 90),
          )
        : preferences.data?.max_distance_km ?? undefined,
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
  // Fusion exclusions individuelles + trip-level
  const mergedExcluded = Array.from(
    new Set([
      ...(ctx.excludedCountries ?? []),
      ...(aggregated.dealBreakerDestinations ?? []),
    ]),
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
  if (resolvedDestination) {
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
      excludedCountries: ctx.excludedCountries,
      departureCity: primaryDeparture,
      participants: ctx.participants,
      eventType: (trip.data.event_type as string) || undefined,
      planeRefused: Boolean((aggregated as any).planeRefused),
      maxTravelHours: (aggregated as any).maxTravelDurationHours ?? null,
      starWanted: aggregated.starWantedActivities ?? [],
      starDealBreakers: aggregated.starDealBreakers ?? [],
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
    const aiCities = (ai.cities ?? []).map((c) => ({
      name: c.name,
      country: c.country,
      affinity: c.affinity,
      reason: c.reason + (ai.cached ? " · cache" : " · IA"),
      dailyCost: c.dailyCost,
      distanceKm: c.distanceKm,
      bestMonths: c.bestMonths,
    }));
    mergedCandidates = mergeCandidates(ruleBased, aiCities).slice(0, 12);
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
  const profileKeys = new Set(profiles.map((p) => normCity(p.name)));
  for (const p of profiles) {
    try {
      await supabase.from("destinations").upsert(
        {
          name: p.name,
          country: p.country,
          distance_from_paris_km: p.distanceKm,
          avg_daily_cost: p.dailyCost,
          best_months: p.bestMonths,
          score_fete: p.ambiances.fete ?? 0.5,
          score_detente: p.ambiances.detente ?? 0.5,
          score_culturel: p.ambiances.culturel ?? 0.5,
          score_aventure: p.ambiances.aventure ?? 0.5,
          score_luxe: p.ambiances.luxe ?? 0.5,
          score_insolite: p.ambiances.insolite ?? 0.5,
          score_sportif: p.ambiances.sportif ?? 0.5,
          source: "krew_discovery",
          external_id: `discovery:${p.name.toLowerCase()}`,
        } as any,
        { onConflict: "external_id" },
      );
    } catch (e) {
      // fallback sans contrainte external_id unique
      try {
        const existing = await supabase
          .from("destinations")
          .select("id")
          .ilike("name", p.name)
          .maybeSingle();
        if (!existing.data) {
          await supabase.from("destinations").insert({
            name: p.name,
            country: p.country,
            distance_from_paris_km: p.distanceKm,
            avg_daily_cost: p.dailyCost,
            best_months: p.bestMonths,
            source: "krew_discovery",
          } as any);
        }
      } catch {
        /* ignore */
      }
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

      const row = aiCandidateToDestinationRow(candidate, ctx.ambiances, { bestMonths });
      await supabase.from("destinations").upsert(
        { ...row, latitude, longitude } as any,
        { onConflict: "external_id" },
      );
    } catch (e) {
      console.warn("[discovery] upsert ai_estimate échoué:", candidate.name, e);
    }
  }

  // 2) Enrichissement API (hôtels / activités réels) UNIQUEMENT sur la shortlist scorée
  if (discoverySource === "merged") {
    // trace légère pour debug orga
    console.info("[discovery] shortlist fusionnée (IA + règles):", shortlistNames.join(", "));
  } else if (discoverySource === "local") {
    console.info("[discovery] shortlist locale scorée:", shortlistNames.join(", "));
  }

  const providerErrors = await enrichCatalogWithExternalApis(
    supabase,
    tripId,
    shortlistNames.slice(0, 6),
  );

  // 3) Catalogue enrichi — TOUJOURS restreint à la shortlist dynamique
  //    (sans ce filtre, loadTravelCatalog recharge tout le seed SQL)
  const catalog = await loadTravelCatalog(supabase, catalogQuery);
  const normName = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const shortlistSet = new Set(shortlistNames.map(normName).filter(Boolean));

  const destinationsInShortlist = catalog.destinations.filter((d) => {
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
                ...catalogFinal.accommodations.filter((a) => !apiAccIds.has(a.id) && !destWithApi.has(a.destination_id)),
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

  // 4) Transport multi-origines : chaque ville de départ des participants
  //    → cotation A/R, moyenne pondérée / pers + total groupe
  const transportByDestinationId: Record<string, number> = {};
  const transportGroupByDestinationId: Record<string, number> = {};
  const transportOriginsByDestinationId: Record<
    string,
    { city: string; count: number; pricePerPerson: number }[]
  > = {};

  // Origines : questionnaires individuels, sinon ville du voyage
  const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
  const departureOrigins =
    aggregated.departureOrigins && aggregated.departureOrigins.length > 0
      ? aggregated.departureOrigins
      : [{ city: tripOrigin, count: Math.max(1, ctx.participants) }];

  // Si des gens n'ont pas renseigné de ville, rattacher le reste à l'origine du voyage
  const countedInOrigins = departureOrigins.reduce((s, o) => s + o.count, 0);
  const remaining = Math.max(0, ctx.participants - countedInOrigins);
  const originsForQuote =
    remaining > 0
      ? (() => {
          const copy = departureOrigins.map((o) => ({ ...o }));
          const primary = copy.find((o) => o.city.toLowerCase() === tripOrigin.toLowerCase());
          if (primary) primary.count += remaining;
          else copy.push({ city: tripOrigin, count: remaining });
          return copy;
        })()
      : departureOrigins;

  try {
    const { searchTransportRoundTrip } = await import("@/integrations/external/transport.server");

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

    // Limiter le fan-out API : max 5 destinations × max 4 origines distinctes
    const originsLimited = originsForQuote.slice(0, 4);

    for (const dest of catalogFinal.destinations.slice(0, 5)) {
      const originQuotes: { city: string; count: number; pricePerPerson: number }[] = [];
      let groupTransport = 0;
      let peopleQuoted = 0;

      for (const origin of originsLimited) {
        try {
          const quote = await searchTransportRoundTrip({
            originCity: origin.city,
            destinationCity: dest.name,
            departDate: checkin,
            returnDate: checkout,
            adults: Math.min(Math.max(1, origin.count), 9),
            distanceKm: dest.distance_from_paris_km,
          });
          const price = quote.pricePerPerson;
          originQuotes.push({ city: origin.city, count: origin.count, pricePerPerson: price });
          groupTransport += price * origin.count;
          peopleQuoted += origin.count;
          if (quote.rawError) {
            providerErrors.push(`transport ${origin.city}→${dest.name}: ${quote.rawError}`);
          }
        } catch (e) {
          providerErrors.push(
            `transport ${origin.city}→${dest.name}: ${String(e).slice(0, 120)}`,
          );
        }
      }

      if (peopleQuoted > 0) {
        transportByDestinationId[dest.id] = groupTransport / peopleQuoted;
        transportGroupByDestinationId[dest.id] = groupTransport;
        // Si on n'a coté qu'une partie du groupe, extrapoler le total
        if (peopleQuoted < ctx.participants) {
          transportGroupByDestinationId[dest.id] =
            (groupTransport / peopleQuoted) * ctx.participants;
        }
        transportOriginsByDestinationId[dest.id] = originQuotes;
      }
    }
  } catch (e) {
    providerErrors.push(`transport module: ${String(e).slice(0, 150)}`);
  }

  const ctxWithTransport: ScoringContext = {
    ...ctx,
    transportByDestinationId,
    transportGroupByDestinationId,
    transportOriginsByDestinationId,
    departureOrigins: originsForQuote,
  };

  // 5) Scoring final → top 3
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

  let proposals = buildProposals(catalogFinal, ctxWithTransport, 3);

  // Rationales LLM (1 call groupé, tokens min) — fallback = texte moteur
  let llmRationales = false;
  try {
    const { enrichProposalsWithLlmRationales } = await import("./rationale-llm.server");
    const llmRes = await enrichProposalsWithLlmRationales(proposals, {
      eventType: (trip.data.event_type as string) || ctxWithTransport.eventType,
      participants: ctx.participants,
    });
    proposals = llmRes.proposals;
    llmRationales = llmRes.usedLlm;
    if (llmRes.error) providerErrors.push(`llm-rationale: ${llmRes.error}`);
  } catch (e) {
    providerErrors.push(`llm-rationale: ${String(e).slice(0, 120)}`);
  }


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
    departureOrigins: originsForQuote,
    readiness,
    llmRationales,
  };
}