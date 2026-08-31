import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

function normalizeCity(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

/**
 * Atomic replacement for the legacy hotel-vote handler.
 * Access checks remain application-side; the actual JSONB mutation is performed
 * under a row lock by a service-role-only Postgres RPC.
 */
export const voteHotelAtomic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), hotelId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const rpc = await admin.rpc("krew_vote_hotel_atomic", {
      p_trip_id: data.tripId,
      p_user_id: userId,
      p_hotel_id: data.hotelId,
    });
    if (rpc.error) throw rpc.error;

    const result = (rpc.data ?? {}) as {
      hotelVotes?: { userId: string; hotelId: string; at: string }[];
      selectedHotelId?: string | null;
    };
    const hotelVotes = Array.isArray(result.hotelVotes) ? result.hotelVotes : [];
    const selectedHotelId = result.selectedHotelId ?? null;

    if (selectedHotelId && !selectedHotelId.startsWith("portal-")) {
      // Preserve the legacy best-effort sync: the vote itself is authoritative,
      // and a recommendation sync failure must not turn a successful vote into an error.
      await admin
        .from("recommendations")
        .update({ accommodation_id: selectedHotelId })
        .eq("trip_id", data.tripId)
        .eq("is_selected", true);
    }

    return { ok: true, hotelVotes, selectedHotelId };
  });

/**
 * Atomic replacement for the legacy personal transport selection handler.
 * A participant can only update their own pick and only from the departure city
 * explicitly stored in their questionnaire preferences.
 */
export const pickTransportAtomic = createServerFn({ method: "POST" })
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
        arrivalTime: z.string().max(10).optional().nullable(),
        departureTime: z.string().max(10).optional().nullable(),
        durationHours: z.number().positive().max(72).optional().nullable(),
        outboundDepartureTime: z.string().max(10).optional().nullable(),
        returnArrivalTime: z.string().max(10).optional().nullable(),
        pricePerPerson: z.number().optional(),
        url: z.string().url().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const [participant, preferences] = await Promise.all([
      supabase
        .from("trip_participants")
        .select("display_name, email, status")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trip_participant_preferences")
        .select("departure_city")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (participant.error) throw participant.error;
    if (preferences.error) throw preferences.error;
    if (
      !isTripAdmin(tripRes.data, userId) &&
      (!participant.data || participant.data.status === "absent" || participant.data.status === "refuse")
    ) {
      throw new Error("403 Forbidden: seuls les membres actifs du voyage peuvent choisir un transport");
    }

    const departureCity = String(preferences.data?.departure_city ?? "").trim();
    if (!departureCity) {
      throw new Error("Renseigne ta ville de départ dans tes préférences avant de choisir un trajet");
    }
    if (normalizeCity(departureCity) !== normalizeCity(data.city)) {
      throw new Error("Tu peux choisir uniquement un trajet depuis ta ville de départ");
    }

    const displayName =
      participant.data?.display_name ||
      String(participant.data?.email || "").split("@")[0] ||
      "Participant";

    const entry = {
      userId,
      displayName,
      city: departureCity,
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
      url: data.url || null,
      at: new Date().toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const rpc = await admin.rpc("krew_pick_transport_atomic", {
      p_trip_id: data.tripId,
      p_user_id: userId,
      p_entry: entry,
    });
    if (rpc.error) throw rpc.error;

    const result = (rpc.data ?? {}) as {
      pick?: typeof entry;
      transportPicks?: (typeof entry)[];
    };

    return {
      ok: true,
      pick: result.pick ?? entry,
      transportPicks: Array.isArray(result.transportPicks) ? result.transportPicks : [entry],
    };
  });
