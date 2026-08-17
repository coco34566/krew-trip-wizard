import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rankDateWindows, type AvailabilityEntry } from "@/lib/krew/availability";
import { isTripAdmin } from "@/lib/krew/engine";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export async function getTripAvailabilityHelper(supabase: any, userId: string, tripId: string) {
  const trip = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");

  const [rows, participants, prefs] = await Promise.all([
    supabase.from("trip_availability").select("*").eq("trip_id", tripId),
    supabase
      .from("trip_participants")
      .select("id, user_id, email, display_name, status")
      .eq("trip_id", tripId),
    supabase
      .from("trip_preferences")
      .select("duration_nights")
      .eq("trip_id", tripId)
      .maybeSingle(),
  ]);
  if (rows.error) {
    const msg = String(rows.error.message || rows.error);
    if (msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")) {
      return {
        trip: {
          id: trip.data.id as string,
          name: trip.data.name as string,
          eventType: trip.data.event_type as string,
          celebratedPerson: trip.data.celebrated_person as string | null,
          hasStar: Boolean((trip.data as any).has_star),
          provisionalStart: (trip.data as any).provisional_start_date as string | null,
          provisionalEnd: (trip.data as any).provisional_end_date as string | null,
          durationNights: Number(prefs.data?.duration_nights ?? (trip.data as any).duration_nights ?? 2) || 2,
          datesLocked: Boolean((trip.data as any).dates_locked),
          lockedStart: null,
          lockedEnd: null,
          startDate: trip.data.start_date as string | null,
          endDate: trip.data.end_date as string | null,
        },
        isOwner: trip.data.owner_id === userId,
        answered: 0,
        expected: Math.max(Number(trip.data.participants_count) || 1, (participants.data ?? []).length, 1),
        windows: [],
        mine: null,
        participants: participants.data ?? [],
        schemaMissing: true,
      };
    }
    throw new Error(`Lecture dispos impossible: ${msg}`);
  }
  if (participants.error) throw participants.error;

  // The duration entered when creating the trip is the group-wide source of truth.
  // Falls back to trip_preferences.duration_nights if trips.duration_nights is missing (for older trips), then default 2.
  const rawTripDuration = (trip.data as any).duration_nights ?? prefs.data?.duration_nights;
  const tripDurationNights = rawTripDuration != null ? Number(rawTripDuration) : NaN;
  const nights = Number.isFinite(tripDurationNights) ? Math.max(0, tripDurationNights) : 2;

  const entries: AvailabilityEntry[] = (rows.data ?? []).map((r: any) => ({
    userId: r.user_id as string,
    availableDates: (r.available_dates ?? []).map((d: string) => String(d).slice(0, 10)),
    blockedDates: (r.blocked_dates ?? []).map((d: string) => String(d).slice(0, 10)),
    flexDays: Number(r.flex_days ?? 0),
    durationNights: Number(r.duration_nights ?? 2) || 2,
  }));

  const rawParticipants = participants.data ?? [];
  const activeParticipants = rawParticipants.filter((p: any) => p.status !== "absent");

  // Find the star in the participants list strictly via star_user_id
  const starUserId = (trip.data as any)?.star_user_id || null;
  const starParticipant = starUserId
    ? activeParticipants.find(p => p.user_id === starUserId) || null
    : null;

  // Resolve starUid safely (never use the form-filler's user ID, e.g. organizer, unless it's the actual star)
  const starUid = starParticipant?.user_id || starUserId || "star-virtual-uid";

  // Prendre en compte les disponibilités de la star si remplies dans trip_star_preferences
  try {
    const starPrefs = await supabase
      .from("trip_star_preferences")
      .select("*")
      .eq("trip_id", tripId)
      .maybeSingle();

    if (!starPrefs.error && starPrefs.data) {
      const starHasAvail = (starPrefs.data.available_dates && starPrefs.data.available_dates.length > 0) ||
                          (starPrefs.data.blocked_dates && starPrefs.data.blocked_dates.length > 0);
      if (starHasAvail) {
        const alreadyHasAvail = entries.some((e) => e.userId === starUid);
        if (!alreadyHasAvail) {
          entries.push({
            userId: starUid,
            availableDates: (starPrefs.data.available_dates ?? []).map((d: string) => String(d).slice(0, 10)),
            blockedDates: (starPrefs.data.blocked_dates ?? []).map((d: string) => String(d).slice(0, 10)),
            flexDays: 0,
            durationNights: 2,
          });
        }
      }
    }
  } catch (e) {
    console.warn("Skipped star availability aggregation in getTripAvailability", e);
  }

  const windowsRaw = rankDateWindows(entries, nights, 5);
  const celebratedPerson = (trip.data.celebrated_person as string | null)?.trim() || null;

  const nameByUser = new Map<string, string>();
  for (const p of participants.data ?? []) {
    const uid = p.user_id as string | null;
    if (!uid) continue;
    const isStar = Boolean(
      (starUserId && uid === starUserId) ||
      (starUid && uid === starUid)
    );
    const label = isStar && celebratedPerson
      ? celebratedPerson
      : (p.display_name as string | null)?.trim() ||
        (p.email as string | null)?.split("@")[0] ||
        "Participant";
    nameByUser.set(uid, label);
  }

  if (celebratedPerson) {
    if (starUserId) nameByUser.set(starUserId, celebratedPerson);
    if (starUid) nameByUser.set(starUid, celebratedPerson);
  }

  // Inclure les user_id qui ont répondu même sans ligne participants (ex. owner)
  for (const e of entries) {
    if (!nameByUser.has(e.userId)) {
      if (celebratedPerson && (e.userId === starUserId || e.userId === starUid)) {
        nameByUser.set(e.userId, celebratedPerson);
      } else {
        nameByUser.set(e.userId, "Participant");
      }
    }
  }

  const windows = windowsRaw.map((w) => ({
    ...w,
    availablePeople: w.availableUserIds.map((id) => ({
      userId: id,
      name: nameByUser.get(id) ?? "Participant",
    })),
    unavailablePeople: w.unavailableUserIds.map((id) => ({
      userId: id,
      name: nameByUser.get(id) ?? "Participant",
    })),
  }));

  const mine = (rows.data ?? []).find((r: any) => r.user_id === userId) ?? null;

  const answered = entries.length;
  const joined = (participants.data ?? []).length;
  // Dénominateur = taille de groupe prévue (ex. 6), pas seulement les déjà rejoints
  const expected = Math.max(Number(trip.data.participants_count) || 0, joined, 1);

  const datesLocked = Boolean((trip.data as any).dates_locked);

  return {
    trip: {
      id: trip.data.id as string,
      name: trip.data.name as string,
      eventType: trip.data.event_type as string,
      celebratedPerson: trip.data.celebrated_person as string | null,
      hasStar: Boolean((trip.data as any).has_star),
      provisionalStart: (trip.data as any).provisional_start_date as string | null,
      provisionalEnd: (trip.data as any).provisional_end_date as string | null,
      durationNights: nights,
      datesLocked,
      lockedStart: datesLocked ? (trip.data.start_date as string | null) : null,
      lockedEnd: datesLocked ? (trip.data.end_date as string | null) : null,
      startDate: trip.data.start_date as string | null,
      endDate: trip.data.end_date as string | null,
    },
    isOwner: trip.data.owner_id === userId,
    answered,
    expected,
    windows,
    mine: mine
      ? {
          availableDates: (mine.available_dates ?? []).map((d: string) => String(d).slice(0, 10)),
          blockedDates: (mine.blocked_dates ?? []).map((d: string) => String(d).slice(0, 10)),
          flexDays: Number(mine.flex_days ?? 0),
          notes: mine.notes as string | null,
          submittedAt: (mine.updated_at || mine.submitted_at) as string | null,
          durationNights: Number(mine.duration_nights ?? 2) || 2,
        }
      : null,
    participants: participants.data ?? [],
  };
}

export const getTripAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    return getTripAvailabilityHelper(supabase, userId, data.tripId);
  });

export const submitMyAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        availableDates: z.array(dateStr).default([]),
        blockedDates: z.array(dateStr).default([]),
        flexDays: z.number().int().min(0).max(14).default(0),
        notes: z.string().max(500).optional(),
        durationNights: z.number().int().min(0).max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const trip = await supabase
      .from("trips")
      .select("id, owner_id, participants_count, duration_nights, dates_locked")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    if ((trip.data as any).dates_locked) {
      throw new Error(
        "Les dates du séjour sont validées par l'organisateur : les disponibilités ne peuvent plus être modifiées.",
      );
    }

    const email = (typeof context.claims?.email === "string" ? context.claims.email : "").toLowerCase();
    if (trip.data.owner_id !== userId) {
      const part = await supabase
        .from("trip_participants")
        .select("id")
        .eq("trip_id", data.tripId)
        .or(email ? `user_id.eq.${userId},email.ilike.${email}` : `user_id.eq.${userId}`)
        .maybeSingle();
      if (part.error) throw part.error;
      if (!part.data) throw new Error("403 Forbidden");
    }

    const existing = await supabase
      .from("trip_availability")
      .select("id, submitted_at")
      .eq("trip_id", data.tripId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.error) {
      const msg = String(existing.error.message || existing.error);
      if (msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")) {
        throw new Error(
          "Table trip_availability absente. Exécute le SQL dispos dans Supabase (SQL Editor).",
        );
      }
      throw existing.error;
    }

    const payload = {
      trip_id: data.tripId,
      user_id: userId,
      available_dates: data.availableDates.map((d) => d.slice(0, 10)),
      blocked_dates: data.blockedDates.map((d) => d.slice(0, 10)),
      flex_days: data.flexDays,
      notes: data.notes ?? null,
      submitted_at: existing.data?.submitted_at ?? now,
      updated_at: now,
      duration_nights: data.durationNights ?? 2,
    };

    const { error } = await supabase
      .from("trip_availability")
      .upsert(payload, { onConflict: "trip_id,user_id" });
    if (error) {
      const msg = String(error.message || error);
      if (msg.includes("schema cache") || msg.includes("Could not find") || msg.includes("does not exist")) {
        throw new Error(
          "Table trip_availability absente. Exécute le SQL dispos dans Supabase (SQL Editor).",
        );
      }
      throw new Error(`Enregistrement dispos impossible: ${msg}`);
    }

    // Recalcule fenêtres → met à jour UNIQUEMENT provisional_* (jamais start/end si locked)
    const all = await supabase.from("trip_availability").select("*").eq("trip_id", data.tripId);
    if (!all.error && all.data) {
      const entries: AvailabilityEntry[] = all.data.map((r: any) => ({
        userId: r.user_id,
        availableDates: (r.available_dates ?? []).map((d: string) => String(d).slice(0, 10)),
        blockedDates: (r.blocked_dates ?? []).map((d: string) => String(d).slice(0, 10)),
        flexDays: Number(r.flex_days ?? 0),
        durationNights: Number(r.duration_nights ?? 2) || 2,
      }));
      // Always use the trip creation duration for group date proposals.
      // Falls back to trip_preferences.duration_nights if trips.duration_nights is missing (for older trips), then default 2.
      const prefRow = await supabase.from("trip_preferences").select("duration_nights").eq("trip_id", data.tripId).maybeSingle();
      const rawTripDuration = (trip.data as any).duration_nights ?? prefRow.data?.duration_nights;
      const tripDurationNights = rawTripDuration != null ? Number(rawTripDuration) : NaN;
      const nights = Number.isFinite(tripDurationNights) ? Math.max(0, tripDurationNights) : 2;
      const windows = rankDateWindows(entries, nights, 3);
      const best = windows[0];
      if (best) {
        const patch: Record<string, unknown> = {
          provisional_start_date: best.start,
          provisional_end_date: best.end,
          date_confidence:
            best.coverageRatio >= 0.9
              ? "forte"
              : best.coverageRatio >= 0.6
                ? "provisoire"
                : "faible",
        };
        // Ne touche PAS start_date / end_date ici — réservé à chooseTripDates
        await supabase.from("trips").update(patch as any).eq("id", data.tripId);
      }
    }

    return { ok: true, isUpdate: Boolean(existing.data) };
  });

export function buildDateDecisionPatch(input: {
  start: string;
  end: string;
  previousStart?: string | null;
  previousEnd?: string | null;
  refreshRequired?: Record<string, boolean> | null;
}) {
  const changed =
    Boolean(input.previousStart || input.previousEnd) &&
    (input.previousStart !== input.start || input.previousEnd !== input.end);
  return {
    start_date: input.start,
    end_date: input.end,
    provisional_start_date: input.start,
    provisional_end_date: input.end,
    dates_locked: true,
    date_confidence: "choisie",
    refresh_required: changed
      ? {
          ...(input.refreshRequired ?? {}),
          accommodations: true,
          transports: true,
        }
      : (input.refreshRequired ?? {}),
  };
}

/** Owner / Co-org only: vote or direct override converge on the same validated date state. */
export const chooseTripDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        startDate: dateStr,
        endDate: dateStr,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, start_date, end_date, refresh_required")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(trip.data, userId)) {
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut choisir la date");
    }

    const start = data.startDate.slice(0, 10);
    const end = data.endDate.slice(0, 10);
    if (start > end) throw new Error("La date de fin doit être après la date de début");

    const tripData = trip.data as any;
    const patch = buildDateDecisionPatch({
      start,
      end,
      previousStart: tripData.start_date,
      previousEnd: tripData.end_date,
      refreshRequired: tripData.refresh_required,
    });
    const { error } = await supabase
      .from("trips")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return { ok: true, startDate: start, endDate: end, datesLocked: true };
  });

/** Owner / Co-org only : déverrouille les dates (remet dates_locked = false, garde start/end). */
export const unlockTripDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid() }).parse(data),
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
      throw new Error("403 Forbidden: seul l'organisateur ou co-organisateur peut déverrouiller");
    }

    const { error } = await supabase
      .from("trips")
      .update({
        dates_locked: false,
        date_confidence: "provisoire",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;

    return { ok: true, datesLocked: false };
  });
