import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

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
  // Récupérer le voyage pour vérifier les droits d'administration.
  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id")
    .eq("id", tripId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!trip) throw new Error("Voyage introuvable");

  if (!isTripAdmin(trip, userId)) {
    throw new Error("403 Forbidden: seul un organisateur peut nommer un co-organisateur");
  }

  if (coOrganizerId) {
    if (coOrganizerId === trip.owner_id) {
      throw new Error("L'organisateur principal ne peut pas être son propre co-organisateur");
    }
    const participant = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", coOrganizerId)
      .neq("status", "absent")
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!participant.data) {
      throw new Error("Le co-organisateur doit être un participant actif de ce voyage");
    }
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
