import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRecommendationsForTrip } from "@/lib/krew/trip-service";

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

  // Nouveaux champs
  departureCity: z.string().max(120).optional(),
  departureFlexKm: z.number().int().min(0).max(10000).default(0),
  dateFlexDays: z.number().int().min(0).max(30).default(0),
  acceptsSharedRoom: z.boolean().default(false),
  roomTypePreference: z.string().max(80).optional(),
  requiredAmenities: z.array(z.string()).default([]),
  minAccommodationRating: z.number().min(0).max(5).optional(),
  travelPace: z.enum(["plein_programme", "equilibre", "chill"]).optional(),
  preferredTimeSlots: z.array(z.string()).default([]),
});

export type ParticipantPreferencesInput = z.infer<typeof participantPreferencesSchema>;

function normalizeEmail(email: string | undefined | null) {
  return typeof email === "string" ? email.trim().toLowerCase() : undefined;
}

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
    const emailRaw = context.claims?.email as string | undefined;
    const email = normalizeEmail(emailRaw);
    if (trip.data.owner_id !== userId) {
      if (!email) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à accéder à ce questionnaire (email manquant)");
      const participantCheck = await supabase
        .from("trip_participants")
        .select("id, user_id, email")
        .eq("trip_id", data.tripId)
        // case-insensitive email match
        .or(`user_id.eq.${userId},email.ilike.${email}`)
        .maybeSingle();
      if (participantCheck.error) throw participantCheck.error;
      if (!participantCheck.data) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à accéder à ce questionnaire");
    }

    const prefs = await supabase
      .from("trip_participant_preferences")
      .select("*, submitted_at, updated_at")
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
  const email = normalizeEmail(userEmail);
  if (!email) throw new Error("User email missing from context.claims.email");

  // Update using case-insensitive email match to avoid casing issues
  const { data: updatedRows, error: updateError } = await supabase
    .from("trip_participants")
    .update({ user_id: userId, status: "accepte" })
    .eq("trip_id", tripId)
    .ilike("email", email)
    .is("user_id", null)
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

/**
 * Return participants (id, user_id, email, display_name, status) who have not answered the questionnaire yet.
 * Includes both claimed participants (user_id present but no preferences) and unclaimed invites (user_id null).
 */
export async function listUnansweredParticipants(supabase: any, tripId: string) {
  const [participantsRes, prefsRes] = await Promise.all([
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status, created_at")
      .eq("trip_id", tripId),
    supabase.from("trip_participant_preferences").select("user_id, submitted_at, updated_at").eq("trip_id", tripId),
  ]);
  if (participantsRes.error) throw participantsRes.error;
  if (prefsRes.error) throw prefsRes.error;

  const participants = participantsRes.data ?? [];
  const answeredUserIds = new Set((prefsRes.data ?? []).map((p: any) => p.user_id).filter(Boolean));

  const unanswered = participants.filter((p: any) => {
    // If participant has a user_id, check if their user_id is in the answered set
    if (p.user_id) return !answeredUserIds.has(p.user_id);
    // If participant has no user_id (unclaimed invite), consider them unanswered
    return true;
  });

  return unanswered;
}

export const submitParticipantPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => participantPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: ensure the user is owner or a listed participant (by user_id or email)
    const tripRes = await supabase.from("trips").select("id, owner_id").eq("id", data.tripId).maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const emailRaw = context.claims?.email as string | undefined;
    const email = normalizeEmail(emailRaw);
    if (tripRes.data.owner_id !== userId) {
      if (!email) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à soumettre ce questionnaire (email manquant)");
      const participantCheck = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .or(`user_id.eq.${userId},email.ilike.${email}`)
        .maybeSingle();
      if (participantCheck.error) throw participantCheck.error;
      if (!participantCheck.data) throw new Error("403 Forbidden: Vous n'êtes pas autorisé à soumettre ce questionnaire");
    }

    // Validation: prevent inconsistent partial submissions
    const min = (data as any).durationNightsMin;
    const max = (data as any).durationNightsMax;
    if (typeof min === "number" && typeof max === "number" && min > max) {
      throw new Error("Validation error: durationNightsMin cannot be greater than durationNightsMax");
    }

    // Attach participant if there's a matching unclaimed invitation
    try {
      await attachParticipantToTrip(supabase, data.tripId, userId, emailRaw);
    } catch (e) {
      // attachParticipantToTrip throws if no pending invite exists; this is acceptable in some flows
      // We swallow the error here to allow users that are already attached (or owner) to continue.
      // If you prefer strict behavior, rethrow the error.
    }

    // Check if a preference row already exists to set submitted_at vs updated_at
    const existingPref = await supabase
      .from("trip_participant_preferences")
      .select("submitted_at, updated_at")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingPref.error) throw existingPref.error;

    const now = new Date().toISOString();

    const payload: any = {
      trip_id: data.tripId,
      user_id: userId,
      ambiances: (data as any).ambiances,
      activity_categories: (data as any).activityCategories,
      budget_max: (data as any).budgetMax ?? null,
      budget_priority: (data as any).budgetPriority,
      duration_nights_min: (data as any).durationNightsMin ?? null,
      duration_nights_max: (data as any).durationNightsMax ?? null,
      desired_destination: (data as any).desiredDestination ?? null,
      excluded_destinations: (data as any).excludedDestinations,
      dietary_constraints: (data as any).dietaryConstraints,
      mobility_notes: (data as any).mobilityNotes ?? null,
      free_text: (data as any).freeText ?? null,

      // map new fields to snake_case columns
      departure_city: (data as any).departureCity ?? null,
      departure_flex_km: (data as any).departureFlexKm ?? null,
      date_flex_days: (data as any).dateFlexDays ?? null,
      accepts_shared_room: (data as any).acceptsSharedRoom ?? false,
      room_type_preference: (data as any).roomTypePreference ?? null,
      required_amenities: (data as any).requiredAmenities ?? [],
      min_accommodation_rating: (data as any).minAccommodationRating ?? null,
      travel_pace: (data as any).travelPace ?? null,
      preferred_time_slots: (data as any).preferredTimeSlots ?? [],
    };

    if (existingPref.data) {
      // existing row -> mark updated_at
      payload.submitted_at = existingPref.data.submitted_at ?? now;
      payload.updated_at = now;
    } else {
      // new submission
      payload.submitted_at = now;
      payload.updated_at = null;
    }

    const { error } = await supabase.from("trip_participant_preferences").upsert(payload, { onConflict: "trip_id,user_id" });
    if (error) throw error;

    const [participants, preferences] = await Promise.all([
      supabase.from("trip_participants").select("id").eq("trip_id", data.tripId),
      supabase.from("trip_participant_preferences").select("user_id").eq("trip_id", data.tripId),
    ]);
    if (participants.error) throw participants.error;
    if (preferences.error) throw preferences.error;

    const total = participants.data?.length ?? 0;
    const answered = new Set((preferences.data ?? []).map((preference: { user_id: string | null }) => preference.user_id).filter(Boolean)).size;
    let autoGenerated = false;

    if (total > 0 && answered >= total) {
      try {
        await generateRecommendationsForTrip(supabase, data.tripId);
        autoGenerated = true;
      } catch (generationError) {
        console.error("Génération automatique des recommandations échouée", generationError);
      }
    }

    return { ok: true, progress: { answered, total }, autoGenerated };
  });

export const getParticipantsProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [participants, preferences] = await Promise.all([
      supabase.from("trip_participants").select("id, user_id, email, display_name, status").eq("trip_id", data.tripId),
      supabase
        .from("trip_participant_preferences")
        .select("user_id, submitted_at, updated_at")
        .eq("trip_id", data.tripId),
    ]);
    if (participants.error) throw participants.error;
    if (preferences.error) throw preferences.error;

    const prefMap = new Map<string, any>();
    for (const p of (preferences.data ?? []) as any[]) {
      prefMap.set(p.user_id, p);
    }

    return {
      total: participants.data?.length ?? 0,
      answered: prefMap.size,
      participants: (participants.data ?? []).map((p: any) => ({
        ...p,
        hasAnswered: p.user_id ? prefMap.has(p.user_id) : false,
        answeredAt: p.user_id && prefMap.has(p.user_id) ? (prefMap.get(p.user_id).updated_at ?? prefMap.get(p.user_id).submitted_at) : null,
      })),
    };
  });
