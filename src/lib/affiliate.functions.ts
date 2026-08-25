import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const affiliateClickSchema = z.object({
  tripId: z.string().uuid(),
  provider: z.enum(["kiwi", "getyourguide", "booking", "kayak", "omio"]),
  source: z.string().trim().min(1).max(64),
  targetUrl: z.string().url().max(4096).refine((value) => /^https?:\/\//i.test(value), "URL externe invalide"),
  offerId: z.string().trim().max(200).optional(),
});

export const recordAffiliateClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => affiliateClickSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Reuse the trip RLS rules as the access check: a user who cannot read the
    // trip cannot attach an affiliate event to it.
    const trip = await supabase.from("trips").select("id").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const { error } = await (supabase as any).from("affiliate_clicks").insert({
      user_id: userId,
      trip_id: data.tripId,
      provider: data.provider,
      source: data.source,
      target_url: data.targetUrl,
      offer_id: data.offerId ?? null,
    });
    if (error) throw error;

    return { ok: true as const };
  });
