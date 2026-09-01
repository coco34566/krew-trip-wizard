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
    const entries = await Promise.all(
      uniqueTripIds.map(async (tripId) => {
        try {
          const progress = await getParticipantsProgressHelper(context.supabase, tripId);
          return [
            tripId,
            {
              joined: progress.joined,
              participantsExpected: progress.participantsExpected,
              participantsActive: progress.preferencesExpected,
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
