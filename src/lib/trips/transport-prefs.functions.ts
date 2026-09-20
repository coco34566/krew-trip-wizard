import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin, computeGroupTimeWindowExtended } from "@/lib/krew/engine";

export const setMyTransportTimePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        earliestDepartureTime: z.string().max(10).nullable(),
        latestReturnTime: z.string().max(10).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    const { data: participant, error: partErr } = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", data.tripId)
      .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
      .maybeSingle();

    if (partErr || !participant) {
      throw new Error("403 Forbidden: vous n'êtes pas participant de ce voyage");
    }

    const { error } = await supabase.from("trip_transport_time_prefs").upsert(
      {
        trip_id: data.tripId,
        participant_id: participant.id,
        earliest_departure_time: data.earliestDepartureTime,
        latest_return_time: data.latestReturnTime,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,participant_id" },
    );

    if (error) throw error;
    return { ok: true };
  });

export const getGroupTransportTimeWindow = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [rowsRes, tripRes] = await Promise.all([
      supabase
        .from("trip_transport_time_prefs")
        .select("earliest_departure_time, latest_return_time")
        .eq("trip_id", data.tripId),
      supabase.from("trips").select("group_logistics").eq("id", data.tripId).maybeSingle(),
    ]);

    if (rowsRes.error) throw rowsRes.error;
    if (tripRes.error) throw tripRes.error;

    const picks = Array.isArray((tripRes.data as any)?.group_logistics?.transportPicks)
      ? (tripRes.data as any).group_logistics.transportPicks
      : [];

    const window = computeGroupTimeWindowExtended(rowsRes.data ?? [], picks);
    return window;
  });

export const setTransportTimeFilters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        /** Arriver avant cette heure le jour 1 (HH:mm) */
        arriveBy: z.string().max(10).optional().nullable(),
        /** Ne pas repartir avant cette heure le dernier jour (HH:mm) */
        departAfter: z.string().max(10).optional().nullable(),
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
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut définir les filtres horaires",
      );
    }
    const logistics = ((tripRes.data as any).group_logistics || {}) as any;
    const next = {
      ...logistics,
      timeFilters: {
        arriveBy: data.arriveBy || null,
        departAfter: data.departAfter || null,
      },
    };
    const { error } = await supabase
      .from("trips")
      .update({ group_logistics: next, updated_at: new Date().toISOString() } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, timeFilters: next.timeFilters };
  });
