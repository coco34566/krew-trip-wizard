import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

export async function reactivateArchivedTripHelper(supabase: any, userId: string, tripId: string) {
  const trip = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id, status")
    .eq("id", tripId)
    .maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");
  if (!isTripAdmin(trip.data, userId)) {
    throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut réactiver le voyage");
  }
  if (String(trip.data.status ?? "") !== "annule") {
    return { ok: true, alreadyActive: true };
  }

  // Compatibility path for the historical archive implementation where
  // status=annule was used as a soft archive. No questionnaire, vote, planning
  // or logistics data is touched. Restore the closest functional status.
  const selected = await supabase
    .from("recommendations")
    .select("id")
    .eq("trip_id", tripId)
    .eq("is_selected", true)
    .limit(1);
  if (selected.error) throw selected.error;
  const restoredStatus = (selected.data ?? []).length > 0 ? "valide" : "en_preparation";

  const updated = await supabase
    .from("trips")
    .update({ status: restoredStatus, updated_at: new Date().toISOString() })
    .eq("id", tripId)
    .eq("status", "annule")
    .select("id, status")
    .single();
  if (updated.error) throw updated.error;
  return { ok: true, alreadyActive: false, status: updated.data.status };
}

export const reactivateArchivedTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) =>
    reactivateArchivedTripHelper(context.supabase, context.userId, data.tripId),
  );
