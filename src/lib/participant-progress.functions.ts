import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deriveResponseProgress,
  getEffectiveAvailabilityProgress,
  hasSecretStarAvailability,
  hasSecretStarPreferences,
  isInactiveResponseParticipant,
} from "@/lib/krew/response-progress";

export async function getParticipantsProgressHelper(supabase: any, tripId: string) {
  const [tripRes, participantsRes, preferencesRes, availabilitiesRes, starPrefsRes] = await Promise.all([
    supabase
      .from("trips")
      .select("celebrated_person, has_star, star_user_id, owner_id, co_organizer_id, group_logistics, dates_locked")
      .eq("id", tripId)
      .maybeSingle(),
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", tripId),
    supabase
      .from("trip_participant_preferences")
      .select("user_id, submitted_at, updated_at, departure_city")
      .eq("trip_id", tripId),
    supabase.from("trip_availability").select("user_id").eq("trip_id", tripId),
    supabase.from("trip_star_preferences").select("*").eq("trip_id", tripId).maybeSingle(),
  ]);

  if (tripRes.error) throw tripRes.error;
  if (!tripRes.data) throw new Error("Voyage introuvable");
  if (participantsRes.error) throw participantsRes.error;

  const participants = participantsRes.data ?? [];
  const activeParticipants = participants.filter(
    (participant: any) => !isInactiveResponseParticipant(participant.status),
  );
  const preferenceRows = preferencesRes.error ? [] : preferencesRes.data ?? [];
  const availabilityRows = availabilitiesRes.error ? [] : availabilitiesRes.data ?? [];
  const starPrefs = starPrefsRes.error ? null : starPrefsRes.data;
  const starMode = ((tripRes.data.group_logistics as any)?.star_mode ?? "secret") as
    | "secret"
    | "participant";
  const hasStar = Boolean(
    tripRes.data.has_star || tripRes.data.celebrated_person || tripRes.data.star_user_id,
  );

  const counts = deriveResponseProgress({
    ownerId: tripRes.data.owner_id,
    coOrganizerId: tripRes.data.co_organizer_id,
    hasStar,
    starUserId: tripRes.data.star_user_id,
    starMode,
    participants,
    preferenceUserIds: preferenceRows.map((row: any) => row.user_id),
    availabilityUserIds: availabilityRows.map((row: any) => row.user_id),
    secretStarHasPreferences: hasSecretStarPreferences(starPrefs),
    secretStarHasAvailability: hasSecretStarAvailability(starPrefs),
  });
  const effectiveAvailability = getEffectiveAvailabilityProgress({
    datesLocked: Boolean(tripRes.data.dates_locked),
    answered: counts.availabilityAnswered,
    expected: counts.availabilityExpected,
  });

  const prefByUser = new Map<string, any>();
  for (const row of preferenceRows as any[]) {
    if (row.user_id) prefByUser.set(row.user_id, row);
  }
  const availabilityUsers = new Set(
    availabilityRows.map((row: any) => row.user_id).filter(Boolean),
  );

  const partsList = activeParticipants
    .filter((participant: any) => Boolean(participant.user_id))
    .filter(
      (participant: any) =>
        !(hasStar && starMode === "secret" && tripRes.data.star_user_id === participant.user_id),
    )
    .map((participant: any) => {
      const preference = prefByUser.get(participant.user_id);
      return {
        ...participant,
        isStar:
          hasStar &&
          starMode === "participant" &&
          Boolean(tripRes.data.star_user_id && participant.user_id === tripRes.data.star_user_id),
        hasAnswered: Boolean(preference),
        hasAnsweredAvailability: availabilityUsers.has(participant.user_id),
        answeredAt: preference ? preference.updated_at || preference.submitted_at : null,
        // A single blank is intentional when the questionnaire has no origin yet:
        // it is truthy before the Transport page's fallback chain, then trims to an
        // empty string, so an old transport pick can never masquerade as an origin.
        departure_city: preference?.departure_city || " ",
      };
    });

  if (
    tripRes.data.owner_id &&
    !partsList.some((participant: any) => participant.user_id === tripRes.data.owner_id)
  ) {
    const ownerPref = prefByUser.get(tripRes.data.owner_id);
    partsList.unshift({
      id: `owner-${tripRes.data.owner_id}`,
      user_id: tripRes.data.owner_id,
      email: null,
      display_name: "Organisateur·rice",
      status: "accepte",
      isStar: false,
      hasAnswered: Boolean(ownerPref),
      hasAnsweredAvailability: availabilityUsers.has(tripRes.data.owner_id),
      answeredAt: ownerPref ? ownerPref.updated_at || ownerPref.submitted_at : null,
      departure_city: ownerPref?.departure_city || " ",
    });
  }

  if (counts.secretStarExpected) {
    partsList.push({
      id: "star-secret-progress",
      user_id: null,
      email: null,
      display_name: tripRes.data.celebrated_person || "La Star",
      status: "accepte",
      isStar: true,
      isSecretStar: true,
      hasAnswered: hasSecretStarPreferences(starPrefs),
      hasAnsweredAvailability: hasSecretStarAvailability(starPrefs),
      answeredAt: starPrefs?.updated_at || starPrefs?.submitted_at || null,
    });
  }

  return {
    joined: counts.expectedUserIds.length,
    expected: counts.preferencesExpected,
    total: counts.preferencesExpected,
    answered: counts.preferencesAnswered,
    availabilityAnswered: effectiveAvailability.answered,
    preferencesExpected: counts.preferencesExpected,
    availabilityExpected: effectiveAvailability.expected,
    pendingPrefs: counts.preferencesMissing,
    pendingAvailability: effectiveAvailability.missing,
    pendingJoin: 0,
    participants: partsList,
  };
}

export const getParticipantsProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => getParticipantsProgressHelper(context.supabase, data.tripId));
