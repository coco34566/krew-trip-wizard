import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const participantPreferencesSchema = z.object({
  tripId: z.string().uuid(),
  ambiances: z.array(z.string()).default([]),
  activityCategories: z.array(z.string()).default([]),
  budgetMax: z.number().min(0).max(20000).optional(),
  budgetPriority: z
    .enum(["must_have", "high_priority", "preference", "nice_to_have", "irrelevant", "veto"])
    .default("preference"),
  durationNightsMin: z.number().int().min(1).max(21).optional(),
  durationNightsMax: z.number().int().min(1).max(21).optional(),
  desiredDestination: z.string().max(120).optional(),
  excludedDestinations: z.array(z.string()).default([]),
  dietaryConstraints: z.array(z.string()).default([]),
  mobilityNotes: z.string().max(500).optional(),
  freeText: z.string().max(1000).optional(),
});

export type ParticipantPreferencesInput = z.infer<typeof participantPreferencesSchema>;

export const getMyParticipantPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const trip = await supabase
      .from("trips")
      .select("id, name, event_type, departure_city")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const prefs = await supabase
      .from("trip_participant_preferences")
      .select("*")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (prefs.error) throw prefs.error;

    return { trip: trip.data, preferences: prefs.data ?? null };
  });

export const submitParticipantPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => participantPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("trip_participants")
      .update({ user_id: userId, status: "accepte" })
      .eq("trip_id", data.tripId)
      .is("user_id", null);

    const { error } = await supabase.from("trip_participant_preferences").upsert(
      {
        trip_id: data.tripId,
        user_id: userId,
        ambiances: data.ambiances,
        activity_categories: data.activityCategories,
        budget_max: data.budgetMax ?? null,
        budget_priority: data.budgetPriority,
        duration_nights_min: data.durationNightsMin ?? null,
        duration_nights_max: data.durationNightsMax ?? null,
        desired_destination: data.desiredDestination ?? null,
        excluded_destinations: data.excludedDestinations,
        dietary_constraints: data.dietaryConstraints,
        mobility_notes: data.mobilityNotes ?? null,
        free_text: data.freeText ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,user_id" },
    );
    if (error) throw error;

    return { ok: true };
  });

export const getParticipantsProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [participants, preferences] = await Promise.all([
      supabase.from("trip_participants").select("id, user_id, email, display_name, status").eq("trip_id", data.tripId),
      supabase.from("trip_participant_preferences").select("user_id").eq("trip_id", data.tripId),
    ]);
    if (participants.error) throw participants.error;
    if (preferences.error) throw preferences.error;

    const answered = new Set((preferences.data ?? []).map((p) => p.user_id));
    return {
      total: participants.data?.length ?? 0,
      answered: answered.size,
      participants: (participants.data ?? []).map((p) => ({
        ...p,
        hasAnswered: p.user_id ? answered.has(p.user_id) : false,
      })),
    };
  });
