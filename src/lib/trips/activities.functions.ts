import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

export const toggleActivityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), activityId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const recommendations = await supabase
      .from("recommendations")
      .select("activity_ids")
      .eq("trip_id", data.tripId);
    if (recommendations.error) throw recommendations.error;
    const belongsToTrip = (recommendations.data ?? []).some((row: any) =>
      Array.isArray(row.activity_ids) && row.activity_ids.includes(data.activityId),
    );
    if (!belongsToTrip) {
      throw new Error("Cette activité n'appartient pas aux propositions de ce voyage");
    }
    const existing = await supabase
      .from("activity_votes")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("activity_id", data.activityId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const { error } = await supabase.from("activity_votes").delete().eq("id", existing.data.id);
      if (error) throw error;
      return { voted: false };
    }
    const { error } = await supabase.from("activity_votes").insert({
      trip_id: data.tripId,
      activity_id: data.activityId,
      user_id: userId,
    });
    if (error) throw error;
    return { voted: true };
  });

export const finalizeSelectedActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        activityIds: z.array(z.string().uuid()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(trip.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut valider les activités",
      );
    }
    if (data.activityIds.length) {
      const recommendations = await supabase
        .from("recommendations")
        .select("activity_ids")
        .eq("trip_id", data.tripId);
      if (recommendations.error) throw recommendations.error;
      const proposedIds = new Set(
        (recommendations.data ?? []).flatMap((recommendation: any) => recommendation.activity_ids ?? []),
      );
      if (data.activityIds.some((activityId) => !proposedIds.has(activityId))) {
        throw new Error("Une activité sélectionnée ne fait pas partie des propositions de ce voyage");
      }
    }
    const { error } = await supabase
      .from("trips")
      .update({
        selected_activity_ids: data.activityIds,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, activityIds: data.activityIds };
  });
