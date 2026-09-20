import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aggregateParticipantPreferences } from "@/lib/krew/trip-service";
import { isTripAdmin } from "@/lib/krew/engine";
import { normalizeStayConcepts } from "./shared";

function computeJourneyStage(input: {
  status?: string | null;
  datesLocked: boolean;
  profileValidated: boolean;
  destinationSelected: boolean;
  hasItinerary: boolean;
  startDate?: string | null;
}): string {
  const st = String(input.status ?? "").toLowerCase();
  if (st === "annule") return "Annulé";
  if (input.hasItinerary || (input.destinationSelected && st === "valide")) {
    return "Organisation du séjour";
  }
  if (input.destinationSelected) return "Destination choisie · organisation";
  if (input.datesLocked && input.profileValidated) return "Choix de la destination";
  if (input.datesLocked && !input.profileValidated) return "Profil du voyage";
  if (input.startDate) return "Validation des dates";
  return "Collecte des dispos & préférences";
}

export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Tous les voyages dont tu es owner — on filtre seulement les vraiment annulés côté app
    let owned = await supabase
      .from("trips")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    // Si filtre status pose problème (enum), retente sans
    if (owned.error) {
      console.error("listMyTrips owned", owned.error.message);
      owned = (await supabase
        .from("trips")
        .select(
          "id, name, event_type, status, participants_count, created_at, owner_id, start_date, end_date",
        )
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })) as any;
    }
    if (owned.error) throw owned.error;

    const invitations = await supabase
      .from("trip_participants")
      .select("*, trips(*)")
      .or(
        `user_id.eq.${userId},email.eq.${(context.claims?.email as string | undefined)?.toLowerCase() ?? ""}`,
      )
      .order("created_at", { ascending: false });

    const trips = (owned.data ?? []).filter(
      (row: any) => row && String(row.status ?? "") !== "annule",
    );
    const archivedTrips = (owned.data ?? []).filter(
      (row: any) => row && String(row.status ?? "") === "annule",
    );
    const invited = (invitations.data ?? []).filter(
      (p: any) =>
        p.trips &&
        (p.trips as { owner_id: string }).owner_id !== userId &&
        String((p.trips as any).status ?? "") !== "annule" &&
        String(p.status ?? "") !== "refuse",
    );

    // Enrichir avec le stade réel du parcours (dates / destination / organisation)
    const allTripIds = [
      ...trips.map((row: any) => row.id as string),
      ...invited.map((p: any) => (p.trips as any)?.id as string).filter(Boolean),
    ];
    const uniqueIds = [...new Set(allTripIds)];

    const stageByTrip: Record<string, { destinationSelected: boolean; hasItinerary: boolean; hasRecommendations: boolean }> = {};
    const selectedDestinationByTrip: Record<
      string,
      { destination_name: string | null; destination_image_url: string | null }
    > = {};
    type TeamMember = {
      id: string;
      name: string;
      availabilityDone: boolean;
      preferencesDone: boolean;
      isStar: boolean;
    };
    type TeamSummary = {
      total: number;
      identifiedCount: number;
      availabilityAnswered: number;
      preferencesAnswered: number;
      members: TeamMember[];
    };
    const teamSummaryByTrip: Record<string, TeamSummary> = {};

    for (const id of uniqueIds) {
      stageByTrip[id] = { destinationSelected: false, hasItinerary: false, hasRecommendations: false };
      selectedDestinationByTrip[id] = { destination_name: null, destination_image_url: null };
    }

    if (uniqueIds.length) {
      const [allRecos, selRecos, tripExtras, allParticipants, allPrefs, allAvail, allStarPrefs] = await Promise.all([
        supabase
          .from("recommendations")
          .select("trip_id")
          .in("trip_id", uniqueIds),
        supabase
          .from("recommendations")
          .select("trip_id, destinations(name, image_url)")
          .in("trip_id", uniqueIds)
          .eq("is_selected", true),
        supabase
          .from("trips")
          .select("id, dates_locked, group_itinerary, start_date, participants_count, celebrated_person, has_star, star_user_id, stay_profile_validated_at, stay_concepts_selected")
          .in("id", uniqueIds),
        supabase
          .from("trip_participants")
          .select("id, trip_id, user_id, email, display_name, status")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_participant_preferences")
          .select("trip_id, user_id, submitted_at, updated_at")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_availability")
          .select("trip_id, user_id")
          .in("trip_id", uniqueIds),
        supabase
          .from("trip_star_preferences")
          .select("trip_id, user_id, wanted_activities, ambiances, wanted_env_type, desired_destination, available_dates, blocked_dates, submitted_at, updated_at")
          .in("trip_id", uniqueIds),
      ]);

      for (const r of allRecos.data ?? []) {
        const tid = (r as any).trip_id as string;
        if (stageByTrip[tid]) stageByTrip[tid].hasRecommendations = true;
      }

      for (const r of selRecos.data ?? []) {
        const tid = (r as any).trip_id as string;
        if (stageByTrip[tid]) stageByTrip[tid].destinationSelected = true;
        const dest = (r as any).destinations;
        if (dest && selectedDestinationByTrip[tid]) {
          selectedDestinationByTrip[tid].destination_name = dest.name ?? null;
          selectedDestinationByTrip[tid].destination_image_url = dest.image_url ?? null;
        }
      }

      const tripExtrasMap = new Map<string, any>();
      for (const row of tripExtras.data ?? []) {
        const tid = (row as any).id as string;
        tripExtrasMap.set(tid, row);
        if (!stageByTrip[tid]) continue;
        stageByTrip[tid].hasItinerary = Boolean((row as any).group_itinerary?.days?.length);
        (stageByTrip[tid] as any).datesLocked = Boolean((row as any).dates_locked);
        (stageByTrip[tid] as any).startDate = (row as any).start_date ?? null;
      }

      const rawParticipants = allParticipants.data ?? [];
      const rawPrefs = allPrefs.data ?? [];
      const rawAvail = allAvail.data ?? [];
      const rawStarPrefs = allStarPrefs.data ?? [];

      for (const tid of uniqueIds) {
        const tripData = tripExtrasMap.get(tid);
        const celebratedPerson = tripData?.celebrated_person;
        const starUserId = tripData?.star_user_id || null;

        const activeParticipants = rawParticipants.filter(
          (p: any) => p.trip_id === tid && p.status !== "absent",
        );

        const prefRows = rawPrefs.filter((p: any) => p.trip_id === tid);
        const prefSet = new Set(prefRows.map((p: any) => p.user_id).filter(Boolean));

        const availRows = rawAvail.filter((a: any) => a.trip_id === tid);
        const availSet = new Set(availRows.map((a: any) => a.user_id).filter(Boolean));

        const starPref = rawStarPrefs.find((sp: any) => sp.trip_id === tid);
        const starHasPrefs = Boolean(
          starPref &&
            ((starPref.wanted_activities && starPref.wanted_activities.length > 0) ||
              (starPref.ambiances && starPref.ambiances.length > 0) ||
              starPref.wanted_env_type ||
              starPref.desired_destination ||
              starPref.submitted_at),
        );
        const starHasAvail = Boolean(
          starPref &&
            ((starPref.available_dates && starPref.available_dates.length > 0) ||
              (starPref.blocked_dates && starPref.blocked_dates.length > 0)),
        );

        const starParticipant = starUserId
          ? activeParticipants.find((p: any) => p.user_id === starUserId) || null
          : null;

        const membersList: TeamMember[] = [];

        for (const p of activeParticipants) {
          const isStar = p === starParticipant || Boolean(starUserId && p.user_id === starUserId);
          let preferencesDone = p.user_id ? prefSet.has(p.user_id) : false;
          let availabilityDone = p.user_id ? availSet.has(p.user_id) : false;

          if (isStar) {
            if (starHasPrefs) preferencesDone = true;
            if (starHasAvail) availabilityDone = true;
          }

          const rawName = p.display_name ?? p.email?.split("@")[0] ?? null;
          const memberName = isStar && celebratedPerson ? celebratedPerson : rawName;
          if (!memberName) continue;

          membersList.push({
            id: p.id,
            name: memberName,
            availabilityDone,
            preferencesDone,
            isStar,
          });
        }

        const expected = Math.max(Number(tripData?.participants_count) || 0, membersList.length, 1);
        const availabilityAnswered = membersList.filter((m) => m.availabilityDone).length;
        const preferencesAnswered = membersList.filter((m) => m.preferencesDone).length;

        teamSummaryByTrip[tid] = {
          total: expected,
          identifiedCount: membersList.length,
          availabilityAnswered,
          preferencesAnswered,
          members: membersList,
        };
      }
    }

    const attachStage = (row: any) => {
      const s = stageByTrip[row.id] || {
        destinationSelected: false,
        hasItinerary: false,
        datesLocked: Boolean(row.dates_locked),
        startDate: row.start_date ?? null,
      };
      const datesLocked = Boolean((s as any).datesLocked ?? row.dates_locked);
      const destinationSelected = Boolean(s.destinationSelected);
      const hasItinerary = Boolean(s.hasItinerary);
        const hasRecommendations = Boolean(s.hasRecommendations);
        const profileValidated =
          Boolean(row.stay_profile_validated_at) ||
          destinationSelected ||
          hasRecommendations;
      const teamSummary = teamSummaryByTrip[row.id] ?? {
        total: Math.max(Number(row.participants_count) || 1, 1),
        answered: 0,
        pending: Math.max(Number(row.participants_count) || 1, 1),
        members: [],
      };
      const destInfo = selectedDestinationByTrip[row.id] || {
        destination_name: null,
        destination_image_url: null,
      };
      return {
        ...row,
        destination_name: destInfo.destination_name,
        destination_image_url: destInfo.destination_image_url,
        dates_locked: datesLocked,
        destination_selected: destinationSelected,
        has_itinerary: hasItinerary,
        journey_stage: computeJourneyStage({
          status: row.status,
          datesLocked,
            profileValidated,
          destinationSelected,
          hasItinerary,
          startDate: row.start_date ?? (s as any).startDate,
        }),
        team_summary: teamSummary,
      };
    };

    return {
      trips: trips.map(attachStage),
      archivedTrips: archivedTrips.map(attachStage),
      invitations: invited.map((p: any) => ({
        ...p,
        trips: p.trips ? attachStage(p.trips) : p.trips,
      })),
    };
  });

export const getTripDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase.from("trips").select("*").eq("id", data.tripId).maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data) throw new Error("Voyage introuvable");

    const [preferences, participants, recommendations, votes, activityVotes] = await Promise.all([
      supabase.from("trip_preferences").select("*").eq("trip_id", data.tripId).maybeSingle(),
      supabase.from("trip_participants").select("*").eq("trip_id", data.tripId).order("created_at"),
      supabase
        .from("recommendations")
        .select("*, destinations(*), accommodations(*)")
        .eq("trip_id", data.tripId)
        .order("score", { ascending: false }),
      supabase.from("recommendation_votes").select("*").eq("trip_id", data.tripId),
      supabase.from("activity_votes").select("*").eq("trip_id", data.tripId),
    ]);

    // Ne pas faire planter le hub si une table optionnelle manque
    const recos = recommendations.error ? [] : (recommendations.data ?? []);
    const voteRows = votes.error ? [] : (votes.data ?? []);
    const activityVoteRows = activityVotes.error ? [] : (activityVotes.data ?? []);
    const participantRows = participants.error ? [] : (participants.data ?? []);

    const activityIds = recos.flatMap((r: any) => r.activity_ids ?? []);
    let activityRows: any[] = [];
    if (activityIds.length) {
      const activities = await supabase.from("activities").select("*").in("id", activityIds);
      activityRows = activities.error ? [] : (activities.data ?? []);
    }

    const aggregated = await aggregateParticipantPreferences(supabase, data.tripId);
    const calculatedConcepts = normalizeStayConcepts((aggregated.stayConcepts ?? []).slice(0, 3));
    const storedCalculated = normalizeStayConcepts(((trip.data as any).stay_concepts_calculated ?? []));
    const selectedConcepts = normalizeStayConcepts(((trip.data as any).stay_concepts_selected ?? []));
    const profile = {
      calculatedConcepts: storedCalculated.length ? storedCalculated : calculatedConcepts,
      selectedConcepts,
      validated: Boolean((trip.data as any).stay_profile_validated_at) || recos.length > 0,
      legacyBypass: recos.length > 0 && !(trip.data as any).stay_profile_validated_at,
    };

    return {
      trip: trip.data,
      profile,
      isOwner: isTripAdmin(trip.data, userId),
      isCreator: trip.data.owner_id === userId,
      userId,
      preferences: preferences.error ? null : (preferences.data ?? null),
      participants: participantRows,
      recommendations: recos,
      activities: activityRows,
      votes: voteRows,
      activityVotes: activityVoteRows,
    };
  });
