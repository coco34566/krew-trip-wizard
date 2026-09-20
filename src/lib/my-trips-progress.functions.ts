import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getParticipantsProgressHelper } from "@/lib/participant-progress.functions";

export const getMyTripsProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripIds: z.array(z.string().uuid()).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const uniqueTripIds = [...new Set(data.tripIds)];
    if (!uniqueTripIds.length) return {};

    const visibleTrips = await context.supabase
      .from("trips")
      .select("id")
      .in("id", uniqueTripIds);
    if (visibleTrips.error) throw visibleTrips.error;

    const visibleTripIds = new Set((visibleTrips.data ?? []).map((trip) => trip.id));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const entries = await Promise.all(
      uniqueTripIds.map(async (tripId) => {
        if (!visibleTripIds.has(tripId)) return null;
        try {
          const progress = await getParticipantsProgressHelper(supabaseAdmin, tripId);
          return [
            tripId,
            {
              joined: progress.joined,
              participantsExpected: progress.participantsExpected,
              participantsActive: progress.preferencesExpected,
              questionnaireExpected: progress.questionnaireExpected,
              questionnaireAnswered: progress.questionnaireAnswered,
              preferencesExpected: progress.preferencesExpected,
              preferencesAnswered: progress.answered,
              availabilityExpected: progress.availabilityExpected,
              availabilityAnswered: progress.availabilityAnswered,
            },
          ] as const;
        } catch {
          // Keep listMyTrips' fallback for a row the viewer can no longer read.
          return null;
        }
      }),
    );

    return Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, unknown]>);
  });
