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
 * Atomic personal/shared transport selection.
 * Legacy userId picks remain readable; new entries also carry participantId so
 * Star-without-account and shared journey groups do not depend on an auth uid.
 */
export const pickTransportAtomic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        target: z.enum(["self", "star"]).default("self"),
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
        sharedGroupId: z.string().max(180).optional().nullable(),
        driverParticipantId: z.string().max(180).optional().nullable(),
        driverDisplayName: z.string().max(120).optional().nullable(),
        isDriver: z.boolean().optional(),
        passengerCapacity: z.number().int().min(1).max(8).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, celebrated_person, star_user_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const isAdmin = isTripAdmin(tripRes.data, userId);
    const selectingStar = data.target === "star";
    if (selectingStar && !isAdmin) {
      throw new Error("403 Forbidden: seul l’organisateur ou co-organisateur peut choisir pour la Star");
    }

    const [participant, preferences, starPreferences] = await Promise.all([
      supabase
        .from("trip_participants")
        .select("id, display_name, email, status")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("trip_participant_preferences")
        .select("departure_city")
        .eq("trip_id", data.tripId)
        .eq("user_id", userId)
        .maybeSingle(),
      selectingStar
        ? supabase
            .from("trip_star_preferences")
            .select("user_id, departure_city")
            .eq("trip_id", data.tripId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as any),
    ]);

    if (participant.error) throw participant.error;
    if (preferences.error) throw preferences.error;
    if (starPreferences.error) throw starPreferences.error;

    if (
      !selectingStar &&
      !isAdmin &&
      (!participant.data || participant.data.status === "absent" || participant.data.status === "refuse")
    ) {
      throw new Error("403 Forbidden: seuls les membres actifs du voyage peuvent choisir un transport");
    }

    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const existingPicks = Array.isArray(logistics.transportPicks) ? logistics.transportPicks : [];

    let targetParticipantId: string;
    let targetUserId: string | null;
    let displayName: string;
    let departureCity: string;

    if (selectingStar) {
      const connectedStarUid =
        (starPreferences.data as any)?.user_id || (tripRes.data as any).star_user_id || null;
      targetParticipantId = `star:${data.tripId}`;
      targetUserId = connectedStarUid;
      displayName = String((tripRes.data as any).celebrated_person || "Star");
      departureCity = String((starPreferences.data as any)?.departure_city || "").trim();
      if (!departureCity && connectedStarUid) {
        const connectedStarPrefs = await supabase
          .from("trip_participant_preferences")
          .select("departure_city")
          .eq("trip_id", data.tripId)
          .eq("user_id", connectedStarUid)
          .maybeSingle();
        if (connectedStarPrefs.error) throw connectedStarPrefs.error;
        departureCity = String(connectedStarPrefs.data?.departure_city || "").trim();
      }
    } else {
      targetParticipantId = participant.data?.id || `user:${userId}`;
      targetUserId = userId;
      displayName =
        participant.data.display_name ||
        String(participant.data.email || "").split("@")[0] ||
        "Participant";
      departureCity = String(preferences.data?.departure_city ?? "").trim();
    }

    if (!departureCity) {
      throw new Error(
        selectingStar
          ? "Renseigne la ville de départ de la Star avant de choisir son trajet"
          : "Renseigne ta ville de départ dans tes préférences avant de choisir un trajet",
      );
    }
    if (normalizeCity(departureCity) !== normalizeCity(data.city)) {
      throw new Error(
        selectingStar
          ? "Choisis un trajet depuis la ville de départ de la Star"
          : "Tu peux choisir uniquement un trajet depuis ta ville de départ",
      );
    }

    let sharedGroupId = data.sharedGroupId || null;
    let driverParticipantId = data.driverParticipantId || null;
    let driverDisplayName = data.driverDisplayName || null;
    let label = data.label;
    let mode = data.mode;
    let modeLabel = data.modeLabel || data.mode;
    let passengerCapacity = data.passengerCapacity ?? null;
    let isDriver = Boolean(data.isDriver);

    if (driverParticipantId) {
      const driver = existingPicks.find(
        (pick: any) => pick?.participantId === driverParticipantId && pick?.isDriver && pick?.sharedGroupId,
      );
      if (!driver) throw new Error("Cette voiture n’est plus disponible");
      if (normalizeCity(driver.city) !== normalizeCity(departureCity)) {
        throw new Error("Cette voiture ne part pas de ta ville de départ");
      }
      const groupMembers = existingPicks.filter(
        (pick: any) => pick?.sharedGroupId === driver.sharedGroupId && !pick?.stale,
      );
      const capacity = Math.max(0, Number(driver.passengerCapacity || 0));
      const passengers = Math.max(0, groupMembers.length - 1);
      const alreadyInGroup = groupMembers.some(
        (pick: any) =>
          pick?.participantId === targetParticipantId ||
          (targetUserId && pick?.userId === targetUserId),
      );
      if (!alreadyInGroup && passengers >= capacity) {
        throw new Error("Cette voiture est complète");
      }

      sharedGroupId = driver.sharedGroupId;
      driverDisplayName = driver.displayName || driver.driverDisplayName || null;
      label = driver.label;
      mode = driver.mode;
      modeLabel = driver.modeLabel || driver.mode;
      passengerCapacity = null;
      isDriver = false;
    } else if (isDriver) {
      sharedGroupId = `car:${targetParticipantId}`;
      driverParticipantId = targetParticipantId;
      driverDisplayName = displayName;
      label = `Voiture de ${displayName}`;
      passengerCapacity = passengerCapacity ?? 3;
    }

    const entry = {
      participantId: targetParticipantId,
      userId: targetUserId,
      displayName,
      city: departureCity,
      mode,
      modeLabel,
      label,
      time: data.time || data.arrivalTime || null,
      arrivalTime: data.arrivalTime || data.time || null,
      departureTime: data.departureTime || null,
      durationHours: data.durationHours ?? null,
      outboundDepartureTime: data.outboundDepartureTime || null,
      returnArrivalTime: data.returnArrivalTime || null,
      pricePerPerson: data.pricePerPerson ?? null,
      url: data.url || null,
      sharedGroupId,
      driverParticipantId,
      driverDisplayName,
      isDriver,
      passengerCapacity,
      status: "sélectionné",
      selectedByUserId: userId,
      at: new Date().toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const rpc = await admin.rpc("krew_upsert_transport_picks_atomic", {
      p_trip_id: data.tripId,
      p_entries: [entry],
    });
    if (rpc.error) throw rpc.error;

    const result = (rpc.data ?? {}) as { transportPicks?: (typeof entry)[] };
    return {
      ok: true,
      pick: entry,
      transportPicks: Array.isArray(result.transportPicks) ? result.transportPicks : [entry],
    };
  });


export const getStarTransportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, celebrated_person, star_user_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const isAdmin = isTripAdmin(trip.data, userId);
    if (!isAdmin) return { canManage: false, name: null, departureCity: null, isSecret: false };

    const prefs = await supabase
      .from("trip_star_preferences")
      .select("user_id, departure_city")
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (prefs.error) throw prefs.error;

    const logistics = ((trip.data as any).group_logistics || {}) as any;
    const isSecret = logistics.star_mode === "secret" || !(trip.data as any).star_user_id;
    return {
      canManage: isSecret,
      name: (trip.data as any).celebrated_person || "Star",
      departureCity: String((prefs.data as any)?.departure_city || "").trim() || null,
      isSecret,
    };
  });
