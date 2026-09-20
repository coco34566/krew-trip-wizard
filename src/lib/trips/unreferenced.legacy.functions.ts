import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

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
    if (data.hardDelete) {
      if (trip.data.owner_id !== userId) {
        throw new Error("403 Forbidden: seul l'organisateur initial peut supprimer le voyage");
      }
      // CASCADE sur participants, prefs, recos si FK ON DELETE CASCADE
      const { error } = await supabase.from("trips").delete().eq("id", data.tripId);
      if (error) throw error;
      return { ok: true, mode: "deleted" as const };
    }

    if (!isTripAdmin(trip.data, userId))
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut annuler");

    const { error } = await supabase
      .from("trips")
      .update({ status: "annule", updated_at: new Date().toISOString() })
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, mode: "cancelled" as const };
  });

export const voteHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), hotelId: z.string().min(1) }).parse(data),
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

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const participant = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .neq("status", "absent")
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!isTripAdmin(tripRes.data, userId) && !participant.data) {
      throw new Error("403 Forbidden: seuls les membres du voyage peuvent voter");
    }
    const hotels = Array.isArray(logistics.hotels) ? logistics.hotels : [];
    if (!hotels.some((hotel: any) => String(hotel.id) === data.hotelId)) {
      throw new Error("Cet hébergement n'appartient pas aux propositions de ce voyage");
    }
    const votes: { userId: string; hotelId: string; at: string }[] = Array.isArray(
      logistics.hotelVotes,
    )
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    if (topId && !topId.startsWith("portal-")) {
      await supabaseAdmin
        .from("recommendations")
        .update({ accommodation_id: topId })
        .eq("trip_id", data.tripId)
        .eq("is_selected", true);
    }

    return { ok: true, hotelVotes: votes, selectedHotelId: topId };
  });

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
        durationHours: z.number().positive().max(72).optional().nullable(),
        outboundDepartureTime: z.string().max(10).optional().nullable(),
        returnArrivalTime: z.string().max(10).optional().nullable(),
        pricePerPerson: z.number().optional(),
        url: z.string().refine(isSafeExternalUrl, { message: "URL externe invalide" }).optional().nullable(),
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

    // Nom affiché
    const participant = await supabase
      .from("trip_participants")
      .select("display_name, email, status")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!isTripAdmin(tripRes.data, userId) && (!participant.data || participant.data.status === "absent")) {
      throw new Error("403 Forbidden: seuls les membres du voyage peuvent choisir un transport");
    }
    const displayName =
      (participant.data as any)?.display_name ||
      String((participant.data as any)?.email || "").split("@")[0] ||
      "Participant";

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const picks: any[] = Array.isArray(logistics.transportPicks)
      ? [...logistics.transportPicks]
      : [];
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
      durationHours: data.durationHours ?? null,
      outboundDepartureTime: data.outboundDepartureTime || null,
      returnArrivalTime: data.returnArrivalTime || null,
      pricePerPerson: data.pricePerPerson ?? null,
      url: safeExternalUrl(data.url),
      at: new Date().toISOString(),
    };
    if (idx >= 0) picks[idx] = entry;
    else picks.push(entry);

    const next = { ...logistics, transportPicks: picks };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, pick: entry, transportPicks: picks };
  });
