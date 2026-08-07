import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRecommendationsForTrip, tripInputSchema } from "@/lib/krew/trip-service";


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
      owned = await supabase
        .from("trips")
        .select("id, name, event_type, status, participants_count, created_at, owner_id, start_date, end_date")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
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
      isOwner: trip.data.owner_id === userId,
      userId,
      preferences: preferences.error ? null : (preferences.data ?? null),
      participants: participantRows,
      recommendations: recos,
      activities: activityRows,
      votes: voteRows,
      activityVotes: activityVoteRows,
    };
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tripInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

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
    };
    const minimalPayload: Record<string, unknown> = {
      owner_id: userId,
      name: data.name,
      event_type: data.eventType,
      participants_count: data.participants ?? 2,
    };

    let trip = await supabase.from("trips").insert(fullPayload as any).select("*").single();
    if (trip.error) {
      trip = await supabase.from("trips").insert(midPayload as any).select("*").single();
    }
    if (trip.error) {
      trip = await supabase.from("trips").insert(minimalPayload as any).select("*").single();
    }
    if (trip.error) {
      throw new Error(
        `Création voyage impossible: ${trip.error.message || JSON.stringify(trip.error)}. ` +
          "Vérifie le SQL trips (RLS insert + colonnes) dans Lovable.",
      );
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

    const organizerName = (data as any).organizerFirstName
      ? String((data as any).organizerFirstName).trim()
      : null;

    const partInsert = await supabase.from("trip_participants").insert({
      trip_id: trip.data.id,
      user_id: userId,
      email: (context.claims.email as string | undefined) ?? "",
      display_name: organizerName,
      role: "organisateur",
      status: "accepte",
    });
    if (partInsert.error) {
      // Fallback sans rôle custom si contrainte DB
      const retry = await supabase.from("trip_participants").insert({
        trip_id: trip.data.id,
        user_id: userId,
        email: (context.claims.email as string | undefined) ?? "",
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
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    return generateRecommendationsForTrip(context.supabase, data.tripId, {
      force: data.force,
    });
  });

export const getGenerationReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assessGenerationReadiness } = await import("@/lib/krew/trip-service");
    return assessGenerationReadiness(context.supabase, data.tripId);
  });

export const inviteParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ tripId: z.string().uuid(), email: z.string().email(), displayName: z.string().max(80).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
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
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { participantId: string }) =>
    z.object({ participantId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trip_participants")
      .delete()
      .eq("id", data.participantId);
    if (error) throw error;
    return { ok: true };
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
            final_score: full.data?.score,
            s_ambiance: ss.sAmbiance,
            s_activities: ss.sActivities,
            s_budget: ss.sBudget,
            s_distance: ss.sDistance,
            s_season: ss.sSeason,
            s_quality: ss.sQuality,
            s_consensus: ss.sConsensus,
            s_min_satisfaction: ss.sMinSatisfaction,
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
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trip = await supabaseAdmin
      .from("trips")
      .select("id, name, event_type, departure_city, participants_count, start_date, end_date, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable ou lien invalide");
    return {
      id: trip.data.id as string,
      name: trip.data.name as string,
      eventType: trip.data.event_type as string,
      departureCity: trip.data.departure_city as string,
      participantsCount: trip.data.participants_count as number,
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
      .select("id, owner_id, name")
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
      const patch: Record<string, unknown> = { user_id: userId, email, status: "accepte" };
      if (firstName) patch.display_name = firstName;
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
        .select("*, destinations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false })
        .limit(3),
      supabase.from("trip_preferences").select("duration_nights").eq("trip_id", data.tripId).maybeSingle(),
      (async () => {
        const { getParticipantsProgressHandler } = await import("@/lib/participant-preferences.functions");
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

    return {
      trip: {
        id: trip.data.id as string,
        name: trip.data.name as string,
        startDate: trip.data.start_date as string | null,
        endDate: trip.data.end_date as string | null,
        departureCity: tripOrigin,
        participantsCount: participants,
        status: trip.data.status as string,
      },
      isOwner,
      nights,
      departureOrigins,
      progress,
      recommendations: (recommendations.data ?? []).map((r: any) => ({
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
      })),
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

    const tripOrigin = ((trip.data.departure_city as string) || "Paris").trim() || "Paris";
    let departureOrigins =
      aggregated.departureOrigins && aggregated.departureOrigins.length > 0
        ? aggregated.departureOrigins
        : [{ city: tripOrigin, count: Math.max(1, Number(trip.data.participants_count) || 1) }];

    const budget = (reco.data.budget ?? {}) as any;
    const transportByOrigin: { city: string; count: number; pricePerPerson: number }[] =
      Array.isArray(budget.transportByOrigin) && budget.transportByOrigin.length
        ? budget.transportByOrigin
        : departureOrigins.map((o: { city: string; count: number }) => ({
            city: o.city,
            count: o.count,
            pricePerPerson: Number(budget.transport ?? 0),
          }));

    // Aligner les effectifs questionnaire si absents du budget
    const byCity = new Map(transportByOrigin.map((t) => [t.city.toLowerCase(), t]));
    for (const o of departureOrigins) {
      const key = o.city.toLowerCase();
      if (!byCity.has(key)) {
        transportByOrigin.push({
          city: o.city,
          count: o.count,
          pricePerPerson: Number(budget.transport ?? 0),
        });
      } else {
        const row = byCity.get(key)!;
        row.count = o.count;
      }
    }

    const destName =
      (reco.data as any).destinations?.name ??
      budget.destinationName ??
      "Destination";

    const split = buildCostSplit({
      destinationName: destName,
      accommodation: Number(budget.accommodation ?? 0),
      activities: Number(budget.activities ?? 0),
      food: Number(budget.food ?? 0),
      origins: transportByOrigin,
      fallbackTransportPerPerson: Number(budget.transport ?? 0),
      participants: Number(trip.data.participants_count) || undefined,
    });

    return {
      tripName: trip.data.name as string,
      isSelected: Boolean(reco.data.is_selected),
      recommendationId: reco.data.id as string,
      split,
    };
  });


/** Annule un voyage (owner only). Soft-delete via status annule — sort des listes actives. */
export const cancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), hardDelete: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (trip.data.owner_id !== userId) throw new Error("403 Forbidden: seul l'organisateur peut annuler");

    if (data.hardDelete) {
      // CASCADE sur participants, prefs, recos si FK ON DELETE CASCADE
      const { error } = await supabase.from("trips").delete().eq("id", data.tripId).eq("owner_id", userId);
      if (error) throw error;
      return { ok: true, mode: "deleted" as const };
    }

    const { error } = await supabase
      .from("trips")
      .update({ status: "annule", updated_at: new Date().toISOString() })
      .eq("id", data.tripId)
      .eq("owner_id", userId);
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
      .select("id, owner_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (trip.data.owner_id !== userId) {
      throw new Error("403 Forbidden: seul l'organisateur peut valider les activités");
    }
    const { error } = await supabase
      .from("trips")
      .update({
        selected_activity_ids: data.activityIds,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId)
      .eq("owner_id", userId);
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
    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;
    if (trip.owner_id !== userId) {
      throw new Error("403 Forbidden: seul l'organisateur peut générer le planning");
    }

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
    const result = await 
    const logistics = (trip.group_logistics || {}) as any;
    const picks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];
    const timeFilters = logistics.timeFilters || {};
    // Dernière arrivée du groupe (jour 1) et premier départ retour
    const arrivals = picks
      .map((p: any) => p.arrivalTime || p.time)
      .filter(Boolean) as string[];
    const departures = picks.map((p: any) => p.departureTime).filter(Boolean) as string[];
    const latestArrival = arrivals.sort().slice(-1)[0] || timeFilters.arriveBy || null;
    const earliestReturn = departures.sort()[0] || timeFilters.departAfter || null;

generateItineraryWithAi(
      {
        destination: destName,
        country: destCountry,
        startDate: trip.start_date,
        endDate: trip.end_date,
        nights,
        participants: Number(trip.participants_count) || aggregated.participantsCount || 2,
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

      },
      seedLabels,
    );

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: result.itinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId)
      .eq("owner_id", userId);
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
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, group_itinerary, start_date, end_date, duration_nights, participants_count, budget_per_person, event_type")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if ((tripRes.data as any).owner_id !== userId) {
      throw new Error("403 Forbidden: seul l'organisateur peut régénérer un créneau");
    }

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
      .select("destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    const destName =
      (selected.data as any)?.destinations?.name || itinerary.destination || "Destination";

    const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);

    const { regenerateSlotWithAi } = await import("@/lib/krew/activity-ai.server");
    const result = await regenerateSlotWithAi(
      {
        destination: destName,
        startDate: (tripRes.data as any).start_date,
        endDate: (tripRes.data as any).end_date,
        nights: Number((tripRes.data as any).duration_nights) || itinerary.nights || 2,
        participants: Number((tripRes.data as any).participants_count) || 2,
        budgetPerPerson: Number((tripRes.data as any).budget_per_person) || 400,
        eventType: (tripRes.data as any).event_type,
        ambiances: aggregated.ambiances ?? [],
        activityCategories: aggregated.activityCategories ?? [],
        starWanted: aggregated.starWantedActivities ?? [],
        dietaryConstraints: aggregated.dietaryConstraints ?? [],
        travelPace: aggregated.medianTravelPace,
      },
      current,
      avoid,
    );

    dayPlan.slots[data.slotIndex] = result.slot;
    itinerary.generatedAt = new Date().toISOString();
    if (result.usedLlm) itinerary.source = "ai";

    const { error } = await supabase
      .from("trips")
      .update({
        group_itinerary: itinerary,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId)
      .eq("owner_id", userId);
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
    const { supabase } = context;
    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    const trip = tripRes.data as any;

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
    const adults = Math.min(Math.max(1, Number(trip.participants_count) || 2), 8);

    const bookingSearchUrl = (q: string) =>
      `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(q)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1&selected_currency=EUR`;
    const googleHotelsUrl = (q: string) =>
      `https://www.google.com/travel/hotels?q=${encodeURIComponent(`hotels ${q} ${checkin} ${checkout}`)}`;
    const hotelsComUrl = (q: string) =>
      `https://fr.hotels.com/Hotel-Search?destination=${encodeURIComponent(q)}&startDate=${checkin}&endDate=${checkout}&rooms=1&adults=${adults}`;
    const airbnbUrl = (q: string) =>
      `https://www.airbnb.fr/s/${encodeURIComponent(q)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}`;

    let hotelsQuery = supabase.from("accommodations").select("*").limit(50);
    if (destId) hotelsQuery = hotelsQuery.eq("destination_id", destId);
    const hotelsRes = await hotelsQuery;
    if (hotelsRes.error) throw hotelsRes.error;

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
      const primary = h.booking_url || h.url || bookingSearchUrl(`${h.name} ${destName}`);
      const links = [
        { label: "Booking", url: bookingSearchUrl(`${h.name} ${destName}`) },
        { label: "Google Hotels", url: googleHotelsUrl(`${h.name} ${destName}`) },
        { label: "Hotels.com", url: hotelsComUrl(destName) },
      ];
      if (h.booking_url || h.url) {
        links.unshift({ label: "Réserver", url: String(h.booking_url || h.url) });
      }
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

    let hotels: HotelCard[] = (hotelsRes.data ?? []).map(scoreHotel);
    hotels.sort((a, b) => b.score - a.score || b.rating - a.rating);

    // Toujours proposer plusieurs portes d'entrée avec prix indicatifs
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
        type: "hôtel / hostel",
        rating: 3.8,
        pricePerNight: seedPrices[0]!,
        totalEstimate: seedPrices[0]! * nights,
        distanceCenterKm: null,
        score: 0.74,
        reasons: ["budget serré", "idéal groupe"],
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
        type: "hôtel",
        rating: 4.2,
        pricePerNight: seedPrices[1]!,
        totalEstimate: seedPrices[1]! * nights,
        distanceCenterKm: null,
        score: 0.78,
        reasons: ["comparateur Booking", "dates préremplies", "prix indicatif — confirmer sur Booking"],
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
        type: "hôtel 3★+",
        rating: 4.3,
        pricePerNight: seedPrices[2]!,
        totalEstimate: seedPrices[2]! * nights,
        distanceCenterKm: null,
        score: 0.76,
        reasons: ["bon rapport qualité/prix"],
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
        type: "Airbnb / maison",
        rating: 4.5,
        pricePerNight: seedPrices[1]!,
        totalEstimate: seedPrices[1]! * nights,
        distanceCenterKm: null,
        score: 0.8,
        reasons: ["idéal groupe", "cuisine possible"],
        bookingUrl: airbnbUrl(destName),
        links: [{ label: "Airbnb", url: airbnbUrl(destName) }],
        source: "portal",
      },
      {
        id: "portal-premium",
        name: `Coup de cœur / plus confort — ${destName}`,
        type: "hôtel 4★",
        rating: 4.6,
        pricePerNight: seedPrices[3]!,
        totalEstimate: seedPrices[3]! * nights,
        distanceCenterKm: null,
        score: 0.7,
        reasons: ["plus de confort"],
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
    hotels.sort((a, b) => b.score - a.score);
    const topHotels = hotels.slice(0, 8);

    // ——— A/R multi-modes ———
    const tripOrigin = (trip.departure_city as string) || "Paris";
    const origins =
      aggregated.departureOrigins && aggregated.departureOrigins.length > 0
        ? aggregated.departureOrigins
        : [{ city: tripOrigin, count: Math.max(1, trip.participants_count || 2) }];
    const planeRefused = Boolean((aggregated as any).planeRefused);

    const { searchTransportRoundTrip, estimateTransportFromDistance } = await import(
      "@/integrations/external/transport.server"
    );

    const baseFlight = estimateTransportFromDistance(distanceKm);
    // Estimations relatives par mode (indicatif, affiné si API dispo)
    const priceForMode = (mode: string): number => {
      switch (mode) {
        case "flight":
          return Math.round(baseFlight);
        case "train":
          return Math.round(baseFlight * (distanceKm <= 500 ? 0.85 : distanceKm <= 900 ? 1.05 : 1.25));
        case "bus":
          return Math.round(baseFlight * 0.45);
        case "car":
          // essence + péage approx A/R partagé
          return Math.round(Math.max(35, distanceKm * 0.12 * 2) / Math.max(2, adults / 2));
        default:
          return Math.round(baseFlight);
      }
    };

    const linksForMode = (mode: string, from: string, to: string) => {
      const f = encodeURIComponent(from);
      const d = encodeURIComponent(to);
      if (mode === "flight") {
        return [
          {
            label: "Google Flights",
            url: `https://www.google.com/travel/flights?q=${encodeURIComponent(`Vols ${from} vers ${to} ${checkin} retour ${checkout}`)}&curr=EUR`,
          },
          {
            label: "Kayak",
            url: `https://www.kayak.fr/flights/${f}-${d}/${checkin}/${checkout}?sort=bestflight_a`,
          },
          {
            label: "Skyscanner",
            url: `https://www.skyscanner.fr/transport/vols/${f}/${d}/${checkin}/${checkout}/?adults=${adults}`,
          },
        ];
      }
      if (mode === "train") {
        return [
          {
            label: "Trainline",
            url: `https://www.thetrainline.com/book/results?originName=${f}&destinationName=${d}&outwardDate=${checkin}&inwardDate=${checkout}&journeySearchType=Return`,
          },
          {
            label: "SNCF Connect",
            url: `https://www.sncf-connect.com/fr-fr/train/horaires/${f}/${d}`,
          },
          {
            label: "Omio train",
            url: `https://www.omio.fr/search?departure=${f}&arrival=${d}&departureDate=${checkin}&returnDate=${checkout}&transportType=train`,
          },
        ];
      }
      if (mode === "bus") {
        return [
          {
            label: "FlixBus",
            url: `https://www.flixbus.fr/search?departureCity=${f}&arrivalCity=${d}&departureDate=${checkin}&returnDate=${checkout}`,
          },
          {
            label: "BlaBlaBus / Omio",
            url: `https://www.omio.fr/search?departure=${f}&arrival=${d}&departureDate=${checkin}&returnDate=${checkout}&transportType=bus`,
          },
          {
            label: "Busbud",
            url: `https://www.busbud.com/fr/search?origin=${f}&destination=${d}&outbound_date=${checkin}&inbound_date=${checkout}`,
          },
        ];
      }
      // car
      return [
        {
          label: "Google Maps",
          url: `https://www.google.com/maps/dir/${f}/${d}`,
        },
        {
          label: "BlaBlaCar",
          url: `https://www.blablacar.fr/search?fn=${f}&tn=${d}&db=${checkin}&de=${checkout}`,
        },
        {
          label: "Getaround",
          url: `https://fr.getaround.com/search?address=${f}`,
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
      note?: string;
      links: { label: string; url: string }[];
    };

    const modeMeta: { mode: string; modeLabel: string; enabled: boolean }[] = [
      { mode: "flight", modeLabel: "Avion", enabled: !planeRefused && distanceKm >= 250 },
      { mode: "train", modeLabel: "Train", enabled: distanceKm <= 1400 },
      { mode: "bus", modeLabel: "Bus", enabled: distanceKm <= 1200 },
      { mode: "car", modeLabel: "Voiture", enabled: distanceKm <= 1000 },
    ];

    const transports: TransportCard[] = [];

    for (const origin of origins.slice(0, 5)) {
      const from = origin.city;

      // API vol si dispo (améliore le prix avion)
      let flightApiPrice: number | null = null;
      let flightApiUrl: string | null = null;
      if (!planeRefused) {
        try {
          const apiQuote = await searchTransportRoundTrip({
            originCity: from,
            destinationCity: destName,
            departDate: checkin,
            returnDate: checkout,
            adults: Math.min(Math.max(1, origin.count), 9),
            distanceKm,
          });
          if (apiQuote?.pricePerPerson > 0) {
            flightApiPrice = apiQuote.pricePerPerson;
            flightApiUrl = apiQuote.url ?? null;
          }
        } catch (e) {
          providerErrors.push(`transport ${from}: ${String(e).slice(0, 80)}`);
        }
      }

      for (const m of modeMeta) {
        if (!m.enabled) continue;
        let price = priceForMode(m.mode);
        if (m.mode === "flight" && flightApiPrice) price = Math.round(flightApiPrice);
        const links = linksForMode(m.mode, from, destName);
        if (m.mode === "flight" && flightApiUrl) {
          links.unshift({ label: "Offre trouvée", url: flightApiUrl });
        }
        transports.push({
          city: from,
          count: origin.count,
          pricePerPerson: price,
          mode: m.mode,
          modeLabel: m.modeLabel,
          label: `A/R ${m.modeLabel.toLowerCase()} ${from} → ${destName}`,
          url: links[0]?.url ?? null,
          note:
            m.mode === "flight" && flightApiPrice
              ? "prix API si dispo"
              : "prix indicatif — clique pour comparer",
          links: links.slice(0, 4),
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
      .select("id, owner_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if ((tripRes.data as any).owner_id !== userId) {
      throw new Error("403 Forbidden: seul l'organisateur peut définir les filtres horaires");
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
