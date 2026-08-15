import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRecommendationsForTrip, tripInputSchema } from "@/lib/krew/trip-service";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";
import { isTripAdmin, computeGroupTimeWindow, computeGroupTimeWindowExtended, scoreTransportOption } from "@/lib/krew/engine";


/** Libellé de stade aligné sur le parcours hub (pas le status enum brut). */
function computeJourneyStage(input: {
  status?: string | null;
  datesLocked: boolean;
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
  if (input.datesLocked) return "Choix de la destination";
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
        .select("id, name, event_type, status, participants_count, created_at, owner_id, start_date, end_date")
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

    const stageByTrip: Record<
      string,
      { destinationSelected: boolean; hasItinerary: boolean }
    > = {};
    for (const id of uniqueIds) {
      stageByTrip[id] = { destinationSelected: false, hasItinerary: false };
    }

    if (uniqueIds.length) {
      const [selRecos, tripExtras] = await Promise.all([
        supabase
          .from("recommendations")
          .select("trip_id")
          .in("trip_id", uniqueIds)
          .eq("is_selected", true),
        supabase.from("trips").select("id, dates_locked, group_itinerary, start_date").in("id", uniqueIds),
      ]);
      for (const r of selRecos.data ?? []) {
        const tid = (r as any).trip_id as string;
        if (stageByTrip[tid]) stageByTrip[tid].destinationSelected = true;
      }
      for (const row of tripExtras.data ?? []) {
        const tid = (row as any).id as string;
        if (!stageByTrip[tid]) continue;
        stageByTrip[tid].hasItinerary = Boolean((row as any).group_itinerary?.days?.length);
        // merge dates_locked onto trip rows below via stage map + raw fields
        (stageByTrip[tid] as any).datesLocked = Boolean((row as any).dates_locked);
        (stageByTrip[tid] as any).startDate = (row as any).start_date ?? null;
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
      return {
        ...row,
        dates_locked: datesLocked,
        destination_selected: destinationSelected,
        has_itinerary: hasItinerary,
        journey_stage: computeJourneyStage({
          status: row.status,
          datesLocked,
          destinationSelected,
          hasItinerary,
          startDate: row.start_date ?? (s as any).startDate,
        }),
      };
    };

    return {
      trips: trips.map(attachStage),
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

    return {
      trip: trip.data,
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

export async function createTripHelper(
  supabase: any,
  userId: string,
  email: string,
  data: z.infer<typeof tripInputSchema>
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
    departure_city: data.departureCity || "Paris",
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
    departure_city: data.departureCity || "Paris",
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

    trip = await supabase.from("trips").insert(fullPayload as any).select("*").single();
    if (trip.error) {
      console.error("createTrip [Star Type] fullPayload failed:", trip.error);
      trip = await supabase.from("trips").insert(starMidPayload as any).select("*").single();
    }
    if (trip.error) {
      console.error("createTrip [Star Type] starMidPayload failed:", trip.error);
      trip = await supabase.from("trips").insert(starMinimalPayload as any).select("*").single();
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
    trip = await supabase.from("trips").insert(fullPayload as any).select("*").single();
    if (trip.error) {
      console.warn("createTrip fullPayload failed:", trip.error);
      trip = await supabase.from("trips").insert(midPayload as any).select("*").single();
    }
    if (trip.error) {
      console.warn("createTrip midPayload failed:", trip.error);
      trip = await supabase.from("trips").insert(minimalPayload as any).select("*").single();
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

  const organizerName = data.organizerFirstName
    ? String(data.organizerFirstName).trim()
    : null;

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

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

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
  data: { tripId: string; email: string; displayName?: string }
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
    throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut inviter des participants");
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
  data: { participantId: string }
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
    throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut retirer des participants");
  }

  const { error } = await supabase
    .from("trip_participants")
    .delete()
    .eq("id", data.participantId);
  if (error) throw error;
  return { ok: true };
}

export const inviteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ tripId: z.string().uuid(), email: z.string().email(), displayName: z.string().max(80).optional() })
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
        inviteStepCompleted: z.boolean(),
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
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut finaliser cette étape");
    }

    const logistics = (trip.group_logistics || {}) as any;
    logistics.star_mode = data.starMode;
    logistics.invite_step_completed = data.inviteStepCompleted;

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

    const { error } = await supabase
      .from("trip_transport_time_prefs")
      .upsert(
        {
          trip_id: data.tripId,
          participant_id: participant.id,
          earliest_departure_time: data.earliestDepartureTime,
          latest_return_time: data.latestReturnTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "trip_id,participant_id" }
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
      supabase
        .from("trips")
        .select("group_logistics")
        .eq("id", data.tripId)
        .maybeSingle()
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
      const { error } = await supabase.from("recommendation_votes").delete().eq("id", existing.data.id);
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

    // Désélectionne les autres propositions
    await supabase.from("recommendations").update({ is_selected: false }).eq("trip_id", data.tripId);

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
      await supabase.from("trip_preferences").upsert(
        {
          trip_id: data.tripId,
          desired_destination: destName.trim(),
          let_krew_decide: false,
        },
        { onConflict: "trip_id" },
      );
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
      const tripRow = await supabase.from("trips").select("event_type").eq("id", data.tripId).maybeSingle();
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
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
      const patch: { user_id?: string | null; email?: string; status?: "invite" | "accepte" | "refuse" | "absent"; display_name?: string | null } = { user_id: userId, email, status: "accepte" };
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
      supabase.from("trip_preferences").select("duration_nights").eq("trip_id", data.tripId).maybeSingle(),
      (async () => {
        const { getParticipantsProgress } = await import("@/lib/participant-preferences.functions");
        // fallback inline if no handler export
        try {
          const prefs = await supabase
            .from("trip_participant_preferences")
            .select("user_id")
            .eq("trip_id", data.tripId);
          const parts = await supabase.from("trip_participants").select("id, user_id").eq("trip_id", data.tripId);
          const total = Math.max((parts.data ?? []).length, 1);
          const answered = new Set((prefs.data ?? []).map((p: any) => p.user_id).filter(Boolean)).size;
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

    const reactionsByReco = new Map<string, {
      myReaction: "like" | "dislike" | null;
      likesCount: number;
      dislikesCount: number;
    }>();

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
        const rInfo = reactionsByReco.get(r.id) ?? { myReaction: null, likesCount: 0, dislikesCount: 0 };
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
      .select("id, trip_id, recommendation_id, destination_name, last_checked_at, created_at, trips(name, status)")
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
    const tripRes = await supabase.from("trips").select("id, owner_id, group_logistics, co_organizer_id").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

    if (!isTripAdmin(trip, userId)) {
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut modifier les statuts de réservation");
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
      supabase.from("trip_participant_preferences").select("user_id, departure_city").eq("trip_id", data.tripId),
      supabase.from("trip_star_preferences").select("user_id, departure_city").eq("trip_id", data.tripId).maybeSingle(),
    ]);

    const prefMap = new Map<string, string>();
    for (const p of prefsRes.data ?? []) {
      if (p.user_id && p.departure_city) {
        prefMap.set(p.user_id, p.departure_city);
      }
    }

    const celebratedPerson = trip.data?.celebrated_person;
    const starUid = (starPrefsRes.data as any)?.user_id || (trip.data as any)?.star_user_id || "star-virtual-uid";

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
      const match = budgetOrigins.find((bo: any) => normCity(bo.city || bo.originCity || "") === target);
      return match ? Number(match.pricePerPerson ?? match.price ?? fallbackTransport) : fallbackTransport;
    };

    const logistics = (trip.data.group_logistics || {}) as any;
    const hotelBookingStatus = logistics.hotelBookingStatus || 'estimé';
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
        transportPrice = userPick.pricePerPerson != null ? Number(userPick.pricePerPerson) : fallbackTransport;
        isTransportReserved = userPick.status === 'réservé';
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
        transportStatus: userPick?.status || 'estimé',
      });
    }

    if (participantLines.length === 0) {
      participantLines.push({
        city: `Groupe (${tripOrigin})`,
        count: totalGroupParticipants,
        pricePerPerson: fallbackTransport,
        isReserved: false,
        userId: null,
        transportStatus: 'estimé',
      });
      estimatedTransportSum += fallbackTransport * totalGroupParticipants;
    }

    const destName =
      (reco.data as any).destinations?.name ??
      budget.destinationName ??
      "Destination";

    const split = buildCostSplit({
      destinationName: destName,
      accommodation: accommodationCost,
      activities: Number(budget.activities ?? 0),
      food: Number(budget.food ?? 0),
      origins: participantLines,
      fallbackTransportPerPerson: fallbackTransport,
      participants: totalGroupParticipants || 1,
    } as any);

    const isHotelReserved = hotelBookingStatus === 'réservé';
    const sharedCostReserved = isHotelReserved ? (accommodationCost) : 0;
    const sharedCostEstimated = isHotelReserved ? 0 : (accommodationCost);

    const activitiesCost = Number(budget.activities ?? 0);
    const foodCost = Number(budget.food ?? 0);

    const totalReserved = reservedTransportSum + sharedCostReserved + (isHotelReserved ? (activitiesCost + foodCost) : 0);
    const totalEstimated = estimatedTransportSum + sharedCostEstimated + (isHotelReserved ? 0 : (activitiesCost + foodCost));

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
            transportStatus: pl?.transportStatus || 'estimé',
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
    if (!isTripAdmin(trip.data, userId)) throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut annuler");

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
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut valider les activités");
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

    const [tripRes, partsRes] = await Promise.all([
      supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId)
    ]);
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;
    if (!isTripAdmin(trip, userId)) {
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut générer le planning");
    }
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const selected = await supabase
      .from("recommendations")
      .select("id, activity_ids, destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selected.error) throw selected.error;
    if (!selected.data) {
      throw new Error("Valide d'abord une destination avant de générer les activités");
    }

    const destName =
      (selected.data as any).destinations?.name ||
      trip.desired_destination ||
      "Destination";
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
    const { generateItineraryWithAi } = await import("@/lib/krew/activity-ai.server");
    const logistics = (trip.group_logistics || {}) as any;
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    const timeFilters = logistics.timeFilters || {};
    // Dernière arrivée du groupe (jour 1) et premier départ retour
    const arrivals = picks
      .map((p: any) => p.arrivalTime || p.time)
      .filter(Boolean) as string[];
    const departures = picks.map((p: any) => p.departureTime).filter(Boolean) as string[];

    let latestArrival: string | null = null;
    let earliestReturn: string | null = null;

    if (arrivals.length > 0) {
      const sortedArrivals = [...arrivals].sort();
      // Median/Majority
      latestArrival = sortedArrivals[Math.floor(sortedArrivals.length / 2)] || null;
    } else {
      latestArrival = timeFilters.arriveBy || null;
    }

    if (departures.length > 0) {
      const sortedDepartures = [...departures].sort();
      // Median/Majority
      earliestReturn = sortedDepartures[Math.floor(sortedDepartures.length / 2)] || null;
    } else {
      earliestReturn = timeFilters.departAfter || null;
    }

    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);

    const result = await generateItineraryWithAi(
      {
        destination: destName,
        country: destCountry,
        startDate: trip.start_date,
        endDate: trip.end_date,
        nights,
        participants: effCount,
        budgetPerPerson:
          Number(aggregated.aggregatedBudget) ||
          Number(trip.budget_per_person) ||
          400,
        eventType: trip.event_type,
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
        transportPicksSummary: picks.slice(0, 12).map((p: any) => ({
          city: p.city,
          mode: p.modeLabel || p.mode,
          arrival: p.arrivalTime || p.time,
          departure: p.departureTime,
        })),
        individualPreferences: aggregated.individualPreferences,
        groupAgeRange: aggregated.groupAgeRange,
        starWantedEnvType: aggregated.starWantedEnvType,
        wantedEnvTypes: aggregated.wantedEnvTypes,
      },
      seedLabels,
    );

    // Enrich with actual activities booking urls from TripAdvisor/Klook
    try {
      const destinationId = (selected.data as any).destination_id;
      if (destinationId && result.itinerary?.days) {
        const { data: acts } = await supabase
          .from("activities")
          .select("name, booking_url")
          .eq("destination_id", destinationId);
        if (acts?.length) {
          const urlByName = new Map<string, string>();
          for (const a of acts) {
            if (a.name && a.booking_url) {
              urlByName.set(a.name.toLowerCase().trim(), a.booking_url);
            }
          }
          for (const day of result.itinerary.days) {
            for (const slot of day.slots ?? []) {
              if (slot.label) {
                const key = slot.label.toLowerCase().trim();
                if (urlByName.has(key)) {
                  slot.url = urlByName.get(key) ?? null;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("itinerary post-processing failed:", e);
    }

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: result.itinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return {
      ok: true,
      usedLlm: result.usedLlm,
      error: result.error,
      itinerary: result.itinerary,
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
        .select("id, owner_id, co_organizer_id, group_itinerary, start_date, end_date, duration_nights, participants_count, budget_per_person, event_type, celebrated_person, has_star, star_user_id")
        .eq("id", data.tripId)
        .maybeSingle(),
      supabase
        .from("trip_participants")
        .select("*")
        .eq("trip_id", data.tripId)
    ]);
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut régénérer un créneau");
    }
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

    const itinerary = (tripRes.data as any).group_itinerary as {
      destination?: string;
      nights?: number;
      days?: { day: number; date?: string | null; slots: any[] }[];
      source?: string;
      generatedAt?: string;
    } | null;
    if (!itinerary?.days?.length) {
      throw new Error("Aucun planning à modifier — génère d'abord les activités");
    }

    const dayPlan = itinerary.days.find((d) => d.day === data.day) || itinerary.days[data.day - 1];
    if (!dayPlan?.slots?.[data.slotIndex]) {
      throw new Error("Créneau introuvable");
    }
    const current = dayPlan.slots[data.slotIndex];
    const avoid = dayPlan.slots.map((s) => s.label).filter(Boolean);

    const selected = await supabase
      .from("recommendations")
      .select("destination_id, destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    const destName =
      (selected.data as any)?.destinations?.name || itinerary.destination || "Destination";

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(tripRes.data, participants);

    const { regenerateSlotWithAi } = await import("@/lib/krew/activity-ai.server");
    const result = await regenerateSlotWithAi(
      {
        destination: destName,
        startDate: (tripRes.data as any).start_date,
        endDate: (tripRes.data as any).end_date,
        nights: Number((tripRes.data as any).duration_nights) || itinerary.nights || 2,
        participants: effCount,
        budgetPerPerson: Number((tripRes.data as any).budget_per_person) || 400,
        eventType: (tripRes.data as any).event_type,
        ambiances: aggregated.ambiances ?? [],
        activityCategories: aggregated.activityCategories ?? [],
        starWanted: aggregated.starWantedActivities ?? [],
        dietaryConstraints: aggregated.dietaryConstraints ?? [],
        travelPace: aggregated.medianTravelPace,
      },
      current,
      data.day,
      avoid,
    );

    // Try to enrich the regenerated slot with TripAdvisor/Klook url
    try {
      const destinationId = (selected.data as any).destination_id;
      if (destinationId && result.slot?.label) {
        const { data: acts } = await supabase
          .from("activities")
          .select("name, booking_url")
          .eq("destination_id", destinationId);
        if (acts?.length) {
          const match = acts.find((a: any) => a.name && a.name.toLowerCase().trim() === result.slot.label.toLowerCase().trim());
          if (match?.booking_url) {
            result.slot.url = match.booking_url;
          }
        }
      }
    } catch (e) {
      console.warn("single slot url enrichment failed:", e);
    }

    dayPlan.slots[data.slotIndex] = result.slot;
    itinerary.generatedAt = new Date().toISOString();
    if (result.usedLlm) itinerary.source = "ai";

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: itinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return { ok: true, usedLlm: result.usedLlm, slot: result.slot, itinerary };
  });

/** Reco hôtels + A/R multi-modes (avion, train, bus, voiture) avec liens de réservation. */
export const proposeStayAndTransport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), refreshExternal: z.boolean().optional() }).parse(data),
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

    if (!isTripAdmin(trip, userId)) {
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut chercher la logistique");
    }

    // Fetch active participants at the top so bedding config can use it
    const partsRes = await supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", data.tripId);
    if (partsRes.error) throw partsRes.error;
    const participants = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");

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

    let providerErrors: string[] = [];
    if (data.refreshExternal !== false) {
      try {
        const { refreshExternalCatalogForTrip } = await import(
          "@/lib/external/search-hotels.functions"
        );
        const ext = await refreshExternalCatalogForTrip(supabase, data.tripId, destName);
        if (ext?.providerErrors?.length) providerErrors = ext.providerErrors;
      } catch (e) {
        providerErrors.push(String(e).slice(0, 160));
      }
    }

    const budget =
      Number(aggregated.aggregatedBudget) || Number(trip.budget_per_person) || 400;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const ms =
          new Date(trip.end_date + "T12:00:00Z").getTime() -
          new Date(trip.start_date + "T12:00:00Z").getTime();
        const d = Math.round(ms / (24 * 3600 * 1000));
        if (d >= 1) return d;
      }
      return Number(trip.duration_nights) || 2;
    })();
    const checkin =
      (trip.start_date as string) ||
      new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
    const checkout =
      (trip.end_date as string) ||
      new Date(new Date(checkin).getTime() + nights * 86400000).toISOString().slice(0, 10);

    const lodgingBudget = Math.max(40, budget * 0.35);
    const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
    const effCount = getEffectiveParticipantsCount(trip, participants);
    const adults = Math.min(Math.max(1, effCount), 8);
    const noRooms = Math.max(1, Math.ceil(effCount / 2));

    const bookingSearchUrl = (q: string) =>
      `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(q)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=${noRooms}&selected_currency=EUR`;
    const googleHotelsUrl = (q: string) =>
      `https://www.google.com/travel/hotels?q=${encodeURIComponent(`hotels ${q} ${checkin} ${checkout}`)}`;
    const hotelsComUrl = (q: string) =>
      `https://fr.hotels.com/Hotel-Search?destination=${encodeURIComponent(q)}&startDate=${checkin}&endDate=${checkout}&rooms=1&adults=${adults}`;
    const airbnbUrl = (q: string) =>
      `https://www.airbnb.fr/s/${encodeURIComponent(q)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}`;

    if (!destId) {
      return { ok: true, logistics: { hotels: [], transports: [] } };
    }
    let hotelsQuery = supabase.from("accommodations").select("*").eq("destination_id", destId).limit(50);
    const hotelsRes = await hotelsQuery;
    if (hotelsRes.error) throw hotelsRes.error;

    // Filter to ensure absolute geographical coherence
    const matchedHotels = (hotelsRes.data ?? []).filter((h: any) => h.destination_id === destId);
    console.info(`[TRACE F. PERSISTANCE & G. SCORING IN LOGISTICS] destId=${destId}, destName=${destName}, matchedHotels_in_db=${matchedHotels.length}, sample_ids=${matchedHotels.slice(0, 3).map((h: any) => h.id).join(", ")}`);

    type HotelCard = {
      id: string;
      name: string;
      type: string;
      rating: number;
      pricePerNight: number;
      totalEstimate: number;
      distanceCenterKm: number | null;
      score: number;
      reasons: string[];
      bookingUrl: string | null;
      links: { label: string; url: string }[];
      source?: string | null;
      beddingInfo?: {
        estimatedRoomsNeeded: number;
        roomTypePreference: string;
        acceptsSharedRoom: boolean;
        isEntireLodging: boolean;
        description: string;
      };
      categoryLabel?: string;
    };

    const minRating = Number(aggregated.minAccommodationRating) || 0;
    const roomPrefs = ((aggregated as any).roomTypePreferences ?? []).map((x: string) =>
      String(x).toLowerCase(),
    );
    const sharedOk = (aggregated as any).acceptsSharedRoom !== false;

    const scoreHotel = (h: any): HotelCard => {
      const price = Number(h.price_per_night_per_person ?? h.price_per_night ?? 0) || 65;
      const rating = Number(h.rating ?? 0);
      const dist = h.distance_center_km != null ? Number(h.distance_center_km) : null;
      const reasons: string[] = [];
      let score = 0.4;
      if (price <= lodgingBudget) {
        score += 0.25;
        reasons.push("dans le budget");
      } else if (price <= lodgingBudget * 1.3) {
        score += 0.1;
        reasons.push("proche budget");
      } else score -= 0.12;
      if (rating >= 4) {
        score += 0.12;
        reasons.push("bien noté");
      }
      if (minRating > 0 && rating >= minRating) score += 0.1;
      const typeBlob = `${h.type ?? ""} ${h.name ?? ""}`.toLowerCase();
      if (!sharedOk && /dortoir|hostel|auberge/.test(typeBlob)) score -= 0.2;
      if (roomPrefs.length && roomPrefs.some((p: string) => typeBlob.includes(p))) {
        score += 0.1;
        reasons.push("type adapté");
      }
      if (dist != null && dist <= 2) {
        score += 0.1;
        reasons.push("proche centre");
      }
      // Prioritize supplier offer URLs / direct links over generic searches
      const offersList = Array.isArray(h.price_offers) ? h.price_offers : [];
      const offerWithUrl = offersList.find((o: any) => Boolean(o.url || o.booking_url));
      const priceOfferUrl = offerWithUrl?.url || offerWithUrl?.booking_url;
      const directUrl = h.booking_url || h.url || priceOfferUrl;
      const providerName = h.best_provider || offerWithUrl?.provider || h.source || null;

      const exactDeepLink = bookingSearchUrl(`${h.name} ${destName}`);
      const genericFallback = bookingSearchUrl(destName);
      const primary = directUrl || exactDeepLink || genericFallback;

      const links: { label: string; url: string }[] = [];
      if (directUrl) {
        const label = providerName ? `Réserver sur ${providerName}` : "Réserver";
        links.push({ label, url: String(directUrl) });
      } else {
        links.push({ label: "Recherche Booking", url: exactDeepLink });
      }
      links.push({ label: "Google Hotels", url: googleHotelsUrl(`${h.name} ${destName}`) });
      links.push({ label: "Hotels.com", url: hotelsComUrl(destName) });
      return {
        id: String(h.id),
        name: h.name,
        type: h.type ?? "hébergement",
        rating,
        pricePerNight: Math.round(price),
        totalEstimate: Math.round(price * nights),
        distanceCenterKm: dist,
        score: Math.round(Math.max(0, Math.min(1, score)) * 100) / 100,
        reasons: reasons.slice(0, 4),
        bookingUrl: primary,
        links,
        source: h.source ?? null,
      };
    };

    let hotels: HotelCard[] = matchedHotels.map(scoreHotel);
    hotels.sort((a, b) => b.score - a.score || b.rating - a.rating);

    const hasRealHotels = hotels.length > 0;

    if (!hasRealHotels) {
      const seedPrices = [
        Math.round(lodgingBudget * 0.55),
        Math.round(lodgingBudget * 0.75),
        Math.round(lodgingBudget * 0.95),
        Math.round(lodgingBudget * 1.15),
        Math.round(lodgingBudget * 1.4),
      ];
      const portalSeeds: HotelCard[] = [
        {
          id: "portal-budget",
          name: `Options économiques — ${destName}`,
          type: "recherche générique",
          rating: 3.8,
          pricePerNight: seedPrices[0]!,
          totalEstimate: seedPrices[0]! * nights,
          distanceCenterKm: null,
          score: 0.1,
          reasons: ["recherche générique", "budget serré", "idéal groupe"],
          bookingUrl: bookingSearchUrl(`${destName} hôtel pas cher`),
          links: [
            { label: "Booking (pas cher)", url: bookingSearchUrl(`${destName} hôtel pas cher`) },
            { label: "Google Hotels", url: googleHotelsUrl(destName) },
          ],
          source: "portal",
        },
        {
          id: "portal-booking",
          name: `Hôtels à ${destName}`,
          type: "recherche générique",
          rating: 4.2,
          pricePerNight: seedPrices[1]!,
          totalEstimate: seedPrices[1]! * nights,
          distanceCenterKm: null,
          score: 0.1,
          reasons: ["recherche générique", "dates préremplies", "prix indicatif — confirmer sur Booking"],
          bookingUrl: bookingSearchUrl(destName),
          links: [
            { label: "Booking", url: bookingSearchUrl(destName) },
            { label: "Hotels.com", url: hotelsComUrl(destName) },
          ],
          source: "portal",
        },
        {
          id: "portal-mid",
          name: `Confort milieu de gamme — ${destName}`,
          type: "recherche générique",
          rating: 4.3,
          pricePerNight: seedPrices[2]!,
          totalEstimate: seedPrices[2]! * nights,
          distanceCenterKm: null,
          score: 0.1,
          reasons: ["recherche générique", "bon rapport qualité/prix"],
          bookingUrl: googleHotelsUrl(destName),
          links: [
            { label: "Google Hotels", url: googleHotelsUrl(destName) },
            { label: "Booking", url: bookingSearchUrl(destName) },
          ],
          source: "portal",
        },
        {
          id: "portal-airbnb",
          name: `Maisons & appartements — ${destName}`,
          type: "recherche générique",
          rating: 4.5,
          pricePerNight: seedPrices[1]!,
          totalEstimate: seedPrices[1]! * nights,
          distanceCenterKm: null,
          score: 0.1,
          reasons: ["recherche générique", "idéal groupe", "cuisine possible"],
          bookingUrl: airbnbUrl(destName),
          links: [{ label: "Airbnb", url: airbnbUrl(destName) }],
          source: "portal",
        },
        {
          id: "portal-premium",
          name: `Coup de cœur / plus confort — ${destName}`,
          type: "recherche générique",
          rating: 4.6,
          pricePerNight: seedPrices[3]!,
          totalEstimate: seedPrices[3]! * nights,
          distanceCenterKm: null,
          score: 0.1,
          reasons: ["recherche générique", "plus de confort"],
          bookingUrl: bookingSearchUrl(`${destName} hôtel 4 étoiles`),
          links: [
            { label: "Booking 4★", url: bookingSearchUrl(`${destName} hôtel 4 étoiles`) },
            { label: "Hotels.com", url: hotelsComUrl(destName) },
          ],
          source: "portal",
        },
      ];

      const seen = new Set(hotels.map((h) => h.name.toLowerCase()));
      for (const p of portalSeeds) {
        if (!seen.has(p.name.toLowerCase())) {
          hotels.push(p);
          seen.add(p.name.toLowerCase());
        }
      }
    }

    // Compute bedding configurations based on participant preferences
    const totalGroupParticipants = Math.max(1, participants.length);
    const roomTypePref = (aggregated as any).roomTypePreference || "Peu importe";
    const acceptsShared = (aggregated as any).acceptsSharedRoom !== false;

    // Calculate estimated rooms needed
    let estimatedRoomsNeeded = 1;
    if (roomTypePref.toLowerCase().includes("individuelle") || roomTypePref.toLowerCase().includes("single")) {
      estimatedRoomsNeeded = totalGroupParticipants;
    } else if (roomTypePref.toLowerCase().includes("double") || roomTypePref.toLowerCase().includes("couple")) {
      estimatedRoomsNeeded = Math.ceil(totalGroupParticipants / 2);
    } else {
      estimatedRoomsNeeded = acceptsShared ? Math.ceil(totalGroupParticipants / 4) : Math.ceil(totalGroupParticipants / 2);
    }

    const { generateAccommodationConfigurations } = await import("@/lib/krew/engine");

    // Embed bedding config and full configurations comparison into each hotel card
    const scoredHotelsWithBedding = hotels.map(h => {
      const isEntireLodging = /maison|villa|appartement|chalet|gite|gîte|apartment|house/i.test(h.type + h.name);
      const beddingInfo = {
        estimatedRoomsNeeded,
        roomTypePreference: roomTypePref,
        acceptsSharedRoom: acceptsShared,
        isEntireLodging,
        description: isEntireLodging
          ? `Logement entier pour le groupe (${totalGroupParticipants} pers.) — environ ${estimatedRoomsNeeded} chambres requises.`
          : `Configuration chambres d'hôtel — environ ${estimatedRoomsNeeded} chambres de type ${roomTypePref} nécessaires.`,
      };

      let dbRow = matchedHotels.find((x: any) => String(x.id) === h.id);
      if (!dbRow) {
        // Mock dbRow for generic portal seeds to allow configuration comparison
        dbRow = {
          id: h.id,
          destination_id: destId,
          name: h.name,
          type: h.type,
          price_per_night_per_person: h.pricePerNight,
          capacity: h.id.includes("villa") || h.id.includes("airbnb") || h.id.includes("maison") ? totalGroupParticipants : 2,
          rating: h.rating,
          distance_center_km: h.distanceCenterKm ?? 2.0,
          description: h.name,
          image_url: null,
        } as any;
      }

      const configs = generateAccommodationConfigurations(
        [dbRow!],
        totalGroupParticipants,
        nights,
        dest,
        aggregated.groupAgeRange,
        aggregated.individualPreferences
      );

      return {
        ...h,
        beddingInfo,
        configs: configs.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          unitsCount: c.unitsCount,
          capacityPerUnit: c.capacityPerUnit,
          totalCapacity: c.totalCapacity,
          bedrooms: c.bedrooms,
          beds: c.beds,
          bathrooms: c.bathrooms,
          priceBase: c.priceBase,
          cleaningFee: c.cleaningFee,
          serviceFee: c.serviceFee,
          taxes: c.taxes,
          totalCost: c.totalCost,
          pricePerPerson: c.pricePerPerson,
          pricePerPersonPerNight: c.pricePerPersonPerNight,
          explanation: c.explanation,
          category: c.category,
        })),
      };
    });

    scoredHotelsWithBedding.sort((a, b) => b.score - a.score);

    // Categorize top lodgings into 5-6 explicit categories
    const categorizedHotels: HotelCard[] = [];
    const usedIds = new Set<string>();

    const getFirstUnused = (filterFn: (h: HotelCard) => boolean) => {
      const match = scoredHotelsWithBedding.find(h => !usedIds.has(h.id) && filterFn(h));
      if (match) {
        usedIds.add(match.id);
        return match;
      }
      return null;
    };

    // 1. Meilleur choix groupe
    const bestChoice = getFirstUnused((h) => true); // overall highest score
    if (bestChoice) {
      categorizedHotels.push({ ...bestChoice, categoryLabel: "Meilleur choix groupe" });
    }

    // 2. Meilleure maison
    const bestHouse = getFirstUnused((h) =>
      /maison|villa|appartement|chalet|gite|gîte|apartment|house/i.test(h.type + h.name)
    );
    if (bestHouse) {
      categorizedHotels.push({ ...bestHouse, categoryLabel: "Meilleure maison" });
    }

    // 3. Meilleur hôtel
    const bestHotel = getFirstUnused((h) =>
      /hotel|hôtel|chambre|hostel|auberge/i.test(h.type + h.name)
    );
    if (bestHotel) {
      categorizedHotels.push({ ...bestHotel, categoryLabel: "Meilleur hôtel" });
    }

    // 4. Option budget
    const sortedByPrice = [...scoredHotelsWithBedding].filter(h => !usedIds.has(h.id)).sort((a, b) => a.pricePerNight - b.pricePerNight);
    const budgetOption = sortedByPrice[0] || null;
    if (budgetOption) {
      usedIds.add(budgetOption.id);
      categorizedHotels.push({ ...budgetOption, categoryLabel: "Option budget" });
    }

    // 5. Option luxe
    const sortedByLuxury = [...scoredHotelsWithBedding].filter(h => !usedIds.has(h.id)).sort((a, b) => b.rating - a.rating || b.pricePerNight - a.pricePerNight);
    const luxuryOption = sortedByLuxury[0] || null;
    if (luxuryOption) {
      usedIds.add(luxuryOption.id);
      categorizedHotels.push({ ...luxuryOption, categoryLabel: "Option luxe" });
    }

    // 6. Meilleur rapport qualité-prix
    const sortedByValue = [...scoredHotelsWithBedding].filter(h => !usedIds.has(h.id)).sort((a, b) => {
      const aUnder = a.pricePerNight <= lodgingBudget ? 1 : 0;
      const bUnder = b.pricePerNight <= lodgingBudget ? 1 : 0;
      if (aUnder !== bUnder) return bUnder - aUnder;
      return b.rating - a.rating;
    });
    const valueOption = sortedByValue[0] || null;
    if (valueOption) {
      usedIds.add(valueOption.id);
      categorizedHotels.push({ ...valueOption, categoryLabel: "Meilleur rapport qualité-prix" });
    }

    // Fallback/Paddings
    for (const h of scoredHotelsWithBedding) {
      if (categorizedHotels.length >= 6) break;
      if (!usedIds.has(h.id)) {
        categorizedHotels.push({ ...h, categoryLabel: "Autre option intéressante" });
        usedIds.add(h.id);
      }
    }

    const topHotels = categorizedHotels;

    // ——— A/R multi-modes ———
    const tripOrigin = (trip.departure_city as string) || "Paris";
    const planeRefused = Boolean((aggregated as any).planeRefused);

    // Fetch trip participant preferences for departure cities and travel options
    const prefsRes = await supabase
      .from("trip_participant_preferences")
      .select("user_id, departure_city, max_travel_duration_hours, transport_mode_accepted, room_type_preference, accepts_shared_room")
      .eq("trip_id", data.tripId);
    const prefsList = prefsRes.data ?? [];

    // Fetch transport time preferences
    const timePrefsRes = await supabase
      .from("trip_transport_time_prefs")
      .select("participant_id, earliest_departure_time, latest_return_time, latest_arrival_time, earliest_return_departure_time")
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
      const maxTravelDurationHours = pref?.max_travel_duration_hours != null ? Number(pref.max_travel_duration_hours) : null;
      const transportModeAccepted = Array.isArray(pref?.transport_mode_accepted) ? pref.transport_mode_accepted : ["peu importe"];

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

    const { searchTransportRoundTrip, estimateTransportFromDistance } = await import(
      "@/integrations/external/transport.server"
    );

    const baseFlight = estimateTransportFromDistance(distanceKm);
    const priceForMode = (mode: string): number => {
      switch (mode) {
        case "flight":
          return Math.round(baseFlight);
        case "train":
          return Math.round(baseFlight * (distanceKm <= 500 ? 0.85 : distanceKm <= 900 ? 1.05 : 1.25));
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
            label: "BlaBlaCar",
            url: `https://www.blablacar.fr/search?fn=${f}&tn=${d}&db=${checkin}`,
          },
        ];
      }
      if (mode === "bus") {
        return [
          {
            label: "Omio (bus)",
            url: `https://www.omio.fr/search?departurePosition=${f}&arrivalPosition=${d}&departureDate=${checkin}&returnDate=${checkout}&adults=${gAdults}`,
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
      score?: number;
      matchReasons?: string[];
    };

    const modeMeta: { mode: string; modeLabel: string; enabled: boolean }[] = [
      { mode: "flight", modeLabel: "Avion", enabled: !planeRefused && distanceKm >= 250 },
      { mode: "train", modeLabel: "Train", enabled: distanceKm <= 1400 },
      { mode: "bus", modeLabel: "Bus", enabled: distanceKm <= 1200 },
      { mode: "car", modeLabel: "Voiture", enabled: distanceKm <= 1000 },
      { mode: "covoiturage", modeLabel: "Covoiturage", enabled: distanceKm <= 800 },
      { mode: "ferry", modeLabel: "Ferry", enabled: ["corse", "sardaigne", "angleterre", "majorque", "ibiza", "lisbonne", "rome", "athenes", "athens", "porto", "barcelone", "nice"].some(c => destName.toLowerCase().includes(c)) },
    ];

    const transports: TransportCard[] = [];

    for (const group of subGroups) {
      const from = group.departureCity;
      const acceptedModes = group.transportModeAccepted.map(m => m.toLowerCase().trim());
      const hasModeFilter = acceptedModes.length > 0 && !acceptedModes.includes("peu importe");

      let flightApiQuote: import("@/integrations/external/transport.server").TransportQuote | null = null;
      const isFlightAllowed = !planeRefused && (!hasModeFilter || acceptedModes.some(m => m.includes("avion") || m.includes("flight")));

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
            flightApiQuote = apiQuote;
          }
        } catch (e) {
          providerErrors.push(`transport ${from}: ${String(e).slice(0, 80)}`);
        }
      }

      for (const m of modeMeta) {
        if (!m.enabled) continue;

        if (hasModeFilter) {
          const matched = acceptedModes.some(am => {
            if (m.mode === "flight") return am.includes("avion") || am.includes("flight");
            if (m.mode === "train") return am.includes("train");
            if (m.mode === "bus") return am.includes("bus");
            if (m.mode === "car") return am.includes("voiture") || am.includes("car");
            if (m.mode === "covoiturage") return am.includes("covoit") || am.includes("share") || am.includes("car");
            if (m.mode === "ferry") return am.includes("ferry") || am.includes("bateau");
            return false;
          });
          if (!matched) continue;
        }

        const duration = estimateDurationForMode(m.mode, distanceKm);

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
          if (!links.some(l => l.url === ml.url)) {
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
          respectedConstraints.push(`Durée < ${group.maxTravelDurationHours}h (porte-à-porte ~${duration}h)`);
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
          group.maxTravelDurationHours
        );

        // Proposition de trajet partagé si un autre participant a fait ce choix
        const currentLogistics = (trip.group_logistics as any) || {};
        const otherPicks = Array.isArray(currentLogistics.transportPicks) ? currentLogistics.transportPicks : [];
        const matchingPick = otherPicks.find((pk: any) =>
          norm(pk.city || "") === norm(from) &&
          norm(pk.mode || "") === norm(m.mode) &&
          !group.participants.some(p => p.participantId === pk.userId)
        );
        if (matchingPick) {
          matchReasonsList.push(`Choisi par ${matchingPick.displayName} — vous pouvez voyager ensemble !`);
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
          note: m.mode === "flight" && flightApiQuote
            ? (providerName ? `prix ${providerName} réel` : "prix API réel")
            : "prix indicatif basé sur la distance",
          links: links.slice(0, 4),
          durationHours: duration,
          subGroupKey: group.key,
          participantIds: group.participants.map(p => p.participantId),
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
    transports.sort(
      (a, b) => a.city.localeCompare(b.city) || a.pricePerPerson - b.pricePerPerson,
    );

    const logistics = {
      destination: destName,
      country: destCountry,
      nights,
      checkin,
      checkout,
      hotels: topHotels,
      transports,
      providerErrors,
      generatedAt: new Date().toISOString(),
    };

    // Préserver votes hôtels + choix transports déjà enregistrés
    const prev = (trip.group_logistics as any) || {};
    const logisticsWithVotes = {
      ...logistics,
      hotelVotes: Array.isArray(prev.hotelVotes) ? prev.hotelVotes : [],
      transportPicks: Array.isArray(prev.transportPicks) ? prev.transportPicks : [],
      selectedHotelId: prev.selectedHotelId ?? null,
      hotelBookingStatus: prev.hotelBookingStatus ?? null,
    };

    await supabase
      .from("trips")
      .update({ group_logistics: logisticsWithVotes, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);

    // Update selected recommendation accommodation_id if a top hotel was selected or top scored
    const bestHotelId = topHotels[0]?.id;
    if (bestHotelId && !bestHotelId.startsWith("portal-")) {
      await supabase
        .from("recommendations")
        .update({ accommodation_id: bestHotelId })
        .eq("trip_id", data.tripId)
        .eq("is_selected", true);
    }

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
    const tripRes = await supabase.from("trips").select("id, group_logistics").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const votes: { userId: string; hotelId: string; at: string }[] = Array.isArray(logistics.hotelVotes)
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
        pricePerPerson: z.number().optional(),
        url: z.string().url().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase.from("trips").select("id, group_logistics").eq("id", data.tripId).maybeSingle();
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
    const picks: any[] = Array.isArray(logistics.transportPicks) ? [...logistics.transportPicks] : [];
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
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut définir les filtres horaires");
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
      const { error } = await supabase
        .from("destination_feedback")
        .upsert(
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
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid() }).parse(data),
  )
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
    const cityRow = transportByOrigin.find(
      (o: any) => o.city.toLowerCase() === pCity.toLowerCase()
    ) || transportByOrigin[0];

    const participantsCount = Number(trip.data.participants_count) || 2;
    const split = buildCostSplit({
      destinationName: (reco.data as any).destinations?.name || budget.destinationName || "Destination",
      accommodation: Number(budget.accommodation ?? 0),
      activities: Number(budget.activities ?? 0),
      food: Number(budget.food ?? 0),
      origins: transportByOrigin,
      fallbackTransportPerPerson: Number(budget.transport ?? 0),
      participants: participantsCount,
    });

    const userLine = split.lines.find(
      (l) => l.city.toLowerCase() === pCity.toLowerCase()
    ) || split.lines[0];

    const fallbackTransport = Number(budget.transport ?? 0);
    const sharedCost = (Number(budget.accommodation ?? 0) + Number(budget.activities ?? 0) + Number(budget.food ?? 0)) / participantsCount;
    const totalPerPerson = userLine ? userLine.totalPerPerson : (fallbackTransport + sharedCost);

    if (totalPerPerson <= 0) {
      throw new Error("Le montant calculé pour ce séjour est invalide.");
    }

    const amountCents = totalPerPerson * 100;
    const feePercent = Number(process.env['KREW_PLATFORM_FEE_PERCENT']) || 0;
    const platformFeeCents = Math.round(amountCents * (feePercent / 100));

    const stripeSecret = process.env['STRIPE_SECRET_KEY'];
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
        url: `${process.env['VITE_APP_URL'] || "http://localhost:3000"}/trips/${data.tripId}/recap?payment_success=true&session_id=${fakePayment.stripe_session_id}`,
      };
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" as any });

    const destName = (reco.data as any).destinations?.name || "Séjour Krew";
    const originUrl = process.env['VITE_APP_URL'] || "http://localhost:3000";

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


export const generateTasksForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Fetch trip and its itinerary
    const tripRes = await supabase
      .from("trips")
      .select("group_itinerary, celebrated_person, has_star, star_user_id")
      .eq("id", data.tripId)
      .maybeSingle();

    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const itinerary = (tripRes.data as any).group_itinerary;
    if (!itinerary || !Array.isArray(itinerary.days)) {
      return { ok: false, message: "Aucun planning généré pour ce voyage. Veuillez générer le planning d'abord." };
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

    // Fallback if no assignable participant exists
    const fallbackAssignees = assignable.length > 0 ? assignable : participants.filter(p => (p.status as string) !== "absent");

    // 3. Fetch existing tasks
    const tasksRes = await supabase
      .from("trip_tasks" as any)
      .select("*")
      .eq("trip_id", data.tripId);

    const existingTasks = (tasksRes.error ? [] : (tasksRes.data ?? [])) as any[];

    // 4. Generate tasks
    const tasksToUpsert = [];
    let newTaskIndex = 0;

    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        if (slot && ["resto", "activite", "bar"].includes(slot.type)) {
          const slotId = `${day.day}-${slotIndex}`;
          const existing = existingTasks.find((t) => t.slot_id === slotId);

          let assignedId = null;
          let taskStatus = "todo";
          let isManual = false;
          let taskId = undefined;

          let defaultTitle = "";
          if (slot.type === "resto") defaultTitle = `Réserver le restaurant : ${slot.label}`;
          else if (slot.type === "activite") defaultTitle = `Réserver l'activité : ${slot.label}`;
          else defaultTitle = `Vérifier / réserver : ${slot.label}`;

          if (existing) {
            taskId = existing.id;
            assignedId = existing.assigned_participant_id;
            taskStatus = existing.status;
            isManual = existing.is_manually_assigned;

            // Reset status and manual assignment if the generated title changed
            if (existing.title !== defaultTitle) {
              taskStatus = "todo";
              isManual = false;
            }
          } else {
            if (fallbackAssignees.length > 0) {
              const p = fallbackAssignees[newTaskIndex % fallbackAssignees.length]!;
              assignedId = p.id;
              newTaskIndex++;
            }
          }

          tasksToUpsert.push({
            ...(taskId ? { id: taskId } : {}),
            trip_id: data.tripId,
            slot_id: slotId,
            title: defaultTitle,
            type: slot.type,
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

    if (tasksToUpsert.length > 0) {
      const { error } = await supabase.from("trip_tasks" as any).upsert(tasksToUpsert);
      if (error) throw error;
    }

    // Clean up orphan tasks that no longer exist in the new itinerary slots
    const activeSlotIds = new Set<string>();
    for (const day of itinerary.days) {
      const slots = day.slots ?? [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
        const slot = slots[slotIndex];
        if (slot && ["resto", "activite", "bar"].includes(slot.type)) {
          activeSlotIds.add(`${day.day}-${slotIndex}`);
        }
      }
    }

    if (activeSlotIds.size > 0) {
      const { error: deleteErr } = await supabase
        .from("trip_tasks" as any)
        .delete()
        .eq("trip_id", data.tripId)
        .not("slot_id", "in", `(${Array.from(activeSlotIds).map(id => `'${id}'`).join(",")})`);
      if (deleteErr) throw deleteErr;
    } else {
      const { error: deleteErr } = await supabase
        .from("trip_tasks" as any)
        .delete()
        .eq("trip_id", data.tripId);
      if (deleteErr) throw deleteErr;
    }

    return { ok: true, count: tasksToUpsert.length };
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
