import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  aggregateParticipantPreferences,
  generateRecommendationsForTrip,
  tripInputSchema,
} from "@/lib/krew/trip-service";
import { resolveActivityResourceUrl } from "@/lib/krew/activity-ai.server";
import { PROFILE_LABELS, STAY_PROFILE_IDS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";

function normalizeStayConcepts(concepts: any[]): StayConcept[] {
  if (!Array.isArray(concepts)) return [];
  const result: StayConcept[] = [];
  const seen = new Set<StayProfileId>();

  for (const c of concepts) {
    if (!c) continue;
    const rawProfiles: string[] =
      Array.isArray(c.profiles) && c.profiles.length > 0
        ? c.profiles
        : (STAY_PROFILE_IDS as readonly string[]).includes(c.id)
          ? [c.id]
          : [];

    for (const pId of rawProfiles) {
      if ((STAY_PROFILE_IDS as readonly string[]).includes(pId) && !seen.has(pId as StayProfileId)) {
        const id = pId as StayProfileId;
        seen.add(id);
        result.push({
          id,
          profiles: [id],
          title: PROFILE_LABELS[id],
          score: typeof c.score === "number" ? c.score : 50,
          rationale: PROFILE_LABELS[id],
        });
      }
    }
  }

  return result;
}
import { buildTripPreparation } from "@/lib/krew/packing-list";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";
import {
  isTripAdmin,
  computeGroupTimeWindow,
  computeGroupTimeWindowExtended,
  scoreTransportOption,
} from "@/lib/krew/engine";

/** Libellé de stade aligné sur le parcours hub (pas le status enum brut). */
function computeJourneyStage(input: {
  status?: string | null;
  datesLocked: boolean;
  profileValidated: boolean;
  destinationSelected: boolean;
  hasItinerary: boolean;
  startDate?: string | null;
}): string {
  const st = String(input.status ?? "").toLowerCase();
  if (st === "annule") return "Annulé";
  if (input.hasItinerary || (input.destinationSelected && st === "valide")) {
    return "Organisation du séjour";
  }
  if (input.destinationSelected) return "Destination choisie · organisation";
  if (input.datesLocked && input.profileValidated) return "Choix de la destination";
  if (input.datesLocked && !input.profileValidated) return "Profil du voyage";
  if (input.startDate) return "Validation des dates";
  return "Collecte des dispos & préférences";
}

export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Tous les voyages dont tu es owner — on filtre seulement les vraiment annulés côté app
    let owned = await supabase
      .from("trips")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    // Si filtre status pose problème (enum), retente sans
    if (owned.error) {
      console.error("listMyTrips owned", owned.error.message);
      owned = (await supabase
        .from("trips")
        .select(
          "id, name, event_type, status, participants_count, created_at, owner_id, start_date, end_date",
        )
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })) as any;
    }
    if (owned.error) throw owned.error;

    const invitations = await supabase
      .from("trip_participants")
      .select("*, trips(*)")
      .or(
        `user_id.eq.${userId},email.eq.${(context.claims?.email as string | undefined)?.toLowerCase() ?? ""}`,
      )
      .order("created_at", { ascending: false });

    const trips = (owned.data ?? []).filter(
      (row: any) => row && String(row.status ?? "") !== "annule",
    );
    const archivedTrips = (owned.data ?? []).filter(
      (row: any) => row && String(row.status ?? "") === "annule",
    );
    const invited = (invitations.data ?? []).filter(
      (p: any) =>
        p.trips &&
        (p.trips as { owner_id: string }).owner_id !== userId &&
        String((p.trips as any).status ?? "") !== "annule" &&
        String(p.status ?? "") !== "refuse",
    );

    // Enrichir avec le stade réel du parcours (dates / destination / organisation)
    const allTripIds = [
      ...trips.map((row: any) => row.id as string),
      ...invited.map((p: any) => (p.trips as any)?.id as string).filter(Boolean),
    ];
    const uniqueIds = [...new Set(allTripIds)];

    const stageByTrip: Record<string, { destinationSelected: boolean; hasItinerary: boolean; hasRecommendations: boolean }> = {};
    const selectedDestinationByTrip: Record<
      string,
      { destination_name: string | null; destination_image_url: string | null }
    > = {};
    type TeamMember = {
      id: string;
      name: string;
      availabilityDone: boolean;
      preferencesDone: boolean;
      isStar: boolean;
    };
    type TeamSummary = {
      total: number;
      identifiedCount: number;
      availabilityAnswered: number;
      preferencesAnswered: number;
      members: TeamMember[];
    };
    const teamSummaryByTrip: Record<string, TeamSummary> = {};

    for (const id of uniqueIds) {
      stageByTrip[id] = { destinationSelected: false, hasItinerary: false, hasRecommendations: false };
      selectedDestinationByTrip[id] = { destination_name: null, destination_image_url: null };
    }

    if (uniqueIds.length) {
      const [allRecos, selRecos, tripExtras, allParticipants, allPrefs, allAvail, allStarPrefs] = await Promise.all([
        supabase
          .from("recommendations")
          .select("trip_id")
          .in("trip_id", uniqueIds),
        supabase
          .from("recommendations")
          .select("trip_id, destinations(name, image_url)")
          .in("trip_id", uniqueIds)
          .eq("is_selected", true),
        supabase
          .from("trips")
          .select("id, dates_locked, group_itinerary, start_date, participants_count, celebrated_person, has_star, star_user_id, stay_profile_validated_at, stay_concepts_selected")
          .in("id", uniqueIds),
        supabase
          .from("trip_participants")
          .select("id, trip_id, user_id, email, display_name, status")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_participant_preferences")
          .select("trip_id, user_id, submitted_at, updated_at")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_availability")
          .select("trip_id, user_id")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_star_preferences")
          .select("trip_id, user_id, wanted_activities, ambiances, wanted_env_type, desired_destination, available_dates, blocked_dates, submitted_at, updated_at")
          .in("trip_id", uniqueIds),
      ]);

      for (const r of allRecos.data ?? []) {
        const tid = (r as any).trip_id as string;
        if (stageByTrip[tid]) stageByTrip[tid].hasRecommendations = true;
      }

      for (const r of selRecos.data ?? []) {
        const tid = (r as any).trip_id as string;
        if (stageByTrip[tid]) stageByTrip[tid].destinationSelected = true;
        const dest = (r as any).destinations;
        if (dest && selectedDestinationByTrip[tid]) {
          selectedDestinationByTrip[tid].destination_name = dest.name ?? null;
          selectedDestinationByTrip[tid].destination_image_url = dest.image_url ?? null;
        }
      }

      const tripExtrasMap = new Map<string, any>();
      for (const row of tripExtras.data ?? []) {
        const tid = (row as any).id as string;
        tripExtrasMap.set(tid, row);
        if (!stageByTrip[tid]) continue;
        stageByTrip[tid].hasItinerary = Boolean((row as any).group_itinerary?.days?.length);
        (stageByTrip[tid] as any).datesLocked = Boolean((row as any).dates_locked);
        (stageByTrip[tid] as any).startDate = (row as any).start_date ?? null;
      }

      const rawParticipants = allParticipants.data ?? [];
      const rawPrefs = allPrefs.data ?? [];
      const rawAvail = allAvail.data ?? [];
      const rawStarPrefs = allStarPrefs.data ?? [];

      for (const tid of uniqueIds) {
        const tripData = tripExtrasMap.get(tid);
        const celebratedPerson = tripData?.celebrated_person;
        const starUserId = tripData?.star_user_id || null;

        const activeParticipants = rawParticipants.filter(
          (p: any) => p.trip_id === tid && p.status !== "absent",
        );

        const prefRows = rawPrefs.filter((p: any) => p.trip_id === tid);
        const prefSet = new Set(prefRows.map((p: any) => p.user_id).filter(Boolean));

        const availRows = rawAvail.filter((a: any) => a.trip_id === tid);
        const availSet = new Set(availRows.map((a: any) => a.user_id).filter(Boolean));

        const starPref = rawStarPrefs.find((sp: any) => sp.trip_id === tid);
        const starHasPrefs = Boolean(
          starPref &&
            ((starPref.wanted_activities && starPref.wanted_activities.length > 0) ||
              (starPref.ambiances && starPref.ambiances.length > 0) ||
              starPref.wanted_env_type ||
              starPref.desired_destination ||
              starPref.submitted_at),
        );
        const starHasAvail = Boolean(
          starPref &&
            ((starPref.available_dates && starPref.available_dates.length > 0) ||
              (starPref.blocked_dates && starPref.blocked_dates.length > 0)),
        );

        const starParticipant = starUserId
          ? activeParticipants.find((p: any) => p.user_id === starUserId) || null
          : null;

        const membersList: TeamMember[] = [];

        for (const p of activeParticipants) {
          const isStar = p === starParticipant || Boolean(starUserId && p.user_id === starUserId);
          let preferencesDone = p.user_id ? prefSet.has(p.user_id) : false;
          let availabilityDone = p.user_id ? availSet.has(p.user_id) : false;

          if (isStar) {
            if (starHasPrefs) preferencesDone = true;
            if (starHasAvail) availabilityDone = true;
          }

          const rawName = p.display_name ?? p.email?.split("@")[0] ?? null;
          const memberName = isStar && celebratedPerson ? celebratedPerson : rawName;
          if (!memberName) continue;

          membersList.push({
            id: p.id,
            name: memberName,
            availabilityDone,
            preferencesDone,
            isStar,
          });
        }

        const expected = Math.max(Number(tripData?.participants_count) || 0, membersList.length, 1);
        const availabilityAnswered = membersList.filter((m) => m.availabilityDone).length;
        const preferencesAnswered = membersList.filter((m) => m.preferencesDone).length;

        teamSummaryByTrip[tid] = {
          total: expected,
          identifiedCount: membersList.length,
          availabilityAnswered,
          preferencesAnswered,
          members: membersList,
        };
      }
    }

    const attachStage = (row: any) => {
      const s = stageByTrip[row.id] || {
        destinationSelected: false,
        hasItinerary: false,
        datesLocked: Boolean(row.dates_locked),
        startDate: row.start_date ?? null,
      };
      const datesLocked = Boolean((s as any).datesLocked ?? row.dates_locked);
      const destinationSelected = Boolean(s.destinationSelected);
      const hasItinerary = Boolean(s.hasItinerary);
        const hasRecommendations = Boolean(s.hasRecommendations);
        const profileValidated =
          Boolean(row.stay_profile_validated_at) ||
          destinationSelected ||
          hasRecommendations;
      const teamSummary = teamSummaryByTrip[row.id] ?? {
        total: Math.max(Number(row.participants_count) || 1, 1),
        answered: 0,
        pending: Math.max(Number(row.participants_count) || 1, 1),
        members: [],
      };
      const destInfo = selectedDestinationByTrip[row.id] || {
        destination_name: null,
        destination_image_url: null,
      };
      return {
        ...row,
        destination_name: destInfo.destination_name,
        destination_image_url: destInfo.destination_image_url,
        dates_locked: datesLocked,
        destination_selected: destinationSelected,
        has_itinerary: hasItinerary,
        journey_stage: computeJourneyStage({
          status: row.status,
          datesLocked,
            profileValidated,
          destinationSelected,
          hasItinerary,
          startDate: row.start_date ?? (s as any).startDate,
        }),
        team_summary: teamSummary,
      };
    };

    return {
      trips: trips.map(attachStage),
      archivedTrips: archivedTrips.map(attachStage),
      invitations: invited.map((p: any) => ({
        ...p,
        trips: p.trips ? attachStage(p.trips) : p.trips,
      })),
    };
  });

export const getTripDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const [preferences, participants, recommendations, votes, activityVotes] = await Promise.all([
      supabase.from("trip_preferences").select("*").eq("trip_id", data.tripId).maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId).order("created_at"),
      supabase
        .from("recommendations")
        .select("*, destinations(*), accommodations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false }),
      supabase.from("recommendation_votes").select("*").eq("trip_id", data.tripId),
      supabase.from("activity_votes").select("*").eq("trip_id", data.tripId),
    ]);

    // Ne pas faire planter le hub si une table optionnelle manque
    const recos = recommendations.error ? [] : (recommendations.data ?? []);
    const voteRows = votes.error ? [] : (votes.data ?? []);
    const activityVoteRows = activityVotes.error ? [] : (activityVotes.data ?? []);
    const participantRows = participants.error ? [] : (participants.data ?? []);

    const activityIds = recos.flatMap((r: any) => r.activity_ids ?? []);
    let activityRows: any[] = [];
    if (activityIds.length) {
      const activities = await supabase.from("activities").select("*").in("id", activityIds);
      activityRows = activities.error ? [] : (activities.data ?? []);
    }

    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);
    const calculatedConcepts = normalizeStayConcepts((aggregated.stayConcepts ?? []).slice(0, 3));
    const storedCalculated = normalizeStayConcepts(((trip.data as any).stay_concepts_calculated ?? []));
    const selectedConcepts = normalizeStayConcepts(((trip.data as any).stay_concepts_selected ?? []));
    const profile = {
      calculatedConcepts: storedCalculated.length ? storedCalculated : calculatedConcepts,
      selectedConcepts,
      validated: Boolean((trip.data as any).stay_profile_validated_at) || recos.length > 0,
      legacyBypass: recos.length > 0 && !(trip.data as any).stay_profile_validated_at,
    };

    return {
      trip: trip.data,
      profile,
      isOwner: isTripAdmin(trip.data, userId),
      isCreator: trip.data.owner_id === userId,
      userId,
      preferences: preferences.error ? null : (preferences.data ?? null),
      participants: participantRows,
      recommendations: recos,
      activities: activityRows,
      votes: voteRows,
      activityVotes: activityVoteRows,
    };
  });

export const tripParticipantsCountInputSchema = z.object({
  tripId: z.string().uuid(),
  participantsCount: z.number().int().min(2).max(25),
});

export async function updateTripParticipantsCountForUser(
  supabase: any,
  userId: string,
  data: z.infer<typeof tripParticipantsCountInputSchema>,
) {
  const trip = await supabase
    .from("trips")
    .select("id, owner_id")
    .eq("id", data.tripId)
    .maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");
  if (trip.data.owner_id !== userId)
    throw new Error("Seul le propriétaire principal peut modifier le groupe");
  const updated = await supabase
    .from("trips")
    .update({ participants_count: data.participantsCount, updated_at: new Date().toISOString() })
    .eq("id", data.tripId)
    .eq("owner_id", userId)
    .select("participants_count")
    .single();
  if (updated.error) throw updated.error;
  return { participantsCount: updated.data.participants_count };
}

export const updateTripParticipantsCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string; participantsCount: number }) =>
    tripParticipantsCountInputSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    return updateTripParticipantsCountForUser(context.supabase, context.userId, data);
  });

export async function createTripHelper(
  supabase: any,
  userId: string,
  email: string,
  data: z.infer<typeof tripInputSchema>,
) {
  const wantsStar =
    Boolean(data.celebratedPerson) ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(String(data.eventType));

  // Payloads progressifs : on élargit le fallback si le schéma Lovable est incomplet
  const fullPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    celebrated_person: data.celebratedPerson ?? null,
    start_date: data.startDate ?? null,
    end_date: data.endDate ?? null,
    participants_count: data.participants,
    budget_per_person: data.budgetPerPerson ?? 400,
    departure_city: data.departureCity ?? null,
    group_age_range: data.groupAgeRange,
    status: "en_preparation",
    has_star: wantsStar,
    duration_nights: data.durationNights ?? 2,
  };
  const midPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    celebrated_person: data.celebratedPerson ?? null,
    participants_count: data.participants,
    budget_per_person: data.budgetPerPerson ?? 400,
    departure_city: data.departureCity ?? null,
    group_age_range: data.groupAgeRange,
    status: "en_preparation",
    duration_nights: data.durationNights ?? 2,
  };
  const minimalPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    participants_count: data.participants ?? 2,
    duration_nights: data.durationNights ?? 2,
  };

  let trip;
  if (wantsStar) {
    // Pour les voyages nécessitant une Star (EVG, EVJF, Anniversaire, Retraite) :
    // On s'assure que celebrated_person et has_star sont TOUJOURS présents dans les fallbacks
    // et qu'on ne masque pas les erreurs en tombant sur un payload sans Star.
    const starMidPayload: Record<string, unknown> = {
      ...midPayload,
      has_star: true,
      duration_nights: data.durationNights ?? 2,
      group_age_range: data.groupAgeRange,
    };
    const starMinimalPayload: Record<string, unknown> = {
      owner_id: userId,
      name: data.name,
      event_type: data.eventType,
      celebrated_person: data.celebratedPerson ?? null,
      participants_count: data.participants ?? 2,
      has_star: true,
      duration_nights: data.durationNights ?? 2,
    };

    trip = await supabase
      .from("trips")
      .insert(fullPayload as any)
      .select("*")
      .single();
    if (trip.error) {
      console.error("createTrip [Star Type] fullPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(starMidPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip [Star Type] starMidPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(starMinimalPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip [Star Type] starMinimalPayload failed:", trip.error);
      throw new Error(
        `Création voyage impossible (type Star): ${trip.error.message || JSON.stringify(trip.error)}. ` +
          "Vérifie le SQL trips (RLS insert + colonnes) dans Supabase.",
      );
    }
  } else {
    // Comportement hérité pour les voyages sans Star (Défaut / Weekend / etc.)
    trip = await supabase
      .from("trips")
      .insert(fullPayload as any)
      .select("*")
      .single();
    if (trip.error) {
      console.warn("createTrip fullPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(midPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.warn("createTrip midPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(minimalPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip minimalPayload failed:", trip.error);
      throw new Error(
        `Création voyage impossible: ${trip.error.message || JSON.stringify(trip.error)}. ` +
          "Vérifie le SQL trips (RLS insert + colonnes) dans Supabase.",
      );
    }
  }
  if (!trip.data?.id) {
    throw new Error("Création voyage impossible: aucune donnée retournée");
  }

  const prefs = await supabase.from("trip_preferences").insert({
    trip_id: trip.data.id,
    average_age: data.averageAge ?? null,
    relation: data.relation ?? null,
    ambiances: data.ambiances ?? [],
    activity_categories: data.activityCategories ?? [],
    desired_destination: data.desiredDestination ?? null,
    let_krew_decide: data.letKrewDecide ?? true,
    max_distance_km: data.maxDistanceKm ?? null,
    excluded_countries: data.excludedCountries ?? [],
    duration_nights: data.durationNights ?? 2,
    max_budget: data.maxBudget ?? null,
    needs_city_center: data.needsCityCenter ?? false,
    mobility_notes: data.mobilityNotes ?? null,
    dietary_constraints: data.dietaryConstraints ?? [],
    availability_notes: data.availabilityNotes ?? null,
  });
  // Ne pas annuler le voyage si la table prefs est absente / partielle
  if (prefs.error) {
    console.error("trip_preferences insert skipped", prefs.error.message);
  }

  const organizerName = data.organizerFirstName ? String(data.organizerFirstName).trim() : null;

  const partInsert = await supabase.from("trip_participants").insert({
    trip_id: trip.data.id,
    user_id: userId,
    email: email,
    display_name: organizerName,
    role: "organisateur",
    status: "accepte",
  });
  if (partInsert.error) {
    // Fallback sans rôle custom si contrainte DB
    const retry = await supabase.from("trip_participants").insert({
      trip_id: trip.data.id,
      user_id: userId,
      email: email,
      display_name: organizerName,
      status: "accepte",
    });
    if (retry.error) {
      console.error("trip_participants insert failed", retry.error);
      // Le voyage existe déjà : on ne bloque pas, l'owner reste identifiable via owner_id
    }
  }

  // Optionnel : synchronise le prénom sur le profil
  if (organizerName) {
    try {
      await supabase
        .from("profiles")
        .upsert(
          { id: userId, full_name: organizerName, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
    } catch {
      /* ignore */
    }
  }

  return { tripId: trip.data.id as string };
}

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tripInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims.email as string | undefined) ?? "";
    return createTripHelper(supabase, userId, email, data);
  });

export const stayProfileValidationSchema = z.object({
  tripId: z.string().uuid(),
  selectedConceptIds: z.array(z.string()).min(1).max(3),
});

export function selectValidatedStayConcepts(
  calculated: StayConcept[],
  selectedConceptIds: string[],
): StayConcept[] {
  if (!selectedConceptIds.length) throw new Error("Sélectionnez au moins un profil de voyage");
  if (selectedConceptIds.length > 3) throw new Error("Sélectionnez au maximum 3 profils de voyage");

  const normalizedCalculated = normalizeStayConcepts(calculated);
  const allowedIds = new Set(normalizedCalculated.map((c) => c.id));

  const validIds = selectedConceptIds.filter((id): id is StayProfileId =>
    (STAY_PROFILE_IDS as readonly string[]).includes(id),
  );
  if (validIds.length !== selectedConceptIds.length) {
    throw new Error("Profil de voyage invalide");
  }

  const uniqueIds = [...new Set(validIds)];

  for (const profileId of uniqueIds) {
    if (!allowedIds.has(profileId)) {
      throw new Error("Profil de voyage non proposé pour ce séjour");
    }
  }

  return uniqueIds.map((profileId) => {
    const matched = normalizedCalculated.find((c) => c.id === profileId);
    return {
      id: profileId,
      profiles: [profileId],
      title: PROFILE_LABELS[profileId],
      score: matched?.score ?? 50,
      rationale: matched?.rationale ?? PROFILE_LABELS[profileId],
    };
  });
}

export const validateStayProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => stayProfileValidationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("owner_id, co_organizer_id, stay_concepts_calculated")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data || !isTripAdmin(trip.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l’organisateur ou co-organisateur peut valider le profil",
      );
    }
    const storedCalculated = normalizeStayConcepts(((trip.data as any).stay_concepts_calculated ?? []));
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);
    const calculated = storedCalculated.length ? storedCalculated : normalizeStayConcepts((aggregated.stayConcepts ?? []).slice(0, 3));
    const selected = selectValidatedStayConcepts(calculated, data.selectedConceptIds);
    const { error } = await supabase
      .from("trips")
      .update({
        stay_concepts_calculated: calculated,
        stay_concepts_selected: selected,
        stay_profile_validated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { calculatedConcepts: calculated, selectedConcepts: selected, validated: true };
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data || !isTripAdmin(trip.data, userId))
      throw new Error("403 Forbidden: génération réservée aux organisateurs");

    const { canServeFromCandidatePool } = await import("@/lib/krew/trip-service");
    const canServeFromPool = await canServeFromCandidatePool(supabase, data.tripId);

    if (!canServeFromPool) {
      // Check user-level rate limit first (across all trips)
      const userWindow = Number(process.env["RATE_LIMIT_USER_RECOMMENDATIONS_WINDOW_SEC"]) || 300;
      const userMax = Number(process.env["RATE_LIMIT_USER_RECOMMENDATIONS_MAX"]) || 3;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "recommendations",
        windowSeconds: userWindow,
        maxCalls: userMax,
        isUserCheck: true,
      });

      // Check trip-level rate limit (inserts rate limit entry if allowed)
      const tripWindow = Number(process.env["RATE_LIMIT_RECOMMENDATIONS_WINDOW_SEC"]) || 300;
      const tripMax = Number(process.env["RATE_LIMIT_RECOMMENDATIONS_MAX"]) || 1;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "recommendations",
        windowSeconds: tripWindow,
        maxCalls: tripMax,
      });
    }

    return generateRecommendationsForTrip(supabase, data.tripId, {
      // `force` n'est accepté qu'en usage test explicite (ALLOW_FORCE_GENERATION),
      // jamais comme comportement par défaut en production.
      force: data.force === true && process.env["ALLOW_FORCE_GENERATION"] === "true",
    });
  });

export const getGenerationReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assessGenerationReadiness } = await import("@/lib/krew/trip-service");
    return assessGenerationReadiness(context.supabase, data.tripId);
  });

export async function inviteParticipantHelper(
  supabase: any,
  userId: string,
  data: { tripId: string; email: string; displayName?: string },
) {
  const tripRes = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id")
    .eq("id", data.tripId)
    .maybeSingle();
  if (tripRes.error) throw tripRes.error;
  if (!tripRes.data) throw new Error("Voyage introuvable");
  const trip = tripRes.data as any;

  if (!isTripAdmin(trip, userId)) {
    throw new Error(
      "403 Forbidden: seul l'organisateur ou co-organisateur peut inviter des participants",
    );
  }

  const result = await supabase
    .from("trip_participants")
    .upsert(
      {
        trip_id: data.tripId,
        email: data.email.toLowerCase(),
        display_name: data.displayName ?? null,
      },
      { onConflict: "trip_id,email" },
    )
    .select("*")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function removeParticipantHelper(
  supabase: any,
  userId: string,
  data: { participantId: string },
) {
  const partRes = await supabase
    .from("trip_participants")
    .select("id, trip_id")
    .eq("id", data.participantId)
    .maybeSingle();
  if (partRes.error) throw partRes.error;
  if (!partRes.data) throw new Error("Participant introuvable");
  const participant = partRes.data as any;

  const tripRes = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id")
    .eq("id", participant.trip_id)
    .maybeSingle();
  if (tripRes.error) throw tripRes.error;
  if (!tripRes.data) throw new Error("Voyage introuvable");
  const trip = tripRes.data as any;

  if (!isTripAdmin(trip, userId)) {
    throw new Error(
      "403 Forbidden: seul l'organisateur ou co-organisateur peut retirer des participants",
    );
  }

  const { error } = await supabase.from("trip_participants").delete().eq("id", data.participantId);
  if (error) throw error;
  return { ok: true };
}

export const inviteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        email: z.string().email(),
        displayName: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return inviteParticipantHelper(supabase, userId, data as any);
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { participantId: string }) =>
    z.object({ participantId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return removeParticipantHelper(supabase, userId, data);
  });

export const finalizeInvitationStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        starMode: z.enum(["secret", "participant"]),
        inviteStepCompleted: z.boolean().optional(),
        starPaysShare: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    if (!isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut finaliser cette étape",
      );
    }

    const logistics = (trip.group_logistics || {}) as any;
    logistics.star_mode = data.starMode;
    if (typeof data.inviteStepCompleted === "boolean") {
      logistics.invite_step_completed = data.inviteStepCompleted;
    }
    logistics.star_pays_share = data.starPaysShare;

    const { error } = await supabase
      .from("trips")
      .update({
        group_logistics: logistics,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);

    if (error) throw error;
    return { ok: true };
  });

export async function setCoOrganizerHelper(
  supabase: any,
  userId: string,
  tripId: string,
  coOrganizerId: string | null,
) {
  // Récupérer le voyage pour vérifier la propriété de l'organisateur principal
  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select("id, owner_id")
    .eq("id", tripId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!trip) throw new Error("Voyage introuvable");

  // Seul le propriétaire (owner_id) peut nommer ou enlever un co-organisateur
  if (trip.owner_id !== userId) {
    throw new Error("403 Forbidden: seul l'organisateur principal peut nommer un co-organisateur");
  }

  const { error } = await supabase
    .from("trips")
    .update({
      co_organizer_id: coOrganizerId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", tripId);

  if (error) throw error;
  return { ok: true };
}

export const setCoOrganizer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        coOrganizerId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return setCoOrganizerHelper(supabase, userId, data.tripId, data.coOrganizerId);
  });

export const setMyTransportTimePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        earliestDepartureTime: z.string().max(10).nullable(),
        latestReturnTime: z.string().max(10).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    const { data: participant, error: partErr } = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", data.tripId)
      .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
      .maybeSingle();

    if (partErr || !participant) {
      throw new Error("403 Forbidden: vous n'êtes pas participant de ce voyage");
    }

    const { error } = await supabase.from("trip_transport_time_prefs").upsert(
      {
        trip_id: data.tripId,
        participant_id: participant.id,
        earliest_departure_time: data.earliestDepartureTime,
        latest_return_time: data.latestReturnTime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,participant_id" },
    );

    if (error) throw error;
    return { ok: true };
  });

export const getGroupTransportTimeWindow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [rowsRes, tripRes] = await Promise.all([
      supabase
        .from("trip_transport_time_prefs")
        .select("earliest_departure_time, latest_return_time")
        .eq("trip_id", data.tripId),
      supabase.from("trips").select("group_logistics").eq("id", data.tripId).maybeSingle(),
    ]);

    if (rowsRes.error) throw rowsRes.error;
    if (tripRes.error) throw tripRes.error;

    const picks = Array.isArray((tripRes.data as any)?.group_logistics?.transportPicks)
      ? (tripRes.data as any).group_logistics.transportPicks
      : [];

    const window = computeGroupTimeWindowExtended(rowsRes.data ?? [], picks);
    return window;
  });

export const toggleVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), recommendationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("recommendation_votes")
      .select("id")
      .eq("recommendation_id", data.recommendationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase
        .from("recommendation_votes")
        .delete()
        .eq("id", existing.data.id);
      if (error) throw error;
      return { voted: false };
    }
    const { error } = await supabase.from("recommendation_votes").insert({
      recommendation_id: data.recommendationId,
      trip_id: data.tripId,
      user_id: userId,
      value: 1,
    });
    if (error) throw error;
    return { voted: true };
  });

export const selectRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), recommendationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Récupère le brief_fingerprint AVANT toute modification des préférences
    const { getCurrentBriefFingerprint } = await import("@/lib/krew/trip-service");
    let activeFingerprint: string | null = null;
    try {
      activeFingerprint = await getCurrentBriefFingerprint(supabase, data.tripId);
    } catch (err) {
      console.warn("Could not fetch brief Fingerprint before selection:", err);
    }

    // Désélectionne les autres propositions
    await supabase
      .from("recommendations")
      .update({ is_selected: false })
      .eq("trip_id", data.tripId);

    // Sélectionne la reco choisie + récupère le nom de destination
    const { data: reco, error: recoError } = await supabase
      .from("recommendations")
      .update({ is_selected: true })
      .eq("id", data.recommendationId)
      .select("id, destinations(name)")
      .single();
    if (recoError) throw recoError;

    // Synchronise desired_destination pour que « Rechercher hébergements & activités » fonctionne
    const destName = (reco as any)?.destinations?.name;
    if (typeof destName === "string" && destName.trim()) {
      const cleanName = destName.trim();
      await supabase.from("trip_preferences").upsert(
        {
          trip_id: data.tripId,
          desired_destination: cleanName,
          let_krew_decide: false,
        },
        { onConflict: "trip_id" },
      );

      // Update destination_candidate_pool status to selected using activeFingerprint captured BEFORE preference modification
      if (activeFingerprint) {
        try {
          const normKey = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          await supabase
            .from("destination_candidate_pool")
            .update({
              status: "selected",
              selected_at: new Date().toISOString(),
            } as any)
            .eq("trip_id", data.tripId)
            .eq("brief_fingerprint", activeFingerprint)
            .eq("destination_key", normKey);
        } catch (poolErr) {
          console.warn("destination_candidate_pool selected update skipped:", poolErr);
        }
      }
    }

    await supabase.from("trips").update({ status: "valide" }).eq("id", data.tripId);

    // Auto-apprentissage : une destination estimée par l'IA et réellement
    // choisie par un groupe entre définitivement au catalogue.
    try {
      const chosen = await supabase
        .from("recommendations")
        .select("destination_id")
        .eq("id", data.recommendationId)
        .maybeSingle();
      const chosenDestId = (chosen.data as any)?.destination_id as string | undefined;
      if (chosenDestId) {
        await supabase
          .from("destinations")
          .update({ source: "krew_catalog" })
          .eq("id", chosenDestId)
          .eq("source", "ai_estimate");
      }
    } catch {
      /* non bloquant */
    }

    // Marque le feedback de scoring pour apprentissage
    try {
      const full = await supabase
        .from("recommendations")
        .select("id, destination_id, score, budget")
        .eq("id", data.recommendationId)
        .maybeSingle();
      const tripRow = await supabase
        .from("trips")
        .select("event_type")
        .eq("id", data.tripId)
        .maybeSingle();
      const eventType = ((tripRow.data as any)?.event_type as string) || "default";
      const destId = full.data?.destination_id;
      if (destId) {
        // marque l'entrée feedback la plus récente pour ce trip+dest
        const fb = await supabase
          .from("scoring_feedback")
          .select("id")
          .eq("trip_id", data.tripId)
          .eq("destination_id", destId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fb.data?.id) {
          await supabase
            .from("scoring_feedback")
            .update({ was_selected: true, recommendation_id: data.recommendationId })
            .eq("id", fb.data.id);
        } else {
          const budget = (full.data as any)?.budget ?? {};
          const ss = budget.subScores ?? {};
          await supabase.from("scoring_feedback").insert({
            trip_id: data.tripId,
            destination_id: destId,
            recommendation_id: data.recommendationId,
            event_type: eventType,
            was_selected: true,
            final_score: full.data?.score ?? null,
            s_ambiance: ss.sAmbiance ?? null,
            s_activities: ss.sActivities ?? null,
            s_budget: ss.sBudget ?? null,
            s_distance: ss.sDistance ?? null,
            s_season: ss.sSeason ?? null,
            s_quality: ss.sQuality ?? null,
            s_consensus: ss.sConsensus ?? null,
            s_min_satisfaction: ss.sMinSatisfaction ?? null,
          });
        }
      }
    } catch (e) {
      console.warn("scoring_feedback update skipped", e);
    }

    return { ok: true };
  });

/** Aperçu public d'un voyage pour la page /join (service role). */
export const getJoinPreview = createServerFn({ method: "GET" })
  .inputValidator((data: any) => {
    const raw: any = data ? (data.tripId ?? data) : "";
    const tripId = String(raw || "")
      .split("?")[0]!
      .split("#")[0]!
      .trim();
    // UUID souple (évite échec si casing / tirets)
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(tripId)) {
      throw new Error("Lien d'invitation invalide (identifiant manquant ou incorrect).");
    }
    return { tripId };
  })
  .handler(async ({ data }) => {
    if (!data) throw new Error("Données manquantes");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trip = await supabaseAdmin
      .from("trips")
      .select(
        "id, name, event_type, departure_city, participants_count, start_date, end_date, status",
      )
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) {
      console.error("getJoinPreview", trip.error.message);
      throw new Error("Impossible de charger l'invitation. Réessaie dans un instant.");
    }
    if (!trip.data) throw new Error("Voyage introuvable ou lien invalide");
    if (String((trip.data as any).status ?? "") === "annule") {
      throw new Error("Ce voyage a été annulé.");
    }
    return {
      id: trip.data.id as string,
      name: (trip.data.name as string) || "Voyage Krew",
      eventType: (trip.data.event_type as string) || "autre",
      departureCity: (trip.data.departure_city as string) || "",
      participantsCount: Number(trip.data.participants_count) || 1,
      startDate: trip.data.start_date as string | null,
      endDate: trip.data.end_date as string | null,
    };
  });

/**
 * Rejoindre un voyage via le lien de partage.
 * Rattache l'utilisateur connecté comme participant (status accepte).
 */
export const joinTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        firstName: z.string().min(1).max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (typeof claims?.email === "string" ? claims.email : "").trim().toLowerCase();
    if (!email) throw new Error("Email de compte manquant — reconnecte-toi.");
    const firstName = data.firstName?.trim() || null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const trip = await supabaseAdmin
      .from("trips")
      .select("id, owner_id, name, celebrated_person, star_user_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    if (trip.data.owner_id === userId) {
      if (firstName) {
        await supabaseAdmin
          .from("trip_participants")
          .update({ display_name: firstName })
          .eq("trip_id", data.tripId)
          .eq("user_id", userId);
      }
      return { tripId: data.tripId, alreadyMember: true, isOwner: true };
    }

    // Si déjà participant par email ou user_id → rattacher
    const byUser = await supabaseAdmin
      .from("trip_participants")
      .select("id, user_id, status")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    const byEmail = byUser.data
      ? byUser
      : await supabaseAdmin
          .from("trip_participants")
          .select("id, user_id, status")
          .eq("trip_id", data.tripId)
          .eq("email", email)
          .maybeSingle();
    const existing = byUser.data ? byUser : byEmail;

    if (existing.data) {
      const patch: {
        user_id?: string | null;
        email?: string;
        status?: "invite" | "accepte" | "refuse" | "absent";
        display_name?: string | null;
      } = { user_id: userId, email, status: "accepte" };
      if (firstName) patch["display_name"] = firstName;
      const updated = await supabaseAdmin
        .from("trip_participants")
        .update(patch)
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (updated.error) throw updated.error;
      if (firstName) {
        try {
          await supabaseAdmin
            .from("profiles")
            .upsert(
              { id: userId, full_name: firstName, updated_at: new Date().toISOString() },
              { onConflict: "id" },
            );
        } catch {
          /* ignore */
        }
      }
      return { tripId: data.tripId, alreadyMember: true, isOwner: false };
    }

    const inserted = await supabaseAdmin
      .from("trip_participants")
      .insert({
        trip_id: data.tripId,
        user_id: userId,
        email,
        display_name: firstName,
        status: "accepte",
        role: "membre",
      })
      .select("id")
      .single();
    if (inserted.error) throw inserted.error;

    if (firstName) {
      try {
        await supabaseAdmin
          .from("profiles")
          .upsert(
            { id: userId, full_name: firstName, updated_at: new Date().toISOString() },
            { onConflict: "id" },
          );
      } catch {
        /* ignore */
      }
    }

    return { tripId: data.tripId, alreadyMember: false, isOwner: false };
  });

/** Données pour la page Récap du groupe (propositions + origines départ). */
export const getTripRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    // Membre uniquement
    const isOwner = trip.data.owner_id === userId;
    if (!isOwner) {
      const email = (typeof context.claims?.email === "string" ? context.claims.email : "")
        .trim()
        .toLowerCase();
      const part = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
        .maybeSingle();
      if (part.error) throw part.error;
      if (!part.data) throw new Error("Accès réservé aux membres du voyage");
    }

    const [recommendations, preferences, progress] = await Promise.all([
      supabase
        .from("recommendations")
        .select("*, destinations(*), accommodations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false })
        .limit(3),
      supabase
        .from("trip_preferences")
        .select("duration_nights")
        .eq("trip_id", data.tripId)
        .maybeSingle(),
      (async () => {
        const { getParticipantsProgress } = await import("@/lib/participant-preferences.functions");
        // fallback inline if no handler export
        try {
          const prefs = await supabase
            .from("trip_participant_preferences")
            .select("user_id")
            .eq("trip_id", data.tripId);
          const parts = await supabase
            .from("trip_participants")
            .select("id, user_id")
            .eq("trip_id", data.tripId);
          const total = Math.max((parts.data ?? []).length, 1);
          const answered = new Set((prefs.data ?? []).map((p: any) => p.user_id).filter(Boolean))
            .size;
          return { answered, total };
        } catch {
          return { answered: 0, total: 0 };
        }
      })(),
    ]);
    if (recommendations.error) throw recommendations.error;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    let departureOrigins =
      aggregated.departureOrigins && aggregated.departureOrigins.length > 0
        ? aggregated.departureOrigins
        : [{ city: tripOrigin, count: Math.max(1, Number(trip.data.participants_count) || 1) }];

    const counted = departureOrigins.reduce((s: number, o: { count: number }) => s + o.count, 0);
    const participants = Math.max(1, Number(trip.data.participants_count) || counted || 1);
    if (counted < participants) {
      const remaining = participants - counted;
      const copy = departureOrigins.map((o: { city: string; count: number }) => ({ ...o }));
      const primary = copy.find((o) => o.city.toLowerCase() === tripOrigin.toLowerCase());
      if (primary) primary.count += remaining;
      else copy.push({ city: tripOrigin, count: remaining });
      departureOrigins = copy;
    }

    const nights =
      preferences.data?.duration_nights ??
      (trip.data.start_date && trip.data.end_date
        ? Math.max(
            1,
            Math.round(
              (new Date(trip.data.end_date as string).getTime() -
                new Date(trip.data.start_date as string).getTime()) /
                (24 * 3600 * 1000),
            ),
          )
        : 3);

    const recoIds = (recommendations.data ?? []).map((r: any) => r.id as string);
    let reactions: any[] = [];
    if (recoIds.length) {
      const reactionsRes = await supabase
        .from("destination_feedback")
        .select("recommendation_id, reaction, participant_id, trip_participants(user_id)")
        .in("recommendation_id", recoIds);
      if (!reactionsRes.error) {
        reactions = reactionsRes.data ?? [];
      }
    }

    const reactionsByReco = new Map<
      string,
      {
        myReaction: "like" | "dislike" | null;
        likesCount: number;
        dislikesCount: number;
      }
    >();

    for (const recoId of recoIds) {
      reactionsByReco.set(recoId, { myReaction: null, likesCount: 0, dislikesCount: 0 });
    }

    for (const r of reactions) {
      const recoId = r.recommendation_id;
      const entry = reactionsByReco.get(recoId);
      if (!entry) continue;

      if (r.reaction === "like") entry.likesCount++;
      if (r.reaction === "dislike") entry.dislikesCount++;

      const isMine = r.trip_participants?.user_id === userId;
      if (isMine) {
        entry.myReaction = r.reaction;
      }
    }

    return {
      trip: {
        id: trip.data.id as string,
        name: trip.data.name as string,
        startDate: trip.data.start_date as string | null,
        endDate: trip.data.end_date as string | null,
        departureCity: tripOrigin,
        participantsCount: participants,
        status: trip.data.status as string,
        runnerUps: (trip.data as any).runner_ups || [],
      },
      isOwner,
      nights,
      departureOrigins,
      progress,
      recommendations: (recommendations.data ?? []).map((r: any) => {
        const rInfo = reactionsByReco.get(r.id) ?? {
          myReaction: null,
          likesCount: 0,
          dislikesCount: 0,
        };
        return {
          id: r.id as string,
          score: Number(r.score ?? 0),
          budget: r.budget,
          matchReasons: r.match_reasons as string[] | null,
          destination: r.destinations
            ? {
                name: r.destinations.name as string,
                country: r.destinations.country as string,
                imageUrl: r.destinations.image_url as string | null,
                distanceKm: Number(r.destinations.distance_from_paris_km ?? 0),
                rating: Number(r.destinations.rating ?? 0),
              }
            : null,
          accommodation: r.accommodations
            ? (() => {
                const acc = r.accommodations;
                const priceOfferUrl = Array.isArray(acc?.price_offers)
                  ? acc.price_offers[0]?.url || acc.price_offers[0]?.booking_url
                  : (acc?.price_offers as any)?.url || (acc?.price_offers as any)?.booking_url;
                const directUrl = acc?.booking_url || acc?.url || priceOfferUrl;
                const destName = r.destinations?.name || "";
                const groupAdults = Math.max(1, Number(trip.data.participants_count) || 1);
                const noRooms = Math.max(1, Math.ceil(groupAdults / 2));
                const exactDeepLink = destName
                  ? `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(`${acc?.name ?? ""} ${destName}`)}&group_adults=${groupAdults}&no_rooms=${noRooms}&selected_currency=EUR`
                  : null;
                return {
                  id: acc.id as string,
                  name: acc.name as string,
                  type: acc.type as string,
                  bookingUrl: (directUrl || exactDeepLink) as string | null,
                };
              })()
            : null,
          myReaction: rInfo.myReaction,
          likesCount: rInfo.likesCount,
          dislikesCount: rInfo.dislikesCount,
        };
      }),
    };
  });

/** Enregistre / rafraîchit un suivi de prix pour une proposition. */
export const watchPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        destinationName: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    // Upsert manuel (unique trip + user + reco)
    const existing = await supabase
      .from("price_watch")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("created_by", userId)
      .eq("recommendation_id", data.recommendationId)
      .maybeSingle();

    if (existing.data?.id) {
      const upd = await supabase
        .from("price_watch")
        .update({ last_checked_at: now, destination_name: data.destinationName ?? null })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (upd.error) throw upd.error;
      return { ok: true, watch: upd.data, refreshed: true };
    }

    const ins = await supabase
      .from("price_watch")
      .insert({
        trip_id: data.tripId,
        recommendation_id: data.recommendationId,
        destination_name: data.destinationName ?? null,
        created_by: userId,
        last_checked_at: now,
      })
      .select("*")
      .single();
    if (ins.error) throw ins.error;
    return { ok: true, watch: ins.data, refreshed: false };
  });

/** Liste des suivis de prix de l'utilisateur (dashboard). */
export const listMyPriceWatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const res = await supabase
      .from("price_watch")
      .select(
        "id, trip_id, recommendation_id, destination_name, last_checked_at, created_at, trips(name, status)",
      )
      .eq("created_by", userId)
      .order("last_checked_at", { ascending: false })
      .limit(20);
    if (res.error) {
      // Table absente (migration pas encore appliquée)
      if (String(res.error.message || "").includes("price_watch")) return { watches: [] as any[] };
      throw res.error;
    }
    return { watches: res.data ?? [] };
  });

/**
 * Répartition des coûts pour la proposition validée (ou une reco précise).
 */
export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        type: z.enum(["hotel", "transport"]),
        status: z.enum(["estimé", "sélectionné", "réservé"]),
        userId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, group_logistics, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    if (!isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut modifier les statuts de réservation",
      );
    }

    const logistics = (trip.group_logistics || {}) as any;
    if (data.type === "hotel") {
      logistics.hotelBookingStatus = data.status;
    } else {
      const targetUid = data.userId || userId;
      const picks = Array.isArray(logistics.transportPicks) ? [...logistics.transportPicks] : [];
      const idx = picks.findIndex((p) => p.userId === targetUid);
      if (idx >= 0) {
        picks[idx].status = data.status;
      }
      logistics.transportPicks = picks;
    }

    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: logistics, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, logistics };
  });

export const getCostSplit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string; recommendationId?: string }) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    let recoQuery = supabase
      .from("recommendations")
      .select("*, destinations(name, distance_from_paris_km)")
      .eq("trip_id", data.tripId);

    if (data.recommendationId) {
      recoQuery = recoQuery.eq("id", data.recommendationId);
    } else {
      recoQuery = recoQuery.eq("is_selected", true);
    }

    const reco = await recoQuery.maybeSingle();
    if (reco.error) throw reco.error;
    if (!reco.data) throw new Error("Aucune proposition validée");

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const { buildCostSplit } = await import("@/lib/krew/cost-split");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);
    if (partsRes.error) throw partsRes.error;
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const [prefsRes, starPrefsRes] = await Promise.all([
      supabase
        .from("trip_participant_preferences")
        .select("user_id, departure_city")
        .eq("trip_id", data.tripId),
      supabase
        .from("trip_star_preferences")
        .select("user_id, departure_city")
        .eq("trip_id", data.tripId)
        .maybeSingle(),
    ]);

    const prefMap = new Map<string, string>();
    for (const p of prefsRes.data ?? []) {
      if (p.user_id && p.departure_city) {
        prefMap.set(p.user_id, p.departure_city);
      }
    }

    const celebratedPerson = trip.data?.celebrated_person;
    const starUid =
      (starPrefsRes.data as any)?.user_id || (trip.data as any)?.star_user_id || "star-virtual-uid";

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    const budget = (reco.data.budget ?? {}) as any;
    const budgetOrigins = Array.isArray(budget.transportByOrigin) ? budget.transportByOrigin : [];
    const fallbackTransport = Number(budget.transport ?? 0);

    const normCity = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const getPriceForCity = (city: string) => {
      const target = normCity(city);
      const match = budgetOrigins.find(
        (bo: any) => normCity(bo.city || bo.originCity || "") === target,
      );
      return match
        ? Number(match.pricePerPerson ?? match.price ?? fallbackTransport)
        : fallbackTransport;
    };

    const logistics = (trip.data.group_logistics || {}) as any;
    const hotelBookingStatus = logistics.hotelBookingStatus || "estimé";
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const totalGroupParticipants = getEffectiveParticipantsCount(trip.data, participants);

    let accommodationCost = Number(budget.accommodation ?? 0);
    const selectedHotelId = logistics.selectedHotelId;
    const hotelsList = Array.isArray(logistics.hotels) ? logistics.hotels : [];
    if (selectedHotelId) {
      const matchHotel = hotelsList.find((h: any) => h.id === selectedHotelId);
      if (matchHotel) {
        accommodationCost = Number(matchHotel.pricePerNight * (trip.data.duration_nights || 2));
      }
    }

    const participantLines: any[] = [];
    let reservedTransportSum = 0;
    let estimatedTransportSum = 0;

    for (const p of participants) {
      const isStar = Boolean(p.user_id && starUid && p.user_id === starUid);

      let city = "";
      if (isStar && (starPrefsRes.data as any)?.departure_city) {
        city = (starPrefsRes.data as any).departure_city;
      } else if (p.user_id && prefMap.has(p.user_id)) {
        city = prefMap.get(p.user_id)!;
      }

      if (!city) {
        city = tripOrigin;
      }

      const userPick = p.user_id ? picks.find((pk: any) => pk.userId === p.user_id) : null;
      let transportPrice = fallbackTransport;
      let isTransportReserved = false;

      if (userPick) {
        transportPrice =
          userPick.pricePerPerson != null ? Number(userPick.pricePerPerson) : fallbackTransport;
        isTransportReserved = userPick.status === "réservé";
      } else {
        transportPrice = getPriceForCity(city);
      }

      if (isTransportReserved) {
        reservedTransportSum += transportPrice;
      } else {
        estimatedTransportSum += transportPrice;
      }

      const name = p.display_name || p.email?.split("@")[0] || "Ami";
      const displayName = isStar ? `${name} ⭐ (${city})` : `${name} (${city})`;

      participantLines.push({
        city: displayName,
        count: 1,
        pricePerPerson: transportPrice,
        isReserved: isTransportReserved,
        userId: p.user_id || null,
        transportStatus: userPick?.status || "estimé",
        isStar,
      });
    }

    if (participantLines.length === 0) {
      participantLines.push({
        city: `Groupe (${tripOrigin})`,
        count: totalGroupParticipants,
        pricePerPerson: fallbackTransport,
        isReserved: false,
        userId: null,
        transportStatus: "estimé",
      });
      estimatedTransportSum += fallbackTransport * totalGroupParticipants;
    }

    const destName =
      (reco.data as any).destinations?.name ?? budget.destinationName ?? "Destination";

    const split = buildCostSplit({
      destinationName: destName,
      accommodation: accommodationCost,
      activities: Number(budget.activities ?? 0),
      food: Number(budget.food ?? 0),
      origins: participantLines,
      fallbackTransportPerPerson: fallbackTransport,
      participants: totalGroupParticipants || 1,
      starPaysShare: logistics.star_pays_share !== false,
    } as any);

    const isHotelReserved = hotelBookingStatus === "réservé";
    const sharedCostReserved = isHotelReserved ? accommodationCost : 0;
    const sharedCostEstimated = isHotelReserved ? 0 : accommodationCost;

    const activitiesCost = Number(budget.activities ?? 0);
    const foodCost = Number(budget.food ?? 0);

    const totalReserved =
      reservedTransportSum + sharedCostReserved + (isHotelReserved ? activitiesCost + foodCost : 0);
    const totalEstimated =
      estimatedTransportSum +
      sharedCostEstimated +
      (isHotelReserved ? 0 : activitiesCost + foodCost);

    return {
      tripName: trip.data.name as string,
      isSelected: Boolean(reco.data.is_selected),
      recommendationId: reco.data.id as string,
      hotelBookingStatus,
      isHotelReserved,
      totalReserved: Math.round(totalReserved),
      totalEstimated: Math.round(totalEstimated),
      split: {
        ...split,
        lines: split.lines.map((l, idx) => {
          const pl = participantLines[idx];
          return {
            ...l,
            userId: pl?.userId || null,
            isTransportReserved: pl?.isReserved || false,
            transportStatus: pl?.transportStatus || "estimé",
          };
        }),
      },
    };
  });

/** Annule un voyage (owner / co-org only). Soft-delete via status annule — sort des listes actives. */
export const cancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), hardDelete: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(trip.data, userId))
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut annuler");

    if (data.hardDelete) {
      // CASCADE sur participants, prefs, recos si FK ON DELETE CASCADE
      const { error } = await supabase.from("trips").delete().eq("id", data.tripId);
      if (error) throw error;
      return { ok: true, mode: "deleted" as const };
    }

    const { error } = await supabase
      .from("trips")
      .update({ status: "annule", updated_at: new Date().toISOString() })
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, mode: "cancelled" as const };
  });

/** Vote pour une activité (toggle) — tous les membres. */
export const toggleActivityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), activityId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await supabase
      .from("activity_votes")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("activity_id", data.activityId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const { error } = await supabase.from("activity_votes").delete().eq("id", existing.data.id);
      if (error) throw error;
      return { voted: false };
    }
    const { error } = await supabase.from("activity_votes").insert({
      trip_id: data.tripId,
      activity_id: data.activityId,
      user_id: userId,
    });
    if (error) throw error;
    return { voted: true };
  });

/** Orga : fige les activités retenues (top votes ou sélection manuelle). */
export const finalizeSelectedActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        activityIds: z.array(z.string().uuid()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(trip.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut valider les activités",
      );
    }
    const { error } = await supabase
      .from("trips")
      .update({
        selected_activity_ids: data.activityIds,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, activityIds: data.activityIds };
  });

/** Génère le planning activités (resto / activités / bars) pour la destination validée. */
export const generateGroupItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check trip-level rate limit for itinerary generation
    const isForced = data.force === true && process.env["ALLOW_FORCE_GENERATION"] === "true";
    if (!isForced) {
      const tripWindow = Number(process.env["RATE_LIMIT_ITINERARY_WINDOW_SEC"]) || 300;
      const tripMax = Number(process.env["RATE_LIMIT_ITINERARY_MAX"]) || 1;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "itinerary",
        windowSeconds: tripWindow,
        maxCalls: tripMax,
      });
    }

    const [tripRes, partsRes, timePrefsRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId),
      supabase
        .from("trip_transport_time_prefs")
        .select("participant_id, earliest_departure_time, latest_return_time")
        .eq("trip_id", data.tripId),
    ]);
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;
    if (!isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut générer le planning",
      );
    }
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const selected = await supabase
      .from("recommendations")
      .select("id, destination_id, activity_ids, match_reasons, score, destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) {
      throw new Error("Valide d'abord une destination avant de générer les activités");
    }

    const destName =
      (selected.data as any).destinations?.name || trip.desired_destination || "Destination";
    const destCountry = (selected.data as any).destinations?.country || null;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    let nights = Number(trip.duration_nights) || 2;
    if (trip.start_date && trip.end_date) {
      const ms =
        new Date(trip.end_date + "T12:00:00Z").getTime() -
        new Date(trip.start_date + "T12:00:00Z").getTime();
      const d = Math.round(ms / (24 * 3600 * 1000));
      if (d >= 1) nights = d;
    }

    // Labels depuis activités catalogue liées à la reco
    const activityIds = ((selected.data as any).activity_ids ?? []) as string[];
    let seedLabels: string[] = [];
    if (activityIds.length) {
      const acts = await supabase.from("activities").select("name, category").in("id", activityIds);
      seedLabels = (acts.data ?? []).map((a: any) => a.name).filter(Boolean);
    }

    const recoRow = selected.data as any;
    const matchReasons = Array.isArray(recoRow.match_reasons)
      ? recoRow.match_reasons.map(String)
      : [];
    const { generateItineraryWithAi, aggregateMajorityTimePreference } =
      await import("@/lib/krew/activity-ai.server");
    const logistics = (trip.group_logistics || {}) as any;
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    // Les horaires de transport retenus priment. À défaut, le calcul part des
    // contraintes de départ/retour et de la durée porte-à-porte conservée.
    const arrivals = picks.map((p: any) => p.arrivalTime || p.time).filter(Boolean) as string[];
    const departures = picks.map((p: any) => p.departureTime).filter(Boolean) as string[];

    let latestArrival: string | null = null;
    let earliestReturn: string | null = null;

    if (arrivals.length > 0) {
      const sortedArrivals = [...arrivals].sort();
      latestArrival = sortedArrivals.at(-1) || null;
    }

    if (departures.length > 0) {
      const sortedDepartures = [...departures].sort();
      earliestReturn = sortedDepartures[0] || null;
    }

    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);

    // Ordinary answers are collective preferences: KREW uses the group
    // median/majority, not a value compatible with every respondent.
    // Planning initial window relies strictly on explicit group destination times or official 18:30 / 16:30 fallbacks.
    const activeParticipantIds = new Set(participants.map((p: any) => p.id));
    const activeTimePrefs = (timePrefsRes.data ?? []).filter((row: any) =>
      row.participant_id ? activeParticipantIds.has(row.participant_id) : true,
    );
    const groupEarliestDeparture = aggregateMajorityTimePreference(
      activeTimePrefs.map((row: any) => row.earliest_departure_time),
    );
    const groupLatestReturnHome = aggregateMajorityTimePreference(
      activeTimePrefs.map((row: any) => row.latest_return_time),
    );
    const retainedDurations = picks
      .map((pick: any) => Number(pick.durationHours))
      .filter((duration: number) => Number.isFinite(duration) && duration > 0);
    const transportDurationHours = retainedDurations.length ? Math.max(...retainedDurations) : null;
    const tripProfile =
      aggregated.stayConcepts?.[0]?.title ?? aggregated.stayProfileAffinities?.[0]?.id ?? null;

    const activityInput: import("@/lib/krew/activity-ai.server").ActivityAiInput = {
      destination: destName,
      country: destCountry,
      startDate: trip.start_date,
      endDate: trip.end_date,
      nights,
      participants: effCount,
      budgetPerPerson:
        Number(aggregated.aggregatedBudget) || Number(trip.budget_per_person) || 400,
      eventType: trip.event_type,
      tripProfile,
      ambiances: aggregated.ambiances ?? [],
      activityCategories: aggregated.activityCategories ?? [],
      starWanted: aggregated.starWantedActivities ?? [],
      dietaryConstraints: aggregated.dietaryConstraints ?? [],
      travelPace: aggregated.medianTravelPace,
      preferredTimeSlots: aggregated.preferredTimeSlots ?? [],
      matchReasons,
      destinationScore: recoRow.score != null ? Number(recoRow.score) : null,
      scoredActivityLabels: seedLabels,
      latestGroupArrival: latestArrival,
      earliestGroupDeparture: earliestReturn,
      latestReturnHome: groupLatestReturnHome,
      earliestOutboundDeparture: groupEarliestDeparture,
      transportDurationHours,
      forceDiscoveryRefresh: data.force === true,
      transportPicksSummary: picks.slice(0, 12).map((p: any) => ({
        city: p.city,
        mode: p.modeLabel || p.mode,
        outboundDeparture: p.outboundDepartureTime,
        arrival: p.arrivalTime || p.time,
        departure: p.departureTime,
        returnArrival: p.returnArrivalTime,
        durationHours: p.durationHours,
      })),
      individualPreferences: aggregated.individualPreferences,
      groupAgeRange: aggregated.groupAgeRange ?? null,
      groupAccommodationRole: aggregated.groupAccommodationRole ?? null,
      starWantedEnvType: aggregated.starWantedEnvType ?? null,
      wantedEnvTypes: aggregated.wantedEnvTypes ?? [],
      activityCategoryFrequencies: aggregated.activityCategoryFrequencies,
      ambianceFrequencies: aggregated.ambianceFrequencies,
      dealBreakerAmbiances: aggregated.dealBreakerAmbiances,
      starDealBreakers: aggregated.starDealBreakers,
      validatedTripProfiles: (() => {
        const selected = (trip.stay_concepts_selected ?? []) as any[];
        if (Array.isArray(selected) && selected.length > 0) {
          const extractedIds = selected
            .flatMap((c: any) => (Array.isArray(c.profiles) ? c.profiles : [c.id]))
            .filter((id: any): id is StayProfileId =>
              (STAY_PROFILE_IDS as readonly string[]).includes(id),
            );
          const uniqueIds = [...new Set(extractedIds)];
          if (uniqueIds.length > 0) return uniqueIds;
        }
        return (STAY_PROFILE_IDS as readonly string[]).includes(tripProfile as any)
          ? [tripProfile as StayProfileId]
          : [];
      })(),
      localMobility: aggregated.groupLocalMobility,
      accessibilityRequired: (aggregated.individualPreferences ?? []).some(
        (preference: any) => preference?.accessibilityRequired === true,
      ),
    };

    const { buildKrewSkeleton, geminiEnrichSkeleton } = await import(
      "@/lib/krew/activity-ai.server"
    );
    const {
      determineSearchRadiusMeters,
    } = await import("@/lib/krew/geoapify.server");

    // 1. Build deterministic KREW Skeleton
    const krewSkeleton = buildKrewSkeleton(activityInput);

    // 2. Single Gemini call to enrich skeleton
    const enrichResult = await geminiEnrichSkeleton(krewSkeleton, activityInput);
    const enrichedSkeleton = enrichResult.enrichedSkeleton;

    // Resolve reference coordinates (accommodation when centerpiece/part_of_stay, else destination)
    let refLat: number | null = null;
    let refLon: number | null = null;
    let accLat: number | null = null;
    let accLon: number | null = null;

    let verifiedAmenities: string[] = [];
    const accRole = aggregated.groupAccommodationRole;
    const selectedAccId = logistics.selectedHotelId;

    if (selectedAccId) {
      const accRes = await supabase
        .from("accommodations")
        .select("latitude, longitude, amenities")
        .eq("id", selectedAccId)
        .maybeSingle();

      if (accRes.data) {
        if (accRes.data.latitude != null && accRes.data.longitude != null) {
          accLat = Number(accRes.data.latitude);
          accLon = Number(accRes.data.longitude);
          if (accRole === "centerpiece" || accRole === "part_of_stay") {
            refLat = accLat;
            refLon = accLon;
          }
        }
        if (Array.isArray(accRes.data.amenities)) {
          verifiedAmenities = accRes.data.amenities.map(String).filter(Boolean);
        } else if (typeof accRes.data.amenities === "string") {
          verifiedAmenities = [accRes.data.amenities].filter(Boolean);
        }
      }
    }

    activityInput.verifiedLodgingAmenities = verifiedAmenities;

    if (refLat == null || refLon == null) {
      if (recoRow.destination_id) {
        const destRes = await supabase
          .from("destinations")
          .select("latitude, longitude")
          .eq("id", recoRow.destination_id)
          .maybeSingle();
        if (destRes.data?.latitude != null && destRes.data?.longitude != null) {
          refLat = Number(destRes.data.latitude);
          refLon = Number(destRes.data.longitude);
        }
      }
    }
    // Fallback geocoding if coordinates not in DB
    if (refLat == null || refLon == null) {
      try {
        const { geocodeDestination } = await import(
          "@/integrations/external/geo-weather.server"
        );
        const geo = await geocodeDestination(
          destCountry ? `${destName}, ${destCountry}` : destName,
        );
        if (geo) {
          refLat = geo.latitude;
          refLon = geo.longitude;
        }
      } catch {
        /* geocoding optional */
      }
    }

    const radiusMeters = determineSearchRadiusMeters(
      aggregated.groupLocalMobility,
      tripProfile,
    );

    // 3. Collect place_required needs and group into category pools
    const {
      searchGeoapifyPlaces,
      convertIntentToPlaceRequirements,
      buildPoolKey,
      rankGeoapifyCandidates,
      mergeUniquePlacesById,
      fetchPlaceDetails,
    } = await import("@/lib/krew/geoapify.server");

    const poolReqMap = new Map<string, any>();
    for (const day of enrichedSkeleton.days) {
      for (const slot of day.slots) {
        if (slot.kind === "place_required") {
          const req = convertIntentToPlaceRequirements(
            slot.venueFamily || "local_experience",
            slot.category,
            slot.searchIntent,
            aggregated.dietaryConstraints,
            Boolean(activityInput.accessibilityRequired),
            activityInput.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
          );
          const poolKey = buildPoolKey(req);
          if (!poolReqMap.has(poolKey)) {
            poolReqMap.set(poolKey, req);
          }
        }
      }
    }

    // 4. Fetch Geoapify place pools for each unique requirements key
    const placePools: Record<string, any[]> = {};
    let geoapifyPlacesCalls = 0;
    let geoapifyDetailsCalls = 0;

    if (refLat != null && refLon != null) {
      for (const [poolKey, req] of poolReqMap.entries()) {
        geoapifyPlacesCalls++;
        const places = await searchGeoapifyPlaces({
          categories: req.categories,
          latitude: refLat,
          longitude: refLon,
          radiusMeters,
          limit: 15,
          conditions: req.accessibility || [],
        });
        placePools[poolKey] = places;
      }
    }

    // 5. Match Geoapify places to place_required slots from persisted pools
    const usedCandidateIdsSet = new Set<string>();
    const daysPlans: import("@/lib/krew/activity-ai.server").ItineraryDayPlan[] = [];

    let poolHits = 0;
    let poolMisses = 0;
    let candidatesRejectedOpeningHours = 0;
    let candidatesRejectedGeography = 0;
    let candidatesRejectedRequirements = 0;

    for (const day of enrichedSkeleton.days) {
      let lastSlotCoords: { latitude?: number | null; longitude?: number | null } | null =
        refLat != null && refLon != null ? { latitude: refLat, longitude: refLon } : null;

      const slots: import("@/lib/krew/activity-ai.server").ActivitySlot[] = [];

      for (const s of day.slots) {
        const mode = import("@/lib/krew/activity-ai.server").classifyActivityMode({
          kind: s.kind,
          category: s.category,
          venueFamily: s.venueFamily,
          searchIntent: s.searchIntent,
          label: s.label,
        });

        if (s.kind === "internal" || mode === "self_guided_group" || mode === "free_exploration") {
          let ideasUrl: string | null = null;
          let ideasKind: "ideas" | null = null;

          if (mode === "self_guided_group") {
            const { findIdeasResourceForActivity } = await import("@/lib/krew/activity-discovery.server");
            const foundUrl = await findIdeasResourceForActivity({
              label: s.label,
              searchIntent: s.searchIntent,
              eventType: trip.event_type,
            });
            if (foundUrl) {
              const resLink = resolveActivityResourceUrl(foundUrl, { kindHint: "ideas" });
              ideasUrl = resLink.url;
              ideasKind = resLink.resourceKind === "ideas" ? "ideas" : null;
            }
          }

          slots.push({
            moment: s.moment,
            time: s.time,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            type: s.type,
            category: s.category,
            label: s.label,
            detail: s.detail,
            locationContext: s.locationContext,
            activityMode: mode === "free_exploration" ? "free_exploration" : "self_guided_group",
            verified: Boolean(ideasUrl),
            source: "krew",
            url: ideasUrl,
            resourceKind: ideasKind,
          });

          // Reset spatial reference to lodging ONLY when locationContext === "lodging"
          if (accLat != null && accLon != null && s.locationContext === "lodging") {
            lastSlotCoords = { latitude: accLat, longitude: accLon };
          }
          continue;
        }

        const req = convertIntentToPlaceRequirements(
          s.venueFamily || "local_experience",
          s.category,
          s.searchIntent,
          aggregated.dietaryConstraints,
          Boolean(activityInput.accessibilityRequired),
          activityInput.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
        );
        const poolKey = buildPoolKey(req);
        let pool = placePools[poolKey] || [];

        const telemetryObj = {
          candidatesRejectedRequirements: 0,
          candidatesRejectedGeography: 0,
          candidatesRejectedOpeningHours: 0,
          detailsCalls: geoapifyDetailsCalls,
        };

        const { selectGeoapifyCandidate } = await import("@/lib/krew/geoapify.server");

        let matchedPlace = await selectGeoapifyCandidate({
          candidates: pool,
          req,
          usedCandidateIdsSet,
          refCoords: lastSlotCoords,
          maxKm: 50,
          date: day.date,
          time: s.time,
          durationMinutes: s.durationMinutes ?? 90,
          accessibilityRequired: Boolean(activityInput.accessibilityRequired),
          telemetry: telemetryObj,
        });

        if (matchedPlace) {
          poolHits++;
        } else if (refLat != null && refLon != null) {
          poolMisses++;
          geoapifyPlacesCalls++;
          const newPlaces = await searchGeoapifyPlaces({
            categories: req.categories,
            latitude: refLat,
            longitude: refLon,
            radiusMeters: radiusMeters * 1.5,
            limit: 15,
            conditions: req.accessibility || [],
          });
          if (newPlaces.length > 0) {
            placePools[poolKey] = mergeUniquePlacesById(pool, newPlaces);
            pool = placePools[poolKey]!;
            matchedPlace = await selectGeoapifyCandidate({
              candidates: pool,
              req,
              usedCandidateIdsSet,
              refCoords: lastSlotCoords,
              maxKm: 50,
              date: day.date,
              time: s.time,
              durationMinutes: s.durationMinutes ?? 90,
              accessibilityRequired: Boolean(activityInput.accessibilityRequired),
              telemetry: telemetryObj,
            });
          }
        }

        candidatesRejectedRequirements += telemetryObj.candidatesRejectedRequirements;
        candidatesRejectedGeography += telemetryObj.candidatesRejectedGeography;
        candidatesRejectedOpeningHours += telemetryObj.candidatesRejectedOpeningHours;
        geoapifyDetailsCalls = telemetryObj.detailsCalls;

        if (matchedPlace) {
          usedCandidateIdsSet.add(matchedPlace.id);
          if (matchedPlace.latitude != null && matchedPlace.longitude != null) {
            lastSlotCoords = { latitude: matchedPlace.latitude, longitude: matchedPlace.longitude };
          }
        }

        if (matchedPlace) {
          slots.push({
            moment: s.moment,
            time: s.time,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            type: s.type,
            category: s.category,
            venueFamily: s.venueFamily,
            searchIntent: s.searchIntent,
            locationContext: s.locationContext ?? "external",
            label: matchedPlace.name,
            detail:
              matchedPlace.address ||
              s.detail ||
              s.searchIntent ||
              "Lieu sélectionné par KREW",
            ...resolveActivityResourceUrl(matchedPlace.website, { kindHint: "website" }),
            activityMode: mode,
            candidateId: matchedPlace.id,
            verified: true,
            source: "geoapify",
            latitude: matchedPlace.latitude,
            longitude: matchedPlace.longitude,
          });
        } else {
          slots.push({
            moment: s.moment,
            time: s.time,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            type: s.type,
            category: s.category,
            venueFamily: s.venueFamily,
            searchIntent: s.searchIntent,
            locationContext: s.locationContext ?? "external",
            label: `${s.label} — lieu à choisir`,
            detail:
              s.detail ||
              s.searchIntent ||
              "Réservation ou choix du lieu à préciser",
            verified: false,
            source: "krew",
            url: null,
          });
        }
      }

      daysPlans.push({
        day: day.day,
        date: day.date ?? null,
        slots,
      });
    }

    const { adjustItineraryTransferTimes } = await import(
      "@/lib/krew/activity-ai.server"
    );
    const timeCoherentDays = adjustItineraryTransferTimes(daysPlans, activityInput);

    const telemetry = {
      geminiCalls: enrichResult.geminiCalled ? 1 : (enrichResult.usedLlm ? 1 : 0),
      geoapifyPlacesCalls,
      geoapifyDetailsCalls,
      poolHits,
      poolMisses,
      candidatesRejectedOpeningHours,
      candidatesRejectedGeography,
      candidatesRejectedRequirements,
    };

    console.info("krew-planning-telemetry", telemetry);

    const finalItinerary: import("@/lib/krew/activity-ai.server").GroupItinerary = {
      destination: destName,
      nights,
      days: timeCoherentDays,
      source: "ai",
      provider: "krew_geoapify",
      generatedAt: new Date().toISOString(),
      placePools,
      usedCandidateIds: Array.from(usedCandidateIdsSet),
      skeleton: enrichedSkeleton,
      telemetry,
    };

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: finalItinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return {
      ok: true,
      usedLlm: enrichResult.usedLlm,
      error: enrichResult.error,
      itinerary: finalItinerary,
    };
  });

/** Régénère un seul créneau du planning (sans toucher au reste). */
export const regenerateItinerarySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        day: z.number().int().min(1).max(21),
        slotIndex: z.number().int().min(0).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [tripRes, partsRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "id, owner_id, co_organizer_id, group_itinerary, group_logistics, start_date, end_date, duration_nights, participants_count, budget_per_person, event_type, celebrated_person, has_star, star_user_id",
        )
        .eq("id", data.tripId)
        .maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId),
    ]);
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut régénérer un créneau",
      );
    }
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const itinerary = (tripRes.data as any).group_itinerary as {
      destination?: string;
      nights?: number;
      days?: { day: number; date?: string | null; slots: any[] }[];
      source?: string;
      generatedAt?: string;
      placePools?: Record<string, any[]>;
      usedCandidateIds?: string[];
      skeleton?: import("@/lib/krew/activity-ai.server").KrewSkeleton;
    } | null;
    if (!itinerary?.days?.length) {
      throw new Error("Aucun planning à modifier — génère d'abord les activités");
    }

    const dayPlan = itinerary.days.find((d) => d.day === data.day) || itinerary.days[data.day - 1];
    if (!dayPlan?.slots?.[data.slotIndex]) {
      throw new Error("Créneau introuvable");
    }
    const current = dayPlan.slots[data.slotIndex];
    const avoidLabels = dayPlan.slots.map((s) => s.label).filter(Boolean);
    const usedIdsSet = new Set<string>(itinerary.usedCandidateIds ?? []);

    if (current.candidateId) {
      usedIdsSet.add(current.candidateId);
    }

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const isAccessibilityRequired = (aggregated.individualPreferences ?? []).some(
      (preference: any) => preference?.accessibilityRequired === true,
    );

    const {
      convertIntentToPlaceRequirements,
      buildPoolKey,
      searchGeoapifyPlaces,
      determineSearchRadiusMeters,
      selectGeoapifyCandidate,
      mergeUniquePlacesById,
    } = await import("@/lib/krew/geoapify.server");

    // 1. Build PlaceRequirements & canonical pool key
    const req = convertIntentToPlaceRequirements(
      current.venueFamily || "local_experience",
      current.category,
      current.searchIntent || current.label,
      aggregated.dietaryConstraints,
      isAccessibilityRequired,
      aggregated.individualPreferences?.map((p: any) => p?.mobilityNotes).filter(Boolean) || [],
    );
    const poolKey = buildPoolKey(req);

    if (!itinerary.placePools) {
      itinerary.placePools = {};
    }
    let pool = itinerary.placePools[poolKey] || [];

    // 2. Resolve coordinate reference hierarchy
    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const accRole = aggregated.groupAccommodationRole;
    let refLat: number | null = null;
    let refLon: number | null = null;

    // Hierarchy: 1. Previous slot with coordinates in same day
    const prevSlots = dayPlan.slots.slice(0, data.slotIndex);
    for (let i = prevSlots.length - 1; i >= 0; i--) {
      const pSlot = prevSlots[i];
      if (pSlot?.latitude != null && pSlot?.longitude != null) {
        refLat = Number(pSlot.latitude);
        refLon = Number(pSlot.longitude);
        break;
      }
    }

    // 2. Selected accommodation coordinates (if centerpiece/part_of_stay)
    if (refLat == null || refLon == null) {
      if ((accRole === "centerpiece" || accRole === "part_of_stay") && logistics.selectedHotelId) {
        const accRes = await supabase
          .from("accommodations")
          .select("latitude, longitude")
          .eq("id", logistics.selectedHotelId)
          .maybeSingle();
        if (accRes.data?.latitude != null && accRes.data?.longitude != null) {
          refLat = Number(accRes.data.latitude);
          refLon = Number(accRes.data.longitude);
        }
      }
    }

    // 3. Selected destination coordinates
    if (refLat == null || refLon == null) {
      const recoRes = await supabase
        .from("recommendations")
        .select("destination_id, destinations(name, country, latitude, longitude)")
        .eq("trip_id", data.tripId)
        .eq("is_selected", true)
        .maybeSingle();

      const destData = (recoRes.data as any)?.destinations;
      if (destData?.latitude != null && destData?.longitude != null) {
        refLat = Number(destData.latitude);
        refLon = Number(destData.longitude);
      }

      // 4. Geocoding fallback
      if ((refLat == null || refLon == null) && destData?.name) {
        try {
          const { geocodeDestination } = await import(
            "@/integrations/external/geo-weather.server"
          );
          const geo = await geocodeDestination(
            destData.country ? `${destData.name}, ${destData.country}` : destData.name,
          );
          if (geo) {
            refLat = geo.latitude;
            refLon = geo.longitude;
          }
        } catch {
          /* geocoding optional */
        }
      }
    }

    const refCoords = refLat != null && refLon != null ? { latitude: refLat, longitude: refLon } : null;

    // 3. First selection pass on existing persisted pool via shared selector
    let matchedCandidate = await selectGeoapifyCandidate({
      candidates: pool,
      req,
      usedCandidateIdsSet: usedIdsSet,
      avoidList: avoidLabels,
      refCoords,
      maxKm: 50,
      date: dayPlan.date,
      time: current.time,
      durationMinutes: current.durationMinutes ?? 90,
      accessibilityRequired: isAccessibilityRequired,
    });

    // 4. If no candidate found, perform exactly 1 targeted Geoapify search (0 Gemini calls)
    if (!matchedCandidate && refLat != null && refLon != null) {
      const tripProfile = aggregated.stayConcepts?.[0]?.title ?? aggregated.stayProfileAffinities?.[0]?.id ?? null;
      const radiusMeters = determineSearchRadiusMeters(
        aggregated.groupLocalMobility,
        tripProfile,
      );

      const newPlaces = await searchGeoapifyPlaces({
        categories: req.categories,
        latitude: refLat,
        longitude: refLon,
        radiusMeters: radiusMeters * 1.5,
        limit: 15,
        conditions: req.accessibility || [],
      });

      if (newPlaces.length > 0) {
        pool = mergeUniquePlacesById(pool, newPlaces);
        itinerary.placePools[poolKey] = pool;

        matchedCandidate = await selectGeoapifyCandidate({
          candidates: pool,
          req,
          usedCandidateIdsSet: usedIdsSet,
          avoidList: avoidLabels,
          refCoords,
          maxKm: 50,
          date: dayPlan.date,
          time: current.time,
          durationMinutes: current.durationMinutes ?? 90,
          accessibilityRequired: isAccessibilityRequired,
        });
      }
    }

    let updatedSlot: any;

    if (matchedCandidate) {
      usedIdsSet.add(matchedCandidate.id);
      itinerary.usedCandidateIds = Array.from(usedIdsSet);

      updatedSlot = {
        ...current,
        label: matchedCandidate.name,
        detail: matchedCandidate.address || current.detail || "Lieu sélectionné par KREW",
        ...resolveActivityResourceUrl(matchedCandidate.website, { kindHint: "website" }),
        activityMode: "bookable",
        candidateId: matchedCandidate.id,
        verified: true,
        source: "geoapify",
        latitude: matchedCandidate.latitude,
        longitude: matchedCandidate.longitude,
      };
    } else {
      updatedSlot = {
        ...current,
        label: `${current.label || "Créneau"} — lieu à choisir`,
        detail: "Toutes les alternatives locales disponibles ont été consultées",
      };
    }

    dayPlan.slots[data.slotIndex] = updatedSlot;
    itinerary.generatedAt = new Date().toISOString();

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: itinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return { ok: true, usedLlm: false, slot: updatedSlot, itinerary };
  });

/** Reco hôtels + A/R multi-modes (avion, train, bus, voiture) avec liens de réservation. */
export const proposeStayAndTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        refreshExternal: z.boolean().optional(),
        includeTransport: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check trip-level rate limit for logistics generation
    const tripWindow = Number(process.env["RATE_LIMIT_LOGISTICS_WINDOW_SEC"]) || 120;
    const tripMax = Number(process.env["RATE_LIMIT_LOGISTICS_MAX"]) || 1;
    await assertNotRateLimited(supabase, {
      tripId: data.tripId,
      userId,
      kind: "logistics",
      windowSeconds: tripWindow,
      maxCalls: tripMax,
    });

    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    const generateHotels = data.includeTransport === false;
    const generateTransport = !generateHotels;

    // Fetch active participants at the top so bedding config can use it
    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);
    if (partsRes.error) throw partsRes.error;
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");
    const isActiveMember = participants.some((p: any) => p.user_id === userId);
    if (generateHotels && !isTripAdmin(trip, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut chercher les hébergements",
      );
    }
    if (generateTransport && !isTripAdmin(trip, userId) && !isActiveMember) {
      throw new Error(
        "403 Forbidden: seuls les participants du voyage peuvent chercher les transports",
      );
    }

    const selected = await supabase
      .from("recommendations")
      .select(
        "id, accommodation_id, destination_id, destinations(id, name, country, distance_from_paris_km)",
      )
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) throw new Error("Valide d'abord une destination");

    const dest = (selected.data as any).destinations;
    const destName = String(dest?.name || "Destination");
    const destCountry = String(dest?.country || "");
    const destId = dest?.id || (selected.data as any).destination_id;
    const distanceKm = Number(dest?.distance_from_paris_km) || 800;

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const providerErrors: string[] = [];
    const budget = Number(aggregated.aggregatedBudget) || Number(trip.budget_per_person) || 400;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const days = Math.round(
          (new Date(trip.end_date + "T12:00:00Z").getTime() -
            new Date(trip.start_date + "T12:00:00Z").getTime()) /
            86400000,
        );
        if (days >= 1) return days;
      }
      return Number(trip.duration_nights) || 2;
    })();
    const checkin =
      (trip.start_date as string) ||
      new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const checkout =
      (trip.end_date as string) ||
      new Date(new Date(checkin).getTime() + nights * 86400000).toISOString().slice(0, 10);
    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);
    const adults = Math.min(Math.max(1, effCount), 8);
    let topHotels: any[] = [];

    let accommodationMeta: import("@/lib/krew/accommodation-ai.server").AccommodationGenerationMeta | undefined;

    if (generateHotels) {
      const concepts = await import("@/lib/krew/accommodation-concepts");
      const accAi = await import("@/lib/krew/accommodation-ai.server");
      const singleRooms = aggregated.individualPreferences.filter((preference: any) => {
        const room = String(preference.roomTypePreference ?? "").toLowerCase();
        return (
          preference.acceptsSharedRoom === false ||
          room.includes("individuelle") ||
          room.includes("single")
        );
      }).length;
      const roomConfiguration = concepts.calculateRoomConfiguration(effCount, singleRooms);
      const conceptScores = concepts.scoreAccommodationConcepts({
        affinities: aggregated.stayProfileAffinities ?? [],
        ageRange: aggregated.groupAgeRange,
        groupSize: effCount,
        needsCityCenter: (aggregated as any).needsCityCenter,
      });
      const selectedStrategies = concepts.selectAccommodationStrategies(conceptScores);
      const allocation = concepts.resultsAllocation(selectedStrategies.length);
      const topProfiles = [...(aggregated.stayProfileAffinities ?? [])]
        .sort((a: any, b: any) => b.score - a.score)
        .map((profile: any) => profile.id);
      const locationMode = concepts.resolveAccommodationLocationIntent({
        topProfiles,
        localMobility: aggregated.groupLocalMobility ?? null,
        accommodationRole:
          aggregated.individualPreferences.find((preference: any) => preference.accommodationRole)
            ?.accommodationRole ?? null,
        needsCityCenter: (aggregated as any).needsCityCenter,
      });
      const requiredAmenities = aggregated.requiredAmenities ?? [];
      const hardBase = aggregated.hasBudgetVeto
        ? aggregated.vetoBudgetMax
        : aggregated.minGroupBudget;
      const specification: import("@/lib/krew/accommodation-ai.server").AccommodationSearchSpecification =
        {
          destination: { name: destName, country: destCountry },
          dates: { checkIn: checkin, checkOut: checkout, nights },
          group: {
            size: effCount,
            targetBedrooms: roomConfiguration.targetBedrooms,
            singleRooms: roomConfiguration.singleRooms,
            sharedRoomsOrEquivalent: roomConfiguration.doubleRooms,
          },
          budget: {
            targetPerPersonStay: budget * 0.35,
            hardMaxPerPersonStay: hardBase != null ? Number(hardBase) * 0.35 : null,
          },
          searchStrategies: selectedStrategies.map((strategy, index) => ({
            concept: strategy.concept,
            score: strategy.score,
            priority: index + 1,
            resultsWanted: allocation[index] ?? 1,
            propertyTypes: concepts.ACCOMMODATION_PROPERTY_TYPES[strategy.concept],
            mustHave: requiredAmenities,
            preferred: [],
          })),
          locationIntent: {
            mode: locationMode,
            priority: (aggregated as any).needsCityCenter === true ? "required" : "preferred",
            carAccepted: ["car_ok", "car_if_worth_it"].includes(
              aggregated.groupLocalMobility ?? "",
            ),
          },
          minimumRating: Number(aggregated.minAccommodationRating) || null,
          requiredAmenities,
          accessibilityRequired: aggregated.individualPreferences.some(
            (preference: any) => preference.accessibilityRequired === true,
          ),
        };

      const currentLogistics = (trip.group_logistics as any) || {};
      const reqHash = accAi.computeAccommodationRequestHash(data.tripId, specification);
      const currentMeta = currentLogistics.accommodationGeneration;
      const existingHotels = Array.isArray(currentLogistics.hotels) ? currentLogistics.hotels : [];

      const COOLDOWN_MS = 5 * 60 * 1000;
      let geminiCalled = false;

      const isRecentSame429 =
        currentMeta &&
        currentMeta.requestHash === reqHash &&
        currentMeta.status === "rate_limited" &&
        Date.now() - new Date(currentMeta.attemptedAt).getTime() < COOLDOWN_MS;

      const isRecentValidHash =
        currentMeta &&
        currentMeta.requestHash === reqHash &&
        currentMeta.status === "success" &&
        existingHotels.length > 0;

      if (isRecentValidHash) {
        topHotels = existingHotels;
        accommodationMeta = {
          ...currentMeta,
          completedAt: new Date().toISOString(),
        };
      } else if (isRecentSame429) {
        topHotels = existingHotels;
        accommodationMeta = {
          ...currentMeta,
          userMessage: "Recherche de logements momentanément indisponible. Réessaie un peu plus tard.",
        };
        providerErrors.push("Gemini accommodation rate limit cooldown active");
      } else {
        // Atomic acquisition via Supabase RPC function (fail-closed on error)
        let lockAcquired = false;
        let rpcGeneration: any = null;
        try {
          const rpcRes = await supabase.rpc("acquire_accommodation_generation_lock" as any, {
            p_trip_id: data.tripId,
            p_request_hash: reqHash,
            p_stale_after_seconds: 120,
          });
          const rpcData = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;
          if (rpcData) {
            lockAcquired = Boolean(rpcData.acquired);
            rpcGeneration = rpcData.generation;
          }
        } catch (rpcErr) {
          console.warn("acquire_accommodation_generation_lock RPC call failed:", rpcErr);
          lockAcquired = false; // FAIL-CLOSED: No lock acquired = NO Gemini call
        }

        if (!lockAcquired) {
          topHotels = existingHotels;
          accommodationMeta = {
            ...(rpcGeneration || currentMeta),
            status: (rpcGeneration?.status as any) || "error",
            userMessage: rpcGeneration?.userMessage || "Recherche de logements momentanément indisponible. Réessaie un peu plus tard.",
          };
        } else {
          const attemptedAt = new Date().toISOString();
          try {
            geminiCalled = true;
            topHotels = await accAi.searchAccommodationsWithGemini(specification);
            accommodationMeta = {
              status: topHotels.length > 0 ? "success" : "empty",
              requestHash: reqHash,
              attemptedAt,
              completedAt: new Date().toISOString(),
              userMessage: topHotels.length === 0 ? "Aucun logement disponible pour ces critères." : null,
            };

            // Upsert valid candidates with HTTPS booking URL to the accommodations table using canonical external IDs
            const validHotelsForDb = topHotels.filter(
              (hotel) => hotel.url && typeof hotel.url === "string" && hotel.url.startsWith("https://"),
            );
            if (validHotelsForDb.length > 0) {
              try {
                const accsToUpsert = validHotelsForDb.map((hotel) => ({
                  external_id: accAi.buildCanonicalAccommodationExternalId(destName, hotel),
                  name: hotel.name,
                  destination_id: destId,
                  type: hotel.propertyType || "hotel",
                  rating: hotel.rating,
                  review_count: hotel.reviewCount,
                  price_per_night: hotel.pricePerPerson,
                  booking_url: hotel.url,
                  image_url: hotel.imageUrl,
                  krew_concept: hotel.krewConcept,
                  source: hotel.source || "gemini_grounded",
                  updated_at: new Date().toISOString(),
                }));
                const { data: upsertedAccs } = await supabase
                  .from("accommodations")
                  .upsert(accsToUpsert, { onConflict: "external_id" })
                  .select("id, external_id, name");

                if (upsertedAccs) {
                  const accMap = new Map(upsertedAccs.map((a: any) => [a.external_id, a.id]));
                  topHotels = topHotels.map((hotel) => {
                    const extId = accAi.buildCanonicalAccommodationExternalId(destName, hotel);
                    const dbId = accMap.get(extId);
                    if (dbId) {
                      return {
                        ...hotel,
                        id: dbId, // Map canonical Supabase UUID as primary hotel.id
                        accommodation_id: dbId,
                      };
                    }
                    return hotel;
                  });
                }
              } catch (accErr) {
                console.warn("Accommodations database upsert skipped:", accErr);
              }
            }
          } catch (error) {
            const errStr = String(error);
            const is429 = errStr.includes("rate_limited") || errStr.includes("429");
            providerErrors.push(errStr.slice(0, 180));
            accommodationMeta = {
              status: is429 ? "rate_limited" : "error",
              requestHash: reqHash,
              attemptedAt,
              completedAt: new Date().toISOString(),
              userMessage: is429
                ? "Recherche de logements momentanément indisponible. Réessaie un peu plus tard."
                : "Erreur lors de la recherche des logements.",
            };
          }
        }
      }

      console.info("[Accommodation generation]", {
        workflow: "accommodation",
        tripId: data.tripId,
        requestHash: reqHash,
        geminiCalls: geminiCalled ? 1 : 0,
        cacheHit: Boolean(isRecentValidHash),
        status: accommodationMeta?.status,
        resultCount: topHotels.length,
      });
    }

    // ——— A/R multi-modes ———
    const tripOrigin = (trip.departure_city as string) || "Paris";
    const planeRefused = Boolean((aggregated as any).planeRefused);

    // Fetch trip participant preferences for departure cities and travel options
    const prefsRes = await supabase
      .from("trip_participant_preferences")
      .select(
        "user_id, departure_city, max_travel_duration_hours, transport_mode_accepted, room_type_preference, accepts_shared_room",
      )
      .eq("trip_id", data.tripId);
    const prefsList = prefsRes.data ?? [];

    // Fetch transport time preferences
    const timePrefsRes = await supabase
      .from("trip_transport_time_prefs")
      .select(
        "participant_id, earliest_departure_time, latest_return_time, latest_arrival_time, earliest_return_departure_time",
      )
      .eq("trip_id", data.tripId);
    const timePrefsList = timePrefsRes.data ?? [];

    const norm = (s: string) => s.trim().toLowerCase();

    // Map each active participant to their configuration
    const participantConfigs = participants.map((p: any) => {
      const pref = prefsList.find((pr: any) => pr.user_id === p.user_id);
      const tp = timePrefsList.find((t: any) => t.participant_id === p.id);

      const departureCity = (pref?.departure_city || tripOrigin).trim();
      const earliestDepartureTime = tp?.earliest_departure_time || null;
      const latestArrivalTime = tp?.latest_arrival_time || null;
      const earliestReturnDepartureTime = tp?.earliest_return_departure_time || null;
      const latestReturnTime = tp?.latest_return_time || null;
      const maxTravelDurationHours =
        pref?.max_travel_duration_hours != null ? Number(pref.max_travel_duration_hours) : null;
      const transportModeAccepted = Array.isArray(pref?.transport_mode_accepted)
        ? pref.transport_mode_accepted
        : ["peu importe"];

      return {
        participantId: p.id,
        displayName: p.display_name || p.email?.split("@")[0] || "Ami",
        departureCity,
        earliestDepartureTime,
        latestArrivalTime,
        earliestReturnDepartureTime,
        latestReturnTime,
        maxTravelDurationHours,
        transportModeAccepted,
      };
    });

    // Group participants into homogeneous sub-groups sharing departure city and constraints
    const subGroups: {
      key: string;
      departureCity: string;
      earliestDepartureTime: string | null;
      latestArrivalTime: string | null;
      earliestReturnDepartureTime: string | null;
      latestReturnTime: string | null;
      maxTravelDurationHours: number | null;
      transportModeAccepted: string[];
      participants: { participantId: string; displayName: string }[];
    }[] = [];

    for (const conf of participantConfigs) {
      const modesKey = [...conf.transportModeAccepted].sort().join(",");
      const key = `${norm(conf.departureCity)}|${conf.earliestDepartureTime || ""}|${conf.latestArrivalTime || ""}|${conf.earliestReturnDepartureTime || ""}|${conf.latestReturnTime || ""}|${conf.maxTravelDurationHours || ""}|${modesKey}`;

      let grp = subGroups.find((g) => g.key === key);
      if (!grp) {
        grp = {
          key,
          departureCity: conf.departureCity,
          earliestDepartureTime: conf.earliestDepartureTime,
          latestArrivalTime: conf.latestArrivalTime,
          earliestReturnDepartureTime: conf.earliestReturnDepartureTime,
          latestReturnTime: conf.latestReturnTime,
          maxTravelDurationHours: conf.maxTravelDurationHours,
          transportModeAccepted: conf.transportModeAccepted,
          participants: [],
        };
        subGroups.push(grp);
      }
      grp.participants.push({ participantId: conf.participantId, displayName: conf.displayName });
    }

    if (subGroups.length === 0) {
      subGroups.push({
        key: "fallback",
        departureCity: tripOrigin,
        earliestDepartureTime: null,
        latestArrivalTime: null,
        earliestReturnDepartureTime: null,
        latestReturnTime: null,
        maxTravelDurationHours: null,
        transportModeAccepted: ["peu importe"],
        participants: [{ participantId: "fallback", displayName: "Groupe" }],
      });
    }

    const { searchTransportRoundTrip, estimateTransportFromDistance } =
      await import("@/integrations/external/transport.server");

    const baseFlight = estimateTransportFromDistance(distanceKm);
    const priceForMode = (mode: string): number => {
      switch (mode) {
        case "flight":
          return Math.round(baseFlight);
        case "train":
          return Math.round(
            baseFlight * (distanceKm <= 500 ? 0.85 : distanceKm <= 900 ? 1.05 : 1.25),
          );
        case "bus":
          return Math.round(baseFlight * 0.45);
        case "car":
          return Math.round(Math.max(35, distanceKm * 0.12 * 2) / Math.max(2, adults / 2));
        case "covoiturage":
          return Math.round((Math.max(35, distanceKm * 0.12 * 2) / Math.max(2, adults / 2)) * 0.85);
        case "ferry":
          return Math.round(baseFlight * 0.7);
        default:
          return Math.round(baseFlight);
      }
    };

    const estimateDurationForMode = (mode: string, dist: number): number => {
      switch (mode) {
        case "flight":
          return Math.round((dist / 750 + 3.0) * 10) / 10;
        case "train":
          return Math.round((dist / 200 + 1.0) * 10) / 10;
        case "bus":
          return Math.round((dist / 75 + 1.5) * 10) / 10;
        case "car":
        case "covoiturage":
          return Math.round((dist / 100 + 1.0) * 10) / 10;
        case "ferry":
          return Math.round((dist / 35 + 2.0) * 10) / 10;
        default:
          return Math.round((dist / 100 + 1.5) * 10) / 10;
      }
    };

    const linksForMode = (mode: string, from: string, to: string, groupSize: number) => {
      const f = encodeURIComponent(from);
      const d = encodeURIComponent(to);
      const gAdults = Math.min(Math.max(1, groupSize), 9);
      if (mode === "flight") {
        return [
          {
            label: "Kayak (vol)",
            url: `https://www.kayak.fr/flights/${f}-${d}/${checkin}/${checkout}?adults=${gAdults}&sort=price_a`,
          },
        ];
      }
      if (mode === "train") {
        return [
          {
            label: "SNCF Connect",
            url: `https://www.sncf-connect.com/app/home/search/?originLabel=${f}&destinationLabel=${d}&outwardDate=${checkin}&inwardDate=${checkout}&passengers=${gAdults}`,
          },
          {
            label: "Trainline",
            url: `https://www.thetrainline.com/search/${f}/${d}/${checkin}/${checkout}`,
          },
        ];
      }
      if (mode === "covoiturage") {
        return [
          {
            label: "Voir l’aller",
            url: `https://www.blablacar.fr/search?fn=${f}&tn=${d}&db=${checkin}`,
          },
          {
            label: "Voir le retour",
            url: `https://www.blablacar.fr/search?fn=${d}&tn=${f}&db=${checkout}`,
          },
        ];
      }
      // default / car / others
      return [
        {
          label: "Google Maps",
          url: `https://www.google.com/maps/dir/${f}/${d}`,
        },
      ];
    };

    type TransportCard = {
      city: string;
      count: number;
      pricePerPerson: number;
      mode: string;
      modeLabel: string;
      label: string;
      url: string | null;
      searchUrl?: string | null;
      provider?: string | null;
      note?: string;
      links: { label: string; url: string }[];
      durationHours: number;
      subGroupKey?: string;
      participantIds?: string[];
      earliestDepartureTime?: string | null;
      latestArrivalTime?: string | null;
      earliestReturnDepartureTime?: string | null;
      latestReturnTime?: string | null;
      respectedConstraints?: string[];
      dataKind?: "provider_offer" | "public_fare" | "external_search" | "krew_estimate";
      providerOffer?: import("@/integrations/external/transport.server").TransportQuote | null;
      score?: number;
      matchReasons?: string[];
    };

    const modeMeta: { mode: string; modeLabel: string; enabled: boolean }[] = [
      { mode: "flight", modeLabel: "Avion", enabled: !planeRefused && distanceKm >= 250 },
      // Providers futurs : ne pas matérialiser une estimation de distance comme une offre réelle.
      { mode: "train", modeLabel: "Train", enabled: distanceKm <= 1200 },
      { mode: "car", modeLabel: "Voiture", enabled: distanceKm <= 1000 },
      { mode: "covoiturage", modeLabel: "Covoiturage", enabled: distanceKm <= 800 },
      { mode: "ferry", modeLabel: "Ferry", enabled: false },
    ];

    const transports: TransportCard[] = [];

    for (const group of generateTransport ? subGroups : []) {
      const from = group.departureCity;
      const acceptedModes = group.transportModeAccepted.map((m) => m.toLowerCase().trim());
      const hasModeFilter = acceptedModes.length > 0 && !acceptedModes.includes("peu importe");

      let flightApiQuote: import("@/integrations/external/transport.server").TransportQuote | null =
        null;
      let trainFare: import("@/integrations/external/sncf-fares.server").SncfRoundTripFares | null =
        null;
      const isFlightAllowed =
        !planeRefused &&
        (!hasModeFilter || acceptedModes.some((m) => m.includes("avion") || m.includes("flight")));

      if (isFlightAllowed && distanceKm >= 250) {
        try {
          const apiQuote = await searchTransportRoundTrip({
            originCity: from,
            destinationCity: destName,
            departDate: checkin,
            returnDate: checkout,
            adults: Math.min(Math.max(1, group.participants.length), 9),
            distanceKm,
            earliestDepartureTime: group.earliestDepartureTime,
            latestArrivalTime: group.latestArrivalTime,
            earliestReturnDepartureTime: group.earliestReturnDepartureTime,
            latestReturnTime: group.latestReturnTime,
          });
          if (apiQuote?.pricePerPerson > 0) {
            const hasImperativeTimeConstraint = Boolean(
              group.earliestDepartureTime ||
              group.latestArrivalTime ||
              group.earliestReturnDepartureTime ||
              group.latestReturnTime,
            );
            if (!(apiQuote.dataKind === "krew_estimate" && hasImperativeTimeConstraint))
              flightApiQuote = apiQuote;
          }
        } catch (e) {
          providerErrors.push(`transport ${from}: ${String(e).slice(0, 80)}`);
        }
      }
      if (
        (!hasModeFilter || acceptedModes.some((m) => m.includes("train"))) &&
        distanceKm <= 1200
      ) {
        try {
          const { searchSncfRoundTripFares } =
            await import("@/integrations/external/sncf-fares.server");
          trainFare = await searchSncfRoundTripFares(from, destName);
        } catch (e) {
          providerErrors.push(`SNCF Open Data ${from}: ${String(e).slice(0, 80)}`);
        }
      }

      for (const m of modeMeta) {
        if (!m.enabled) continue;

        if (hasModeFilter) {
          const matched = acceptedModes.some((am) => {
            if (m.mode === "flight") return am.includes("avion") || am.includes("flight");
            if (m.mode === "train") return am.includes("train");
            if (m.mode === "car") return am.includes("voiture") || am.includes("car");
            if (m.mode === "covoiturage")
              return am.includes("covoit") || am.includes("share") || am.includes("car");
            if (m.mode === "ferry") return am.includes("ferry") || am.includes("bateau");
            return false;
          });
          if (!matched) continue;
        }

        const duration =
          m.mode === "flight" && flightApiQuote?.outboundDurationMinutes
            ? Math.round((flightApiQuote.outboundDurationMinutes / 60) * 10) / 10
            : estimateDurationForMode(m.mode, distanceKm);

        if (group.maxTravelDurationHours != null && group.maxTravelDurationHours > 0) {
          if (duration > group.maxTravelDurationHours) {
            continue;
          }
        }

        let price = priceForMode(m.mode);
        let directUrl: string | null = null;
        let exactSearchUrl: string | null = null;
        let providerName: string | null = null;
        let flightOutsideWindow = false;

        if (m.mode === "flight" && flightApiQuote) {
          price = Math.round(flightApiQuote.pricePerPerson);
          directUrl = flightApiQuote.url ?? null;
          exactSearchUrl = flightApiQuote.searchUrl ?? null;
          providerName = flightApiQuote.provider ?? "kayak";
          flightOutsideWindow = !!flightApiQuote.outsideTimeWindow;
        }
        if (m.mode === "train" && trainFare) {
          price = Math.round(
            (trainFare.roundTripFareRange.min + trainFare.roundTripFareRange.max) / 2,
          );
          providerName = "SNCF Open Data";
        }

        const modeLinks = linksForMode(m.mode, from, destName, group.participants.length);
        if (!exactSearchUrl && modeLinks[0]) {
          exactSearchUrl = modeLinks[0].url;
        }

        const primaryUrl = directUrl || exactSearchUrl || modeLinks[0]?.url || null;

        const links: { label: string; url: string }[] = [];
        if (directUrl) {
          links.push({ label: "Voir l'offre directe", url: directUrl });
        }
        for (const ml of modeLinks) {
          if (!links.some((l) => l.url === ml.url)) {
            links.push(ml);
          }
        }

        const respectedConstraints: string[] = [];
        if (group.earliestDepartureTime) {
          respectedConstraints.push(`Départ après ${group.earliestDepartureTime}`);
        }
        if (group.latestArrivalTime) {
          respectedConstraints.push(`Arrivée avant ${group.latestArrivalTime}`);
        }
        if (group.earliestReturnDepartureTime) {
          respectedConstraints.push(`Retour après ${group.earliestReturnDepartureTime}`);
        }
        if (group.latestReturnTime) {
          respectedConstraints.push(`Retour avant ${group.latestReturnTime}`);
        }
        if (group.maxTravelDurationHours) {
          respectedConstraints.push(
            `Durée < ${group.maxTravelDurationHours}h (porte-à-porte ~${duration}h)`,
          );
        }

        const { score: scoreVal, matchReasons: matchReasonsList } = scoreTransportOption(
          {
            mode: m.mode,
            pricePerPerson: price,
            durationHours: duration,
            respectedConstraints,
            outsideTimeWindow: m.mode === "flight" ? flightOutsideWindow : false,
          } as any,
          budget,
          group.maxTravelDurationHours,
        );

        // Proposition de trajet partagé si un autre participant a fait ce choix
        const currentLogistics = (trip.group_logistics as any) || {};
        const otherPicks = Array.isArray(currentLogistics.transportPicks)
          ? currentLogistics.transportPicks
          : [];
        const matchingPick = otherPicks.find(
          (pk: any) =>
            norm(pk.city || "") === norm(from) &&
            norm(pk.mode || "") === norm(m.mode) &&
            !group.participants.some((p) => p.participantId === pk.userId),
        );
        if (matchingPick) {
          matchReasonsList.push(
            `Choisi par ${matchingPick.displayName} — vous pouvez voyager ensemble !`,
          );
        }

        transports.push({
          city: from,
          count: group.participants.length,
          pricePerPerson: price,
          mode: m.mode,
          modeLabel: m.modeLabel,
          label: `A/R ${m.modeLabel.toLowerCase()} ${from} → ${destName}`,
          url: primaryUrl,
          searchUrl: exactSearchUrl,
          provider: providerName,
          dataKind:
            m.mode === "train" && trainFare
              ? "public_fare"
              : m.mode === "flight" && flightApiQuote
                ? (flightApiQuote.dataKind ?? "provider_offer")
                : "krew_estimate",
          providerOffer: m.mode === "flight" ? flightApiQuote : null,
          note:
            m.mode === "train" && trainFare
              ? "tarif public indicatif A/R — horaires inconnus"
              : m.mode === "flight" && flightApiQuote
                ? flightApiQuote.dataKind === "krew_estimate"
                  ? "estimation KREW — aucun tarif fournisseur vérifié"
                  : providerName
                    ? `prix ${providerName} réel`
                    : "prix API réel"
                : "prix indicatif basé sur la distance",
          links: links.slice(0, 4),
          durationHours: duration,
          subGroupKey: group.key,
          participantIds: group.participants.map((p) => p.participantId),
          earliestDepartureTime: group.earliestDepartureTime,
          latestArrivalTime: group.latestArrivalTime,
          earliestReturnDepartureTime: group.earliestReturnDepartureTime,
          latestReturnTime: group.latestReturnTime,
          respectedConstraints,
          score: scoreVal,
          matchReasons: matchReasonsList,
        });
      }
    }

    // Tri : par ville puis prix croissant
    transports.sort((a, b) => a.city.localeCompare(b.city) || a.pricePerPerson - b.pricePerPerson);

    // Mise à jour additive : une génération conserve l'autre domaine, ses votes et ses statuts.
    const prev = (trip.group_logistics as any) || {};
    const common = { destination: destName, country: destCountry, nights, checkin, checkout };
    const logisticsWithVotes = generateHotels
      ? {
          ...(await import("@/lib/krew/accommodation-ai.server")).mergeAccommodationLogistics(
            { ...prev, ...common },
            topHotels,
            providerErrors,
            accommodationMeta,
          ),
        }
      : {
          ...prev,
          ...common,
          transports,
          transportProviderErrors: providerErrors,
          transportsGeneratedAt: new Date().toISOString(),
        };

    await supabase
      .from("trips")
      .update({ group_logistics: logisticsWithVotes, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);

    return { ok: true, logistics: logisticsWithVotes };
  });

/** Vote hôtel (1 vote / user, toggle). Stocké dans group_logistics.hotelVotes */
export const voteHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), hotelId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const votes: { userId: string; hotelId: string; at: string }[] = Array.isArray(
      logistics.hotelVotes,
    )
      ? [...logistics.hotelVotes]
      : [];
    const existing = votes.findIndex((v) => v.userId === userId);
    if (existing >= 0) {
      if (votes[existing]!.hotelId === data.hotelId) {
        votes.splice(existing, 1); // toggle off
      } else {
        votes[existing] = { userId, hotelId: data.hotelId, at: new Date().toISOString() };
      }
    } else {
      votes.push({ userId, hotelId: data.hotelId, at: new Date().toISOString() });
    }

    // Top hôtel = plus de votes (pour la to-do orga)
    const counts = new Map<string, number>();
    for (const v of votes) counts.set(v.hotelId, (counts.get(v.hotelId) || 0) + 1);
    let topId: string | null = null;
    let topN = 0;
    for (const [id, n] of counts) {
      if (n > topN) {
        topN = n;
        topId = id;
      }
    }

    const next = {
      ...logistics,
      hotelVotes: votes,
      selectedHotelId: topId,
      hotelVoteTodo: topId
        ? `Réserver l'hôtel plébiscité (${topN} vote${topN > 1 ? "s" : ""})`
        : "Faire voter le groupe sur un hôtel",
    };

    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    if (topId && !topId.startsWith("portal-")) {
      await supabase
        .from("recommendations")
        .update({ accommodation_id: topId })
        .eq("trip_id", data.tripId)
        .eq("is_selected", true);
    }

    return { ok: true, hotelVotes: votes, selectedHotelId: topId };
  });

/** Choix de trajet perso (par ville de départ). Visible aux autres de la même ville. */
export const pickTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        city: z.string().min(1).max(80),
        mode: z.string().min(1).max(40),
        modeLabel: z.string().optional(),
        label: z.string().min(1).max(160),
        time: z.string().max(40).optional(),
        /** Heure d'arrivée sur place (aller) HH:mm */
        arrivalTime: z.string().max(10).optional().nullable(),
        /** Heure de départ retour HH:mm */
        departureTime: z.string().max(10).optional().nullable(),
        durationHours: z.number().positive().max(72).optional().nullable(),
        outboundDepartureTime: z.string().max(10).optional().nullable(),
        returnArrivalTime: z.string().max(10).optional().nullable(),
        pricePerPerson: z.number().optional(),
        url: z.string().url().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    // Nom affiché
    let displayName = "Participant";
    try {
      const p = await supabase
        .from("trip_participants")
        .select("display_name, email")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle();
      displayName =
        (p.data as any)?.display_name ||
        String((p.data as any)?.email || "").split("@")[0] ||
        "Participant";
    } catch {
      /* ignore */
    }

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const picks: any[] = Array.isArray(logistics.transportPicks)
      ? [...logistics.transportPicks]
      : [];
    const idx = picks.findIndex((p) => p.userId === userId);
    const entry = {
      userId,
      displayName,
      city: data.city,
      mode: data.mode,
      modeLabel: data.modeLabel || data.mode,
      label: data.label,
      time: data.time || data.arrivalTime || null,
      arrivalTime: data.arrivalTime || data.time || null,
      departureTime: data.departureTime || null,
      durationHours: data.durationHours ?? null,
      outboundDepartureTime: data.outboundDepartureTime || null,
      returnArrivalTime: data.returnArrivalTime || null,
      pricePerPerson: data.pricePerPerson ?? null,
      url: data.url || null,
      at: new Date().toISOString(),
    };
    if (idx >= 0) picks[idx] = entry;
    else picks.push(entry);

    const next = { ...logistics, transportPicks: picks };
    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, pick: entry, transportPicks: picks };
  });

/** Filtres orga : fenêtres d'arrivée (jour 1) et départ (dernier jour) pour orienter recherches + planning. */
export const setTransportTimeFilters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        /** Arriver avant cette heure le jour 1 (HH:mm) */
        arriveBy: z.string().max(10).optional().nullable(),
        /** Ne pas repartir avant cette heure le dernier jour (HH:mm) */
        departAfter: z.string().max(10).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut définir les filtres horaires",
      );
    }
    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const next = {
      ...logistics,
      timeFilters: {
        arriveBy: data.arriveBy || null,
        departAfter: data.departAfter || null,
      },
    };
    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, timeFilters: next.timeFilters };
  });

/** Enregistre ou met à jour le feedback (pouce haut / pouce bas) pour une destination shortlistée. */
export const reactToRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        reaction: z.enum(["like", "dislike"]).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    // Trouve le participant rattaché à cet utilisateur dans le voyage
    const { data: participant, error: partErr } = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", data.tripId)
      .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
      .maybeSingle();

    if (partErr || !participant) {
      throw new Error("Participant non trouvé pour cet utilisateur");
    }

    if (data.reaction === null) {
      const { error } = await supabase
        .from("destination_feedback")
        .delete()
        .eq("trip_id", data.tripId)
        .eq("recommendation_id", data.recommendationId)
        .eq("participant_id", participant.id);
      if (error) throw error;
      return { ok: true, reaction: null };
    } else {
      const { error } = await supabase.from("destination_feedback").upsert(
        {
          trip_id: data.tripId,
          recommendation_id: data.recommendationId,
          participant_id: participant.id,
          reaction: data.reaction,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "trip_id,recommendation_id,participant_id",
        },
      );
      if (error) throw error;
      return { ok: true, reaction: data.reaction };
    }
  });

export const createGroupPaymentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    // 1. Get participant
    const { data: participant, error: partErr } = await supabase
      .from("trip_participants")
      .select("id, email, display_name")
      .eq("trip_id", data.tripId)
      .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
      .maybeSingle();

    if (partErr || !participant) {
      throw new Error("Participant non trouvé pour cet utilisateur");
    }

    // 2. Get cost split
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error || !trip.data) throw new Error("Voyage introuvable");

    const reco = await supabase
      .from("recommendations")
      .select("*, destinations(name, distance_from_paris_km)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (reco.error || !reco.data) throw new Error("Aucune proposition validée");

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const { buildCostSplit } = await import("@/lib/krew/cost-split");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    let departureOrigins =
      aggregated.departureOrigins && aggregated.departureOrigins.length > 0
        ? aggregated.departureOrigins
        : [{ city: tripOrigin, count: Math.max(1, Number(trip.data.participants_count) || 1) }];

    const budget = (reco.data.budget ?? {}) as any;
    const transportByOrigin =
      Array.isArray(budget.transportByOrigin) && budget.transportByOrigin.length
        ? budget.transportByOrigin
        : departureOrigins.map((o: any) => ({
            city: o.city,
            count: o.count,
            pricePerPerson: Number(budget.transport ?? 0),
          }));

    const { data: prefData } = await supabase
      .from("trip_participant_preferences")
      .select("departure_city")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();

    const pCity = prefData?.departure_city || tripOrigin;
    const cityRow =
      transportByOrigin.find((o: any) => o.city.toLowerCase() === pCity.toLowerCase()) ||
      transportByOrigin[0];

    const participantsCount = Number(trip.data.participants_count) || 2;
    const split = buildCostSplit({
      destinationName:
        (reco.data as any).destinations?.name || budget.destinationName || "Destination",
      accommodation: Number(budget.accommodation ?? 0),
      activities: Number(budget.activities ?? 0),
      food: Number(budget.food ?? 0),
      origins: transportByOrigin,
      fallbackTransportPerPerson: Number(budget.transport ?? 0),
      participants: participantsCount,
    });

    const userLine =
      split.lines.find((l) => l.city.toLowerCase() === pCity.toLowerCase()) || split.lines[0];

    const fallbackTransport = Number(budget.transport ?? 0);
    const sharedCost =
      (Number(budget.accommodation ?? 0) +
        Number(budget.activities ?? 0) +
        Number(budget.food ?? 0)) /
      participantsCount;
    const totalPerPerson = userLine ? userLine.totalPerPerson : fallbackTransport + sharedCost;

    if (totalPerPerson <= 0) {
      throw new Error("Le montant calculé pour ce séjour est invalide.");
    }

    const amountCents = totalPerPerson * 100;
    const feePercent = Number(process.env["KREW_PLATFORM_FEE_PERCENT"]) || 0;
    const platformFeeCents = Math.round(amountCents * (feePercent / 100));

    const stripeSecret = process.env["STRIPE_SECRET_KEY"];
    if (!stripeSecret) {
      console.warn("STRIPE_SECRET_KEY non définie, simulation de session");
      const { data: fakePayment, error: fakeErr } = await supabase
        .from("trip_payments")
        .insert({
          trip_id: data.tripId,
          participant_id: participant.id,
          amount_cents: amountCents,
          currency: "eur",
          status: "pending",
          stripe_session_id: "fake_session_" + Date.now(),
          platform_fee_cents: platformFeeCents,
        })
        .select("*")
        .single();
      if (fakeErr) throw fakeErr;

      return {
        sessionId: "fake_session",
        url: `${process.env["VITE_APP_URL"] || "http://localhost:3000"}/trips/${data.tripId}/recap?payment_success=true&session_id=${fakePayment.stripe_session_id}`,
      };
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" as any });

    const destName = (reco.data as any).destinations?.name || "Séjour Krew";
    const originUrl = process.env["VITE_APP_URL"] || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Votre part du voyage - ${destName}`,
              description: `Séjour à ${destName} incluant transport depuis ${pCity} et part égale hébergement/activités/repas.`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${originUrl}/trips/${data.tripId}/recap?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${originUrl}/trips/${data.tripId}/recap?payment_cancel=true`,
      metadata: {
        tripId: data.tripId,
        participantId: participant.id,
      },
    });

    const { error: insertErr } = await supabase.from("trip_payments").insert({
      trip_id: data.tripId,
      participant_id: participant.id,
      amount_cents: amountCents,
      currency: "eur",
      status: "pending",
      stripe_session_id: session.id,
      platform_fee_cents: platformFeeCents,
    });
    if (insertErr) {
      console.error("Erreur lors de l'enregistrement du paiement en base", insertErr);
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  });

export function mergeGeneratedPreparationTasks(input: {
  tripId: string;
  generatedTasks: { id: string; label: string }[];
  existingTasks: any[];
  assigneeIds?: string[];
}) {
  let assigneeIndex = 0;
  return input.generatedTasks.flatMap((generatedTask) => {
    const slotId = `prep:${generatedTask.id}`;
    const existing = input.existingTasks.find((task) => task.slot_id === slotId);
    const normalizedLabel = generatedTask.label.trim().toLocaleLowerCase("fr");
    const equivalentExisting = input.existingTasks.some((task) => {
      if (task.slot_id === slotId) return false;
      const title = String(task.title || "")
        .trim()
        .toLocaleLowerCase("fr");
      return title === normalizedLabel || title.startsWith(`${normalizedLabel} :`);
    });
    if (!existing && equivalentExisting) return [];
    const assignedId =
      existing?.assigned_participant_id ??
      (input.assigneeIds?.length
        ? input.assigneeIds[assigneeIndex++ % input.assigneeIds.length]
        : null);
    return [
      {
        ...(existing?.id ? { id: existing.id } : {}),
        trip_id: input.tripId,
        slot_id: slotId,
        title: generatedTask.label,
        type: "preparation",
        assigned_participant_id: assignedId,
        status: existing?.status ?? "todo",
        booking_url: null,
        start_time: null,
        day_date: null,
        price: null,
        is_manually_assigned: existing?.is_manually_assigned ?? false,
      },
    ];
  });
}

export const generateTasksForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Fetch trip and its itinerary
    const tripRes = await supabase
      .from("trips")
      .select(
        "group_itinerary, group_logistics, event_type, celebrated_person, has_star, star_user_id",
      )
      .eq("id", data.tripId)
      .maybeSingle();

    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const itinerary = (tripRes.data as any).group_itinerary;
    if (!itinerary || !Array.isArray(itinerary.days)) {
      return {
        ok: false,
        message: "Aucun planning généré pour ce voyage. Veuillez générer le planning d'abord.",
      };
    }

    // 2. Fetch all active participants
    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);

    if (partsRes.error) throw partsRes.error;
    const participants = partsRes.data ?? [];

    // Identify the star to exclude her from automatic assignment
    const celebratedPerson = tripRes.data.celebrated_person;
    const starUid = tripRes.data.star_user_id || "star-virtual-uid";

    const assignable = participants.filter((p) => {
      if ((p.status as string) === "absent") return false;
      const isStarByUid = Boolean(p.user_id && starUid && p.user_id === starUid);
      return !isStarByUid;
    });

    // 3. Fetch existing tasks
    const tasksRes = await supabase
      .from("trip_tasks" as any)
      .select("*")
      .eq("trip_id", data.tripId);

    const existingTasks = (tasksRes.error ? [] : (tasksRes.data ?? [])) as any[];

    // Helper to resolve task type and default title from a slot
    const getTaskSlotInfo = (slot: any): { taskType: "resto" | "activite" | "bar"; defaultTitle: string } | null => {
      if (!slot || typeof slot !== "object") return null;

      const rawType = String(slot.type || "").trim().toLowerCase();
      const rawCategory = String(slot.category || "").trim().toLowerCase();
      const rawVenue = String(slot.venueFamily || "").trim().toLowerCase();
      const rawKind = String(slot.kind || "").trim().toLowerCase();
      const label = String(slot.label || "").trim();

      if (!label) return null;

      let taskType: "resto" | "activite" | "bar" | null = null;

      if (rawType === "resto" || rawCategory === "repas" || rawVenue === "restaurant" || rawVenue === "cafe") {
        taskType = "resto";
      } else if (rawType === "bar" || rawCategory === "soiree" || rawVenue === "bar_pub") {
        taskType = "bar";
      } else if (
        rawType === "activite" ||
        rawKind === "place_required" ||
        ["culture", "sport_outdoor", "detente", "shopping", "local_experience"].includes(rawCategory)
      ) {
        taskType = "activite";
      }

      if (!taskType) return null;

      let defaultTitle = "";
      if (taskType === "resto") defaultTitle = `Réserver le restaurant : ${label}`;
      else if (taskType === "activite") defaultTitle = `Réserver l'activité : ${label}`;
      else defaultTitle = `Vérifier / réserver : ${label}`;

      return { taskType, defaultTitle };
    };

    // 4. Generate tasks across all days
    const tasksToUpsert = [];
    let newTaskIndex = 0;

    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        const slotInfo = getTaskSlotInfo(slot);
        if (slotInfo) {
          const slotId = `${day.day}-${slotIndex}`;
          const existing = existingTasks.find((t) => t.slot_id === slotId);

          let assignedId = null;
          let taskStatus = "todo";
          let isManual = false;
          let taskId = undefined;

          if (existing) {
            taskId = existing.id;
            assignedId = existing.assigned_participant_id;
            taskStatus = existing.status;
            isManual = existing.is_manually_assigned;

            // Reset status and manual assignment if the generated title changed
            if (existing.title !== slotInfo.defaultTitle) {
              taskStatus = "todo";
              isManual = false;
            }
          } else {
            if (assignable.length > 0) {
              const p = assignable[newTaskIndex % assignable.length]!;
              assignedId = p.id;
              newTaskIndex++;
            }
          }

          tasksToUpsert.push({
            ...(taskId ? { id: taskId } : {}),
            trip_id: data.tripId,
            slot_id: slotId,
            title: slotInfo.defaultTitle,
            type: slotInfo.taskType,
            assigned_participant_id: assignedId,
            status: taskStatus,
            booking_url: slot.url || null,
            start_time: slot.time || null,
            day_date: day.date || null,
            price: slot.priceHint != null ? String(slot.priceHint) : null,
            is_manually_assigned: isManual,
          });
        }
      }
    }

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const selectedAccommodation = (logistics.hotels ?? []).find(
      (hotel: any) => hotel.id === logistics.selectedHotelId,
    );
    const planningLabels = itinerary.days.flatMap((day: any) =>
      (day.slots ?? []).map((slot: any) => `${slot.label || ""} ${slot.detail || ""}`.trim()),
    );
    const preparation = buildTripPreparation({
      eventType: (tripRes.data as any).event_type,
      accommodation: selectedAccommodation?.type || logistics.accommodationType || "",
      activities: planningLabels,
    });
    tasksToUpsert.push(
      ...mergeGeneratedPreparationTasks({
        tripId: data.tripId,
        generatedTasks: preparation.tasks,
        existingTasks,
        assigneeIds: assignable.map((participant) => participant.id),
      }),
    );

    if (tasksToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from("trip_tasks" as any).upsert(tasksToUpsert, { onConflict: "trip_id,slot_id" });
      if (upsertErr) throw upsertErr;
    }

    // Clean up orphan tasks that no longer exist in the new itinerary slots
    const activeSlotIds = new Set<string>();
    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        const slotInfo = getTaskSlotInfo(slot);
        if (slotInfo) {
          activeSlotIds.add(`${day.day}-${slotIndex}`);
        }
      }
    }
    for (const task of preparation.tasks) activeSlotIds.add(`prep:${task.id}`);

    const orphanTaskIds = existingTasks
      .filter((task: any) => {
        const slotId = String(task.slot_id ?? "");
        return slotId && !activeSlotIds.has(slotId);
      })
      .map((task: any) => task.id)
      .filter(Boolean);

    if (orphanTaskIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from("trip_tasks" as any)
        .delete()
        .eq("trip_id", data.tripId)
        .in("id", orphanTaskIds);
      if (deleteErr) throw deleteErr;
    }

    // Verify actual database persistence of generated tasks
    const { count: persistedCount, error: countErr } = await supabase
      .from("trip_tasks" as any)
      .select("id", { count: "exact", head: true })
      .eq("trip_id", data.tripId);

    if (countErr) throw countErr;

    if (tasksToUpsert.length > 0 && (persistedCount == null || persistedCount === 0)) {
      throw new Error(
        `Erreur de persistance des tâches : ${tasksToUpsert.length} tâches calculées mais 0 ligne enregistrée dans trip_tasks.`,
      );
    }

    return { ok: true, count: persistedCount ?? tasksToUpsert.length };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["todo", "in_progress", "done"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("trip_tasks" as any)
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.taskId);

    if (error) throw error;
    return { ok: true };
  });

export const reassignTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        participantId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("trip_tasks" as any)
      .update({
        assigned_participant_id: data.participantId,
        is_manually_assigned: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.taskId);

    if (error) throw error;
    return { ok: true };
  });
