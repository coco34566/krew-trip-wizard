import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rankDateWindows, type AvailabilityEntry } from "@/lib/krew/availability";
import { isTripAdmin } from "@/lib/krew/engine";
import {
  deriveResponseProgress,
  hasSecretStarAvailability,
  hasSecretStarPreferences,
  isInactiveResponseParticipant,
} from "@/lib/krew/response-progress";

export async function getTripAvailabilityHelper(supabase: any, userId: string, tripId: string) {
  const trip = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");

  const [rows, participants, prefs, preferenceRows, starPrefsRes] = await Promise.all([
    supabase.from("trip_availability").select("*").eq("trip_id", tripId),
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", tripId),
    supabase.from("trip_preferences").select("duration_nights").eq("trip_id", tripId).maybeSingle(),
    supabase
      .from("trip_participant_preferences")
      .select("user_id")
      .eq("trip_id", tripId),
    supabase.from("trip_star_preferences").select("*").eq("trip_id", tripId).maybeSingle(),
  ]);
  if (participants.error) throw participants.error;

  const rawParticipants = participants.data ?? [];
  const activeParticipants = rawParticipants.filter(
    (participant: any) => !isInactiveResponseParticipant(participant.status),
  );
  const inactiveUserIds = new Set(
    rawParticipants
      .filter((participant: any) => isInactiveResponseParticipant(participant.status))
      .map((participant: any) => participant.user_id)
      .filter(Boolean),
  );
  const starPrefs = starPrefsRes.error ? null : starPrefsRes.data;
  const starMode = ((trip.data.group_logistics as any)?.star_mode ?? "secret") as
    | "secret"
    | "participant";
  const hasStar = Boolean(trip.data.has_star || trip.data.celebrated_person || trip.data.star_user_id);

  const counts = deriveResponseProgress({
    ownerId: trip.data.owner_id,
    coOrganizerId: trip.data.co_organizer_id,
    hasStar,
    starUserId: trip.data.star_user_id,
    starMode,
    participants: rawParticipants,
    preferenceUserIds: (preferenceRows.error ? [] : preferenceRows.data ?? []).map((row: any) => row.user_id),
    availabilityUserIds: (rows.error ? [] : rows.data ?? []).map((row: any) => row.user_id),
    secretStarHasPreferences: hasSecretStarPreferences(starPrefs),
    secretStarHasAvailability: hasSecretStarAvailability(starPrefs),
  });

  const rawTripDuration = (trip.data as any).duration_nights ?? prefs.data?.duration_nights;
  const parsedDuration = rawTripDuration != null ? Number(rawTripDuration) : NaN;
  const nights = Number.isFinite(parsedDuration) ? Math.max(0, parsedDuration) : 2;

  if (rows.error) {
    const msg = String(rows.error.message || rows.error);
    if (msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")) {
      return {
        trip: {
          id: trip.data.id as string,
          name: trip.data.name as string,
          eventType: trip.data.event_type as string,
          celebratedPerson: trip.data.celebrated_person as string | null,
          hasStar,
          provisionalStart: trip.data.provisional_start_date as string | null,
          provisionalEnd: trip.data.provisional_end_date as string | null,
          durationNights: nights,
          datesLocked: Boolean(trip.data.dates_locked),
          lockedStart: null,
          lockedEnd: null,
          startDate: trip.data.start_date as string | null,
          endDate: trip.data.end_date as string | null,
        },
        isOwner: isTripAdmin(trip.data, userId),
        answered: 0,
        expected: counts.availabilityExpected,
        windows: [],
        mine: null,
        participants: rawParticipants,
        schemaMissing: true,
      };
    }
    throw new Error(`Lecture dispos impossible: ${msg}`);
  }

  const entries: AvailabilityEntry[] = (rows.data ?? [])
    .filter((row: any) => !inactiveUserIds.has(row.user_id))
    .filter(
      (row: any) =>
        !(hasStar && starMode === "secret" && trip.data.star_user_id && row.user_id === trip.data.star_user_id),
    )
    .map((row: any) => ({
      userId: row.user_id as string,
      availableDates: (row.available_dates ?? []).map((date: string) => String(date).slice(0, 10)),
      blockedDates: (row.blocked_dates ?? []).map((date: string) => String(date).slice(0, 10)),
      flexDays: Number(row.flex_days ?? 0),
      durationNights: Number(row.duration_nights ?? 2) || 2,
    }));

  if (hasStar && starMode === "secret" && hasSecretStarAvailability(starPrefs)) {
    entries.push({
      userId: "star-secret-progress",
      availableDates: (starPrefs.available_dates ?? []).map((date: string) => String(date).slice(0, 10)),
      blockedDates: (starPrefs.blocked_dates ?? []).map((date: string) => String(date).slice(0, 10)),
      flexDays: 0,
      durationNights: nights,
    });
  }

  const celebratedPerson = (trip.data.celebrated_person as string | null)?.trim() || null;
  const nameByUser = new Map<string, string>();
  for (const participant of activeParticipants) {
    if (!participant.user_id) continue;
    if (hasStar && starMode === "secret" && participant.user_id === trip.data.star_user_id) continue;
    const isParticipantStar =
      hasStar && starMode === "participant" && participant.user_id === trip.data.star_user_id;
    nameByUser.set(
      participant.user_id,
      isParticipantStar && celebratedPerson
        ? celebratedPerson
        : participant.display_name?.trim() || participant.email?.split("@")[0] || "Participant",
    );
  }
  if (hasStar && starMode === "secret" && celebratedPerson) {
    nameByUser.set("star-secret-progress", celebratedPerson);
  }
  if (!nameByUser.has(trip.data.owner_id)) nameByUser.set(trip.data.owner_id, "Organisateur·rice");

  const windows = rankDateWindows(entries, nights, 5).map((window) => ({
    ...window,
    availablePeople: window.availableUserIds.map((id) => ({ userId: id, name: nameByUser.get(id) ?? "Participant" })),
    unavailablePeople: window.unavailableUserIds.map((id) => ({ userId: id, name: nameByUser.get(id) ?? "Participant" })),
  }));

  const mine = (rows.data ?? []).find(
    (row: any) => row.user_id === userId && !inactiveUserIds.has(userId),
  ) ?? null;
  const datesLocked = Boolean(trip.data.dates_locked);

  return {
    trip: {
      id: trip.data.id as string,
      name: trip.data.name as string,
      eventType: trip.data.event_type as string,
      celebratedPerson: trip.data.celebrated_person as string | null,
      hasStar,
      provisionalStart: trip.data.provisional_start_date as string | null,
      provisionalEnd: trip.data.provisional_end_date as string | null,
      durationNights: nights,
      datesLocked,
      lockedStart: datesLocked ? (trip.data.start_date as string | null) : null,
      lockedEnd: datesLocked ? (trip.data.end_date as string | null) : null,
      startDate: trip.data.start_date as string | null,
      endDate: trip.data.end_date as string | null,
    },
    isOwner: isTripAdmin(trip.data, userId),
    answered: counts.availabilityAnswered,
    expected: counts.availabilityExpected,
    windows,
    mine: mine
      ? {
          availableDates: (mine.available_dates ?? []).map((date: string) => String(date).slice(0, 10)),
          blockedDates: (mine.blocked_dates ?? []).map((date: string) => String(date).slice(0, 10)),
          flexDays: Number(mine.flex_days ?? 0),
          notes: mine.notes as string | null,
          submittedAt: (mine.updated_at || mine.submitted_at) as string | null,
          durationNights: Number(mine.duration_nights ?? 2) || 2,
        }
      : null,
    participants: rawParticipants,
  };
}

export const getTripAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => getTripAvailabilityHelper(context.supabase, context.userId, data.tripId));
