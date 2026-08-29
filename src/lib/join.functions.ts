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

const inviteTokenSchema = z.string().uuid();

async function getInviteLinkRow(tripId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const link = await admin
    .from("trip_invite_links")
    .select("trip_id, token, created_at, rotated_at")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (link.error) throw link.error;
  return link.data as
    | { trip_id: string; token: string; created_at: string; rotated_at: string }
    | null;
}

async function hasValidInviteToken(tripId: string, token: string | null | undefined) {
  if (!token) return false;
  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) return false;
  const link = await getInviteLinkRow(tripId);
  return Boolean(link && link.token === parsed.data);
}

async function requireTripAdminForInviteLink(
  supabase: any,
  userId: string,
  tripId: string,
) {
  const trip = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id")
    .eq("id", tripId)
    .maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");
  const isAdmin = trip.data.owner_id === userId || trip.data.co_organizer_id === userId;
  if (!isAdmin) throw new Error("403 Forbidden");
  return trip.data;
}

export const getTripInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireTripAdminForInviteLink(context.supabase, context.userId, data.tripId);

    const existing = await getInviteLinkRow(data.tripId);
    if (existing) return { token: existing.token, rotatedAt: existing.rotated_at };

    const { randomUUID } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const created = await admin
      .from("trip_invite_links")
      .insert({ trip_id: data.tripId, token: randomUUID(), created_at: now, rotated_at: now })
      .select("token, rotated_at")
      .single();
    if (created.error) {
      // Deux admins peuvent ouvrir la page en même temps. Si l'autre a créé le lien,
      // relire la ligne plutôt que retourner une erreur à l'utilisateur.
      const raced = await getInviteLinkRow(data.tripId);
      if (raced) return { token: raced.token, rotatedAt: raced.rotated_at };
      throw created.error;
    }
    return { token: created.data.token as string, rotatedAt: created.data.rotated_at as string };
  });

export const rotateTripInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireTripAdminForInviteLink(context.supabase, context.userId, data.tripId);

    const { randomUUID } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const now = new Date().toISOString();
    const rotated = await admin
      .from("trip_invite_links")
      .upsert(
        { trip_id: data.tripId, token: randomUUID(), rotated_at: now },
        { onConflict: "trip_id" },
      )
      .select("token, rotated_at")
      .single();
    if (rotated.error) throw rotated.error;
    return { token: rotated.data.token as string, rotatedAt: rotated.data.rotated_at as string };
  });

/** Aperçu public d'un voyage : le secret d'invitation est obligatoire. */
export const getJoinPreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        token: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!(await hasValidInviteToken(data.tripId, data.token))) {
      throw new Error("Invitation invalide ou renouvelée");
    }

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
        token: z.string().uuid().optional().nullable(),
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
      .select("id, owner_id, name, celebrated_person, star_user_id, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (String((trip.data as any).status ?? "") === "annule") {
      throw new Error("Ce voyage a été annulé.");
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

    // Un ancien lien sans token reste compatible uniquement pour une personne déjà
    // rattachée au voyage ou explicitement invitée par e-mail.
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

    if (!(await hasValidInviteToken(data.tripId, data.token))) {
      throw new Error("Invitation invalide ou renouvelée");
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
        if (existing.data.user_id !== userId || existing.data.status !== "accepte") {
          const patch: {
            user_id?: string | null;
            email?: string;
            status?: "invite" | "accepte" | "refuse" | "absent";
            display_name?: string | null;
          } = { user_id: userId, email, status: "accepte" };
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
