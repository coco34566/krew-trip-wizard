import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  getCostSplit,
  getGenerationReadiness,
  getTripDetail,
} from "@/lib/trips.functions";
import {
  getMyParticipantPreferences,
  getParticipantsProgress,
} from "@/lib/participant-preferences.functions";
import { getTripAvailability } from "@/lib/availability.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { computeItineraryActivitiesCost } from "@/lib/krew/cost-split";
import type { StayConcept } from "@/lib/krew/stay-profiles";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { isFinalTripPreparationReady } from "@/lib/krew/packing-list";

export type HubRecommendation = {
  id: string;
  score: number;
  rationale: string | null;
  match_reasons: string[] | null;
  is_selected: boolean;
  itinerary: ItineraryDay[] | null;
  budget: BudgetBreakdown | null;
  activity_ids: string[] | null;
  destinations: {
    name: string;
    country: string;
    description: string | null;
    image_url: string | null;
    rating: number;
  } | null;
  accommodations: {
    name: string;
    type: string;
    rating: number;
    price_per_night_per_person: number;
    distance_center_km: number;
  } | null;
};

export function useTripHubData(tripId: string) {
  const fetchDetail = useServerFn(getTripDetail);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvail = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const readinessQuery = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const tasksQuery = useQuery({
    queryKey: ["trip-tasks", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_tasks" as any)
        .select(
          `
          *,
          assigned_participant:assigned_participant_id (
            id,
            display_name,
            email,
            user_id
          )
        `,
        )
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: Boolean(tripId),
  });

  const starQuery = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const availabilityQuery = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const costSplitQuery = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const progressQuery = useQuery({
    queryKey: ["trip-progress", tripId],
    queryFn: () => fetchProgress({ data: { tripId } }),
  });

  const myPreferencesQuery = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const data = detailQuery.data;
  const profile = data?.profile as
    | {
        calculatedConcepts: StayConcept[];
        selectedConcepts: StayConcept[];
        validated: boolean;
        legacyBypass: boolean;
      }
    | undefined;

  const tripPreview = data?.trip as any;
  const recommendationsPreview = (data?.recommendations ?? []) as any[];
  const selectedRecoPreview = recommendationsPreview.find((recommendation: any) => recommendation.is_selected);
  const logisticsPreview = (tripPreview?.group_logistics || {}) as any;

  const liveBudget = useMemo(() => {
    const trip = tripPreview || {};
    const selectedReco = selectedRecoPreview;
    const logistics = logisticsPreview;
    const budget = selectedReco?.budget as any;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const milliseconds =
          new Date(trip.end_date + "T12:00:00").getTime() -
          new Date(trip.start_date + "T12:00:00").getTime();
        const days = Math.round(milliseconds / 86400000);
        return days >= 1 ? days : Number(trip.duration_nights) || 2;
      }
      return Number(trip.duration_nights) || 2;
    })();

    let transport = Number(budget?.transport ?? 0);
    let accommodation = Number(budget?.accommodation ?? 0);
    let activities = Number(budget?.activities ?? 0);
    const food = Number(budget?.food ?? 0);

    const hotels = (logistics.hotels ?? []) as any[];
    const topHotelId = logistics.selectedHotelId as string | null;
    if (topHotelId) {
      const hotel = hotels.find((item: any) => item.id === topHotelId);
      if (hotel?.totalEstimate != null) accommodation = Number(hotel.totalEstimate);
      else if (hotel?.pricePerNight != null) accommodation = Number(hotel.pricePerNight) * nights;
    }

    const picks = (logistics.transportPicks ?? []) as any[];
    if (picks.length) {
      const prices = picks
        .map((pick: any) => Number(pick.pricePerPerson))
        .filter((price: number) => Number.isFinite(price) && price > 0);
      if (prices.length) {
        transport = Math.round(prices.reduce((total: number, current: number) => total + current, 0) / prices.length);
      }
    }

    const days = (trip.group_itinerary?.days ?? []) as any[];
    if (days.length) {
      const result = computeItineraryActivitiesCost(days);
      if (result.activitiesPerPerson != null) activities = result.activitiesPerPerson;
    }

    const total =
      Math.round(transport) + Math.round(accommodation) + Math.round(activities) + Math.round(food);

    return {
      transport: Math.round(transport),
      accommodation: Math.round(accommodation),
      activities: Math.round(activities),
      food: Math.round(food),
      total,
      baseBudget: Number(trip.budget_per_person) || 0,
      destinationName: selectedReco?.destinations?.name ?? null,
      country: selectedReco?.destinations?.country ?? null,
      topHotelName: topHotelId ? (hotels.find((item: any) => item.id === topHotelId)?.name ?? null) : null,
      transportPicksCount: picks.length,
      nights,
    };
  }, [tripPreview, selectedRecoPreview, logisticsPreview]);

  const isStar = useMemo(() => {
    if (!tripPreview || !data?.userId) return false;
    const starUserId = tripPreview.star_user_id;
    return Boolean(starUserId && data.userId === starUserId);
  }, [tripPreview, data]);

  const isSecretStar = useMemo(() => {
    if (!tripPreview || !isStar) return false;
    const starMode = (tripPreview.group_logistics as any)?.star_mode ?? "secret";
    return starMode === "secret";
  }, [tripPreview, isStar]);

  const trip = data?.trip;
  const recommendations = (data?.recommendations ?? []) as unknown as HubRecommendation[];
  const rawParticipants = (data?.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const starUid = trip?.star_user_id || "star-virtual-uid";
  const hasStar = Boolean(trip?.has_star || celebratedPerson);

  const combinedParticipants = (() => {
    if (!trip || !hasStar) return rawParticipants;

    const starExists = rawParticipants.some(
      (participant: any) => Boolean(participant.user_id && starUid && participant.user_id === starUid),
    );

    if (starExists) {
      return rawParticipants.map((participant) =>
        participant.user_id && starUid && participant.user_id === starUid
          ? { ...participant, isStar: true }
          : participant,
      );
    }

    return [
      ...rawParticipants,
      {
        id: "star-virtual-id",
        trip_id: tripId,
        user_id: starUid,
        email: null,
        display_name: celebratedPerson || "La Star",
        status: "accepte",
        role: "membre",
        isStar: true,
        created_at: new Date().toISOString(),
      },
    ];
  })();

  const placeholders = trip
    ? Array.from(
        { length: Math.max(0, Number(trip.participants_count || 0) - combinedParticipants.length) },
        (_, index) => ({
          id: `placeholder-${index}`,
          display_name: `Participant ${combinedParticipants.length + index + 1}`,
          email: null,
          status: "à inviter",
          placeholder: true,
        }),
      )
    : [];

  const participants = [...combinedParticipants, ...placeholders];
  const destinationSelected = recommendations.some((recommendation) => recommendation.is_selected);
  const selectedReco = recommendations.find((recommendation) => recommendation.is_selected);
  const logistics = ((trip as any)?.group_logistics || {}) as any;
  const datesLocked = Boolean(trip?.dates_locked);
  const hasItinerary = Boolean((trip as any)?.group_itinerary?.days?.length);
  const selectedActivityIds = ((trip as any)?.selected_activity_ids ?? []) as string[];
  const activitiesValidated = selectedActivityIds.length > 0;
  const finalRestitutionReady = Boolean(
    trip &&
      isFinalTripPreparationReady({
        destinationSelected,
        hasItinerary,
        selectedActivityIds,
      }),
  );
  const tripLifecycle = trip
    ? getTripLifecycleState({
        datesLocked,
        startDate: trip.start_date,
        endDate: trip.end_date,
      })
    : "upcoming";

  return {
    detailQuery,
    data,
    isLoading: detailQuery.isLoading,
    readiness: readinessQuery.data,
    tasksData: tasksQuery.data,
    starData: starQuery.data,
    availData: availabilityQuery.data,
    costSplitData: costSplitQuery.data,
    progress: progressQuery.data,
    myPrefsData: myPreferencesQuery.data,
    profile,
    tripPreview,
    logisticsPreview,
    liveBudget,
    isStar,
    isSecretStar,
    trip,
    recommendations,
    rawParticipants,
    participants,
    celebratedPerson,
    starUid,
    hasStar,
    destinationSelected,
    selectedReco,
    logistics,
    datesLocked,
    hasItinerary,
    activitiesValidated,
    finalRestitutionReady,
    tripLifecycle,
    tripEndDatePassed: tripLifecycle === "completed",
  };
}

export type TripHubData = ReturnType<typeof useTripHubData>;
