import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAR_EVENT_TYPES } from "@/lib/krew/constants";
import { isTripAdmin } from "@/lib/krew/engine";

export const getStarPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, name, event_type, celebrated_person, has_star, star_user_id, owner_id, co_organizer_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const starMode = (trip.data.group_logistics as any)?.star_mode ?? "secret";
    const isAdmin = isTripAdmin(trip.data, userId);

    if (!isAdmin && starMode === "secret") {
      throw new Error("403 Forbidden: Seuls les organisateurs peuvent modifier les préférences de la Star en mode secret.");
    }

    const eventType = String(trip.data.event_type ?? "").toLowerCase();
    const starRelevant =
      STAR_EVENT_TYPES.has(eventType as any) ||
      Boolean(trip.data.celebrated_person) ||
      Boolean((trip.data as any).has_star);

    const prefs = await supabase
      .from("trip_star_preferences")
      .select("*")
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (prefs.error && !String(prefs.error.message).includes("does not exist")) throw prefs.error;

    return {
      trip: {
        id: trip.data.id,
        name: trip.data.name,
        eventType,
        celebratedPerson: trip.data.celebrated_person as string | null,
        hasStar: starRelevant,
        isOwner: trip.data.owner_id === userId,
      },
      preferences: prefs.data
        ? {
            wantedActivities: prefs.data.wanted_activities ?? [],
            dealBreakers: prefs.data.deal_breakers ?? [],
            ambiances: prefs.data.ambiances ?? [],
            notes: prefs.data.notes as string | null,
            availableDates: prefs.data.available_dates ?? [],
            blockedDates: prefs.data.blocked_dates ?? [],
            desiredDestination: prefs.data.desired_destination ?? null,
            excludedDestinations: prefs.data.excluded_destinations ?? [],
            departureCity: prefs.data.departure_city ?? null,
            departureAirportOrStation: prefs.data.departure_airport_or_station ?? null,
            updatedAt: (prefs.data.updated_at || prefs.data.submitted_at) as string | null,
            wantedEnvType: prefs.data.wanted_env_type ?? null,
          }
        : null,
    };
  });

export const submitStarPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        wantedActivities: z.array(z.string()).default([]),
        dealBreakers: z.array(z.string()).default([]),
        ambiances: z.array(z.string()).default([]),
        notes: z.string().max(800).optional(),
        availableDates: z.array(z.string()).default([]),
        blockedDates: z.array(z.string()).default([]),
        desiredDestination: z.string().optional().nullable(),
        excludedDestinations: z.array(z.string()).default([]),
        departureCity: z.string().optional().nullable(),
        departureAirportOrStation: z.string().optional().nullable(),
        wantedEnvType: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, celebrated_person, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const starMode = (trip.data.group_logistics as any)?.star_mode ?? "secret";
    const isAdmin = isTripAdmin(trip.data, userId);

    if (!isAdmin && starMode === "secret") {
      throw new Error("403 Forbidden: Seuls les organisateurs peuvent modifier les préférences de la Star en mode secret.");
    }

    if (!isAdmin) {
      // participants peuvent aussi remplir si autorisés et pas secret
      const part = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!part.data) throw new Error("403 Forbidden");
    }

    const now = new Date().toISOString();
    const existing = await supabase
      .from("trip_star_preferences")
      .select("id, submitted_at")
      .eq("trip_id", data.tripId)
      .maybeSingle();

    const payload = {
      trip_id: data.tripId,
      filled_by: userId,
      user_id: userId,
      wanted_activities: data.wantedActivities,
      deal_breakers: data.dealBreakers,
      ambiances: data.ambiances,
      notes: data.notes ?? null,
      available_dates: data.availableDates,
      blocked_dates: data.blockedDates,
      desired_destination: data.desiredDestination ?? null,
      excluded_destinations: data.excludedDestinations,
      departure_city: data.departureCity ?? null,
      departure_airport_or_station: data.departureAirportOrStation ?? null,
      submitted_at: existing.data?.submitted_at ?? now,
      updated_at: now,
      wanted_env_type: data.wantedEnvType ?? null,
    };

    const { error } = await supabase
      .from("trip_star_preferences")
      .upsert(payload, { onConflict: "trip_id" });
    if (error) throw error;

    await supabase
      .from("trips")
      .update({
        has_star: true,
        celebrated_person: trip.data.celebrated_person,
      } as any)
      .eq("id", data.tripId);

    return { ok: true, isUpdate: Boolean(existing.data) };
  });
