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
      .select("id, name, event_type, departure_city, owner_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    // Authorization: only the trip owner or a participant (by user_id or email) can access the questionnaire
    const email = context.claims?.email as string | undefined;
    if (trip.data.owner_id !== userId) {
      if (!email) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à accéder à ce questionnaire (email manquant)");
      const participantCheck = await supabase
        .from("trip_participants")
        .select("id, user_id, email")
        .eq("trip_id", data.tripId)
        .or(`user_id.eq.${userId},email.eq.${email}`)
        .maybeSingle();
      if (participantCheck.error) throw participantCheck.error;
      if (!participantCheck.data) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à accéder à ce questionnaire");
    }

    const prefs = await supabase
      .from("trip_participant_preferences")
      .select("*")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (prefs.error) throw prefs.error;

    return { trip: trip.data, preferences: prefs.data ?? null };
  });

export async function attachParticipantToTrip(
  supabase: any,
  tripId: string,
  userId: string,
  userEmail: string | undefined | null,
) {
  if (!userEmail) throw new Error("User email missing from context.claims.email");

  const { data: updatedRows, error: updateError } = await supabase
    .from("trip_participants")
    .update({ user_id: userId, status: "accepte" })
    .match({ trip_id: tripId, email: userEmail, user_id: null })
    .select();

  if (updateError) throw updateError;

  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(`No pending invitation found for email ${userEmail} on trip ${tripId}`);
  }

  if (updatedRows.length > 1) {
    throw new Error(
      `Multiple pending invitations matched for email ${userEmail} on trip ${tripId}`,
    );
  }

  return updatedRows[0];
}

export const submitParticipantPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => participantPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await attachParticipantToTrip(supabase, data.tripId, userId, context.claims?.email);

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

    const answered = new Set((preferences.data ?? []).map((p: any) => p.user_id));
    return {
      total: participants.data?.length ?? 0,
      answered: answered.size,
      participants: (participants.data ?? []).map((p: any) => ({
        ...p,
        hasAnswered: p.user_id ? answered.has(p.user_id) : false,
      })),
    };
  });
