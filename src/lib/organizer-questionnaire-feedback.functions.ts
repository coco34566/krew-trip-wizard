import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getParticipantsProgressHelper } from "@/lib/participant-progress.functions";
import { isInactiveResponseParticipant } from "@/lib/krew/response-progress";

const inputSchema = z.object({ tripId: z.string().uuid() });

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
};

const cleanStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];

const flightAnswer = (modes: unknown): boolean | null => {
  const list = cleanStrings(modes).map((mode) =>
    mode.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
  );
  if (!list.length) return null;
  if (list.some((mode) => mode.includes("peu importe") || mode.includes("any"))) return true;
  return list.some((mode) => mode.includes("avion") || mode.includes("flight"));
};

export const getOrganizerQuestionnaireFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tripRes = await supabase
      .from("trips")
      .select(
        "id, name, owner_id, co_organizer_id, participants_count, celebrated_person, has_star, star_user_id, group_logistics",
      )
      .eq("id", data.tripId)
      .maybeSingle();

    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");

    const isAdmin =
      tripRes.data.owner_id === userId || tripRes.data.co_organizer_id === userId;
    if (!isAdmin) {
      throw new Error("403 Forbidden: réservé à l’organisateur et au co-organisateur");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [participantsRes, prefsRes, availabilityRes, starPrefsRes, progress] =
      await Promise.all([
        supabaseAdmin
          .from("trip_participants")
          .select("id, user_id, email, display_name, status, role")
          .eq("trip_id", data.tripId),
        supabaseAdmin
          .from("trip_participant_preferences")
          .select("*")
          .eq("trip_id", data.tripId),
        supabaseAdmin
          .from("trip_availability")
          .select("*")
          .eq("trip_id", data.tripId),
        supabaseAdmin
          .from("trip_star_preferences")
          .select("*")
          .eq("trip_id", data.tripId)
          .maybeSingle(),
        getParticipantsProgressHelper(supabaseAdmin, data.tripId),
      ]);

    if (participantsRes.error) throw participantsRes.error;
    if (prefsRes.error) throw prefsRes.error;
    if (availabilityRes.error) throw availabilityRes.error;

    const trip = tripRes.data;
    const participants = (participantsRes.data ?? []).filter(
      (participant: any) => !isInactiveResponseParticipant(participant.status),
    );
    const prefs = prefsRes.data ?? [];
    const availability = availabilityRes.data ?? [];
    const starPrefs = starPrefsRes.error ? null : starPrefsRes.data;
    const logistics = (trip.group_logistics as any) ?? {};
    const starMode = (logistics.star_mode ?? "secret") as "secret" | "participant";

    const participantByUserId = new Map(
      participants
        .filter((participant: any) => participant.user_id)
        .map((participant: any) => [participant.user_id as string, participant]),
    );
    const prefByUserId = new Map(
      prefs
        .filter((row: any) => row.user_id)
        .map((row: any) => [row.user_id as string, row]),
    );
    const availabilityByUserId = new Map(
      availability
        .filter((row: any) => row.user_id)
        .map((row: any) => [row.user_id as string, row]),
    );

    const displayNameFor = (userIdValue: string | null | undefined, fallback?: string | null) => {
      if (!userIdValue) return fallback || "Participant";
      const participant = participantByUserId.get(userIdValue);
      return (
        participant?.display_name ||
        participant?.email?.split("@")?.[0] ||
        fallback ||
        (userIdValue === trip.owner_id
          ? "Organisateur·rice"
          : userIdValue === trip.co_organizer_id
            ? "Co-organisateur·rice"
            : "Participant")
      );
    };

    const submitted: any[] = [];
    const pending: Array<{ id: string; name: string; isStar: boolean }> = [];
    const comments: Array<{
      id: string;
      author: string;
      text: string;
      createdAt: string;
      kind: "comment" | "mobility" | "availability";
    }> = [];

    for (const progressParticipant of progress.participants as any[]) {
      const isSecretStar = Boolean(progressParticipant.isSecretStar);
      const isStar = Boolean(progressParticipant.isStar);

      if (isSecretStar) {
        const author = trip.celebrated_person || "La Star";
        if (!starPrefs?.submitted_at) {
          pending.push({ id: "star-secret", name: author, isStar: true });
          continue;
        }

        const modes = cleanStrings(starPrefs.transport_mode_accepted);
        const availableDates = cleanStrings(starPrefs.available_dates);
        const blockedDates = cleanStrings(starPrefs.blocked_dates);
        submitted.push({
          id: "star-secret",
          userId: null,
          name: author,
          isStar: true,
          submittedAt: starPrefs.submitted_at,
          departureCity: starPrefs.departure_city ?? null,
          flightAccepted: flightAnswer(starPrefs.transport_mode_accepted),
          transportModes: modes,
          maxTravelHours:
            starPrefs.max_travel_duration_hours != null
              ? Number(starPrefs.max_travel_duration_hours)
              : null,
          budgetMax: null,
          accommodation: {
            role: starPrefs.accommodation_role ?? null,
            lodgingTypes: [],
            roomType: null,
            acceptsSharedRoom: null,
            requiredAmenities: [],
          },
          constraints: {
            dietary: [],
            excludedDestinations: cleanStrings(starPrefs.excluded_destinations),
            dealBreakerAmbiances: [],
            dealBreakers: cleanStrings(starPrefs.deal_breakers),
            accessibility: null,
          },
          wishes: cleanStrings(starPrefs.wanted_activities),
          ambiances: cleanStrings(starPrefs.ambiances),
          wantedEnvironment: starPrefs.wanted_env_type ?? null,
          dates: { available: availableDates, blocked: blockedDates, flexDays: null },
        });

        if (starPrefs.notes?.trim()) {
          comments.push({
            id: "star-notes",
            author,
            text: starPrefs.notes.trim(),
            createdAt: starPrefs.updated_at || starPrefs.submitted_at,
            kind: "comment",
          });
        }
        continue;
      }

      const userIdValue = progressParticipant.user_id as string | null;
      const pref = userIdValue ? prefByUserId.get(userIdValue) : null;
      const participant = userIdValue ? participantByUserId.get(userIdValue) : null;
      const author = displayNameFor(userIdValue, progressParticipant.display_name);
      const isSubmitted = Boolean(pref?.submitted_at);

      if (!isSubmitted) {
        pending.push({
          id: progressParticipant.id || userIdValue || author,
          name: author,
          isStar,
        });
        continue;
      }

      const avail = userIdValue ? availabilityByUserId.get(userIdValue) : null;
      submitted.push({
        id: participant?.id || userIdValue,
        userId: userIdValue,
        name: author,
        isStar,
        submittedAt: pref.submitted_at,
        departureCity: pref.departure_city ?? null,
        flightAccepted: flightAnswer(pref.transport_mode_accepted),
        transportModes: cleanStrings(pref.transport_mode_accepted),
        maxTravelHours:
          pref.max_travel_duration_hours != null
            ? Number(pref.max_travel_duration_hours)
            : null,
        budgetMax: pref.budget_max != null ? Number(pref.budget_max) : null,
        accommodation: {
          role: pref.accommodation_role ?? null,
          lodgingTypes: cleanStrings(pref.lodging_type_preferences),
          roomType: pref.room_type_preference ?? null,
          acceptsSharedRoom:
            typeof pref.accepts_shared_room === "boolean" ? pref.accepts_shared_room : null,
          requiredAmenities: cleanStrings(pref.required_amenities),
        },
        constraints: {
          dietary: cleanStrings(pref.dietary_constraints),
          excludedDestinations: cleanStrings(pref.excluded_destinations),
          dealBreakerAmbiances: cleanStrings(pref.deal_breaker_ambiances),
          dealBreakers: [],
          accessibility:
            typeof pref.accessibility_needs === "boolean" ? pref.accessibility_needs : null,
        },
        wishes: cleanStrings(pref.activity_categories),
        ambiances: cleanStrings(pref.ambiances),
        wantedEnvironment: pref.wanted_env_type ?? null,
        dates: {
          available: cleanStrings(avail?.available_dates),
          blocked: cleanStrings(avail?.blocked_dates),
          flexDays: avail?.flex_days != null ? Number(avail.flex_days) : null,
        },
      });

      const prefTimestamp = pref.updated_at || pref.submitted_at;
      if (pref.free_text?.trim()) {
        comments.push({
          id: `pref:${userIdValue}:free`,
          author,
          text: pref.free_text.trim(),
          createdAt: prefTimestamp,
          kind: "comment",
        });
      }
      if (pref.mobility_notes?.trim()) {
        comments.push({
          id: `pref:${userIdValue}:mobility`,
          author,
          text: pref.mobility_notes.trim(),
          createdAt: prefTimestamp,
          kind: "mobility",
        });
      }
      if (avail?.notes?.trim()) {
        comments.push({
          id: `availability:${userIdValue}`,
          author,
          text: avail.notes.trim(),
          createdAt: avail.updated_at || avail.submitted_at || prefTimestamp,
          kind: "availability",
        });
      }
    }

    const budgets = submitted
      .map((item) => item.budgetMax)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const flightDeclared = submitted.filter(
      (item) => item.flightAccepted === true || item.flightAccepted === false,
    );
    const flightAccepted = flightDeclared.filter((item) => item.flightAccepted === true).length;
    const constraintCount = submitted.filter((item) => {
      const constraints = item.constraints;
      return Boolean(
        constraints.accessibility ||
          constraints.dietary.length ||
          constraints.excludedDestinations.length ||
          constraints.dealBreakerAmbiances.length ||
          constraints.dealBreakers.length,
      );
    }).length;

    comments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const unjoinedExpected = Math.max(
      0,
      progress.total - submitted.length - pending.length,
    );

    return {
      trip: {
        id: trip.id,
        name: trip.name,
        isAdmin: true,
      },
      progress: {
        answered: progress.answered,
        total: progress.total,
      },
      aggregate: {
        flightAccepted,
        flightDeclared: flightDeclared.length,
        medianBudget: median(budgets),
        budgetDeclared: budgets.length,
        constraintCount,
      },
      submitted,
      pending,
      unjoinedExpected,
      comments,
    };
  });
