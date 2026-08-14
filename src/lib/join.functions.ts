/**
 * Fonctions légères pour la page d'invitation /join/:tripId
 * Isolées de trips.functions.ts pour ne pas tirer le moteur de reco côté client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function parseTripId(data: unknown): string {
  const raw = (data as any)?.tripId ?? data;
  const tripId = String(raw ?? "")
    .split("?")[0]!
    .split("#")[0]!
    .trim();
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(tripId)) {
    throw new Error("Lien d'invitation invalide (identifiant manquant ou incorrect).");
  }
  return tripId;
}

/** Aperçu public d'un voyage (lien d'invitation) — pas d'auth requise. */
export const getJoinPreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ({ tripId: parseTripId(data) }))
  .handler(async ({ data }) => {
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

    // Auto-liaison de star_user_id si absent et que le prénom correspond à la Star
    if (!trip.data.star_user_id && trip.data.celebrated_person && firstName && trip.data.owner_id !== userId) {
      const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
      const celebNorm = norm(trip.data.celebrated_person);
      const firstNorm = norm(firstName);
      if (celebNorm && firstNorm && (celebNorm === firstNorm || celebNorm.includes(firstNorm) || firstNorm.includes(celebNorm))) {
        await supabaseAdmin
          .from("trips")
          .update({ star_user_id: userId, has_star: true })
          .eq("id", data.tripId);
      }
    }

    if (trip.data.owner_id === userId) {
      if (firstName) {
        await supabaseAdmin
          .from("trip_participants")
          .update({ display_name: firstName })
          .eq("trip_id", data.tripId)
          .eq("user_id", userId);
      }
      const [avail, prefs] = await Promise.all([
        supabaseAdmin
          .from("trip_availability")
          .select("id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("trip_participant_preferences")
          .select("user_id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      return {
        tripId: data.tripId,
        alreadyMember: true,
        isOwner: true,
        myAvailabilityDone: !avail.error && !!avail.data,
        myPreferencesDone: !prefs.error && !!prefs.data,
      };
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
      const [avail, prefs] = await Promise.all([
        supabaseAdmin
          .from("trip_availability")
          .select("id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("trip_participant_preferences")
          .select("user_id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      return {
        tripId: data.tripId,
        alreadyMember: true,
        isOwner: false,
        myAvailabilityDone: !avail.error && !!avail.data,
        myPreferencesDone: !prefs.error && !!prefs.data,
      };
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


export const checkJoinStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (typeof claims?.email === "string" ? claims.email : "").trim().toLowerCase();
    if (!email) throw new Error("Email de compte manquant — reconnecte-toi.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const trip = await supabaseAdmin
      .from("trips")
      .select("id, owner_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    let isParticipant = trip.data.owner_id === userId;

    if (!isParticipant) {
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
        isParticipant = true;
        // Si le user_id n'est pas lié ou statut pas accepté, on le met à jour
        if (existing.data.user_id !== userId || existing.data.status !== "accepte") {
          const patch: { user_id?: string | null; email?: string; status?: "invite" | "accepte" | "refuse" | "absent"; display_name?: string | null } = { user_id: userId, email, status: "accepte" };
          const updated = await supabaseAdmin
            .from("trip_participants")
            .update(patch)
            .eq("id", existing.data.id);
          if (updated.error) {
            console.error("checkJoinStatus: update user_id failed", updated.error.message);
          }
        }
      }
    }

    if (isParticipant) {
      const [avail, prefs] = await Promise.all([
        supabaseAdmin
          .from("trip_availability")
          .select("id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabaseAdmin
          .from("trip_participant_preferences")
          .select("user_id")
          .eq("trip_id", data.tripId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      return {
        alreadyJoined: true,
        myAvailabilityDone: !avail.error && !!avail.data,
        myPreferencesDone: !prefs.error && !!prefs.data,
      };
    }

    return {
      alreadyJoined: false,
      myAvailabilityDone: false,
      myPreferencesDone: false,
    };
  });


/** Données pour la page Récap du groupe (propositions + origines départ). */