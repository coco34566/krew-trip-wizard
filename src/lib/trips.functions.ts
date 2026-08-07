import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRecommendationsForTrip, tripInputSchema } from "@/lib/krew/trip-service";

export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [owned, invitations] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase
        .from("trip_participants")
        .select("*, trips(*)")
        .neq("status", "refuse")
        .order("created_at", { ascending: false }),
    ]);
    if (owned.error) throw owned.error;
    const trips = owned.data ?? [];
    const invited = (invitations.data ?? []).filter(
      (p) => p.trips && (p.trips as { owner_id: string }).owner_id !== userId,
    );
    return {
      trips,
      invitations: invited,
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

    const [preferences, participants, recommendations, votes] = await Promise.all([
      supabase.from("trip_preferences").select("*").eq("trip_id", data.tripId).maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId).order("created_at"),
      supabase
        .from("recommendations")
        .select("*, destinations(*), accommodations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false }),
      supabase.from("recommendation_votes").select("*").eq("trip_id", data.tripId),
    ]);

    const activityIds = (recommendations.data ?? []).flatMap((r) => r.activity_ids ?? []);
    const activities = activityIds.length
      ? await supabase.from("activities").select("*").in("id", activityIds)
      : { data: [], error: null };

    return {
      trip: trip.data,
      isOwner: trip.data.owner_id === userId,
      userId,
      preferences: preferences.data ?? null,
      participants: participants.data ?? [],
      recommendations: recommendations.data ?? [],
      activities: activities.data ?? [],
      votes: votes.data ?? [],
    };
  });

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tripInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .insert({
        owner_id: userId,
        name: data.name,
        event_type: data.eventType,
        celebrated_person: data.celebratedPerson ?? null,
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        participants_count: data.participants,
        budget_per_person: data.budgetPerPerson,
        departure_city: data.departureCity,
        status: "en_preparation",
      })
      .select("*")
      .single();
    if (trip.error) throw trip.error;

    const prefs = await supabase.from("trip_preferences").insert({
      trip_id: trip.data.id,
      average_age: data.averageAge ?? null,
      relation: data.relation ?? null,
      ambiances: data.ambiances,
      activity_categories: data.activityCategories,
      desired_destination: data.desiredDestination ?? null,
      let_krew_decide: data.letKrewDecide,
      max_distance_km: data.maxDistanceKm,
      excluded_countries: data.excludedCountries,
      duration_nights: data.durationNights,
      max_budget: data.maxBudget ?? null,
      needs_city_center: data.needsCityCenter,
      mobility_notes: data.mobilityNotes ?? null,
      dietary_constraints: data.dietaryConstraints,
      availability_notes: data.availabilityNotes ?? null,
    });
    if (prefs.error) throw prefs.error;

    await supabase.from("trip_participants").insert({
      trip_id: trip.data.id,
      user_id: userId,
      email: (context.claims.email as string | undefined) ?? "",
      display_name: null,
      status: "accepte",
    });

    return { tripId: trip.data.id as string };
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return generateRecommendationsForTrip(context.supabase, data.tripId);
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
    await supabase.from("recommendations").update({ is_selected: false }).eq("trip_id", data.tripId);
    const { error } = await supabase
      .from("recommendations")
      .update({ is_selected: true })
      .eq("id", data.recommendationId);
    if (error) throw error;
    await supabase.from("trips").update({ status: "valide" }).eq("id", data.tripId);
    return { ok: true };
  });
