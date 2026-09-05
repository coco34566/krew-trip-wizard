import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  participantPreferencesSchema,
  submitParticipantPreferences as submitParticipantPreferencesLegacy,
} from "./participant-preferences.legacy";

/**
 * Keep the legacy questionnaire save flow, then explicitly persist the departure
 * city because the legacy schema-fallback payload can omit transport-specific
 * fields when it retries after an unrelated schema-cache/column error.
 *
 * Transport treats trip_participant_preferences.departure_city as the canonical
 * personal origin, so a questionnaire that displayed and accepted a city must
 * never finish successfully while leaving that value empty.
 */
export const submitParticipantPreferencesSafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => participantPreferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const result = await submitParticipantPreferencesLegacy({ data });
    const departureCity = String(data.departureCity ?? "").trim();

    if (departureCity) {
      const { error } = await context.supabase
        .from("trip_participant_preferences")
        .update({ departure_city: departureCity, updated_at: new Date().toISOString() })
        .eq("trip_id", data.tripId)
        .eq("user_id", context.userId);

      if (error) {
        throw new Error(
          `La ville de départ n’a pas pu être enregistrée: ${error.message || String(error)}`,
        );
      }
    }

    return result;
  });
