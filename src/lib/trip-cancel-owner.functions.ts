import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export function canArchiveTrip(trip: { owner_id?: string | null }, userId: string): boolean {
  return Boolean(trip.owner_id && trip.owner_id === userId);
}

export const cancelTripOwnerOnly = createServerFn({ method: "POST" })
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

    if (!canArchiveTrip(trip.data, userId)) {
      throw new Error(
        data.hardDelete
          ? "403 Forbidden: seul l'organisateur initial peut supprimer le voyage"
          : "403 Forbidden: seul l'organisateur peut archiver le voyage",
      );
    }

    if (data.hardDelete) {
      const { error } = await supabase.from("trips").delete().eq("id", data.tripId);
      if (error) throw error;
      return { ok: true, mode: "deleted" as const };
    }

    const { error } = await supabase
      .from("trips")
      .update({ status: "annule", updated_at: new Date().toISOString() })
      .eq("id", data.tripId);
    if (error) throw error;
    return { ok: true, mode: "cancelled" as const };
  });
