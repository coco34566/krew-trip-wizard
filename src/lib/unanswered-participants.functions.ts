import { isInactiveResponseParticipant } from "@/lib/krew/response-progress";

/**
 * Returns only real, active members who still need to answer preferences.
 * Pending invitations/placeholders without a user_id are deliberately excluded:
 * they are invitation capacity, not questionnaire respondents.
 */
export async function listUnansweredParticipants(supabase: any, tripId: string) {
  const [participantsRes, prefsRes] = await Promise.all([
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status, created_at")
      .eq("trip_id", tripId),
    supabase
      .from("trip_participant_preferences")
      .select("user_id, submitted_at, updated_at")
      .eq("trip_id", tripId),
  ]);

  if (participantsRes.error) throw participantsRes.error;
  if (prefsRes.error) throw prefsRes.error;

  const answeredUserIds = new Set(
    (prefsRes.data ?? []).map((row: any) => row.user_id).filter(Boolean),
  );

  const seen = new Set<string>();
  return (participantsRes.data ?? []).filter((participant: any) => {
    if (!participant.user_id) return false;
    if (isInactiveResponseParticipant(participant.status)) return false;
    if (seen.has(participant.user_id)) return false;
    seen.add(participant.user_id);
    return !answeredUserIds.has(participant.user_id);
  });
}
