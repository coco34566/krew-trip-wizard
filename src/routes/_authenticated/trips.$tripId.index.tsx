import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTripDetail,
  getGenerationReadiness,
  getCostSplit,
  removeParticipant,
  cancelTrip,
  setCoOrganizer,
  updateTripParticipantsCount,
} from "@/lib/trips.functions";
import {
  getParticipantsProgress,
  getMyParticipantPreferences,
  declareMyStatus,
} from "@/lib/participant-preferences.functions";
import { formatEuro } from "@/lib/krew/constants";
import type { BudgetBreakdown, ItineraryDay } from "@/lib/krew/engine";
import { PROFILE_LABELS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { cn } from "@/lib/utils";
import { computeItineraryActivitiesCost } from "@/lib/krew/cost-split";
import { supabase } from "@/integrations/supabase/client";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard.entry";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { KrewJourneyTimeline } from "@/components/krew/KrewJourneyTimeline.entry";
import type { TimelineStep } from "@/components/krew/KrewJourneyTimeline";
import { getTripAvailability } from "@/lib/availability.functions";
import { getStarPreferences } from "@/lib/star-preferences.functions";
import { buildTripStatusWhatsApp, shareOnWhatsApp } from "@/lib/krew/whatsapp";
import { isFinalTripPreparationReady } from "@/lib/krew/packing-list";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  beforeLoad: ({ params, search }) => {
    switch (search.section) {
      case "dates":
        throw redirect({ to: "/trips/$tripId/dates", params: { tripId: params.tripId }, replace: true });
      case "profile":
        throw redirect({ to: "/trips/$tripId/profile", params: { tripId: params.tripId }, replace: true });
      case "destination":
        throw redirect({ to: "/trips/$tripId/destination", params: { tripId: params.tripId }, replace: true });
      case "accommodation":
        throw redirect({ to: "/trips/$tripId/accommodation", params: { tripId: params.tripId }, replace: true });
      case "transport":
        throw redirect({ to: "/trips/$tripId/transport", params: { tripId: params.tripId }, replace: true });
      case "planning":
        throw redirect({ to: "/trips/$tripId/planning", params: { tripId: params.tripId }, replace: true });
      case "tasks":
        throw redirect({ to: "/trips/$tripId/tasks", params: { tripId: params.tripId }, replace: true });
      case "packing":
        throw redirect({ to: "/trips/$tripId/packing", params: { tripId: params.tripId }, replace: true });
      default:
        return;
    }
  },
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as string) || "todo",
    section: (search.section as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Voyage — KREW" },
      {
        name: "description",
        content: "Propositions KREW, planning jour par jour, budget détaillé et votes du groupe.",
      },
      { property: "og:title", content: "Voyage — KREW" },
      {
        property: "og:description",
        content: "Compare les propositions et avance avec ton groupe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripDetail,
});

type Recommendation = {
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

function TripDetail() {
  const { tripId } = Route.useParams();
  const search = Route.useSearch();
  const currentView = search?.view ?? "todo";
  const currentSection = search?.section;
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const removeGuest = useServerFn(removeParticipant);
  const fetchReadiness = useServerFn(getGenerationReadiness);
  const setCoOrg = useServerFn(setCoOrganizer);
  const updateCountFn = useServerFn(updateTripParticipantsCount);
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [countInput, setCountInput] = useState<number>(2);

  const updateCountMutation = useMutation({
    mutationFn: (count: number) =>
      updateCountFn({ data: { tripId, participantsCount: count } }),
    onSuccess: () => {
      setIsEditingCount(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (err: any) => {
      console.error("Impossible de mettre à jour le nombre de participants:", err);
      toast.error("Impossible de mettre à jour le nombre de participants pour le moment.");
    },
  });

  const setCoOrgMutation = useMutation({
    mutationFn: ({ coOrganizerId }: { coOrganizerId: string | null }) =>
      setCoOrg({ data: { tripId, coOrganizerId } }),
    onSuccess: (_, variables) => {
      if (variables.coOrganizerId) {
        } else {
        }
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Impossible de mettre à jour ce rôle pour le moment.");
    },
  });

  const { data: readiness } = useQuery({
    queryKey: ["generation-readiness", tripId],
    queryFn: () => fetchReadiness({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: tasksData } = useQuery({
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

  const fetchProgress = useServerFn(getParticipantsProgress);
  const fetchSplit = useServerFn(getCostSplit);
  const fetchAvail = useServerFn(getTripAvailability);
  const fetchStar = useServerFn(getStarPreferences);
  const { data: starData } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const { data: availData } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });
  const { data: costSplitData } = useQuery({
    queryKey: ["cost-split", tripId],
    queryFn: () => fetchSplit({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const queryKey = ["trip", tripId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const profile = data?.profile as
    | {
        calculatedConcepts: StayConcept[];
        selectedConcepts: StayConcept[];
        validated: boolean;
        legacyBypass: boolean;
      }
    | undefined;
  const progressQueryKey = ["trip-progress", tripId];
  const { data: progress } = useQuery({
    queryKey: progressQueryKey,
    queryFn: () => fetchProgress({ data: { tripId } }),
  });
  const fetchMyPrefs = useServerFn(getMyParticipantPreferences);
  const { data: myPrefsData } = useQuery({
    queryKey: ["my-participant-prefs", tripId],
    queryFn: () => fetchMyPrefs({ data: { tripId } }),
    enabled: Boolean(tripId),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: progressQueryKey });
  };

  const removeMutation = useMutation({
    mutationFn: (participantId: string) => removeGuest({ data: { participantId } }),
    onSuccess: refresh,
  });
  const declareStatusFn = useServerFn(declareMyStatus);
  const declareStatusMutation = useMutation({
    mutationFn: (status: "accepte" | "absent") => declareStatusFn({ data: { tripId, status } }),
    onSuccess: (res) => {
      refresh();
    },
    onError: (e: any) => {
      console.error("Impossible de mettre à jour ta participation:", e);
      toast.error("Impossible de mettre à jour ta participation pour le moment.");
    },
  });
  const cancelFn = useServerFn(cancelTrip);
  const cancelMutation = useMutation({
    mutationFn: (hardDelete?: boolean) =>
      cancelFn({ data: { tripId, hardDelete: Boolean(hardDelete) } }),
    onSuccess: (res) => {
      toast.success(res.mode === "deleted" ? "Voyage supprimé" : "Voyage archivé");
      window.location.href = "/dashboard";
    },
    onError: (e: any) => {
      console.error("Impossible de gérer le voyage:", e);
      toast.error("Impossible d’effectuer cette action pour le moment.");
    },
  });
  const tripPreview = data?.trip as any;
  const recommendationsPreview = (data?.recommendations ?? []) as any[];
  const selectedRecoPreview = recommendationsPreview.find((r: any) => r.is_selected);
  const logisticsPreview = (tripPreview?.group_logistics || {}) as any;

  const liveBudget = useMemo(() => {
    const trip = tripPreview || {};
    const selectedReco = selectedRecoPreview;
    const logistics = logisticsPreview;
    const b = selectedReco?.budget as any;
    const nights = (() => {
      if (trip.start_date && trip.end_date) {
        const ms =
          new Date(trip.end_date + "T12:00:00").getTime() -
          new Date(trip.start_date + "T12:00:00").getTime();
        const d = Math.round(ms / 86400000);
        return d >= 1 ? d : Number(trip.duration_nights) || 2;
      }
      return Number(trip.duration_nights) || 2;
    })();

    let transport = Number(b?.transport ?? 0);
    let accommodation = Number(b?.accommodation ?? 0);
    let activities = Number(b?.activities ?? 0);
    let food = Number(b?.food ?? 0);

    const hotels = (logistics.hotels ?? []) as any[];
    const topHotelId = logistics.selectedHotelId as string | null;
    if (topHotelId) {
      const h = hotels.find((x: any) => x.id === topHotelId);
      if (h?.totalEstimate != null) accommodation = Number(h.totalEstimate);
      else if (h?.pricePerNight != null) accommodation = Number(h.pricePerNight) * nights;
    }

    const picks = (logistics.transportPicks ?? []) as any[];
    if (picks.length) {
      const prices = picks
        .map((p: any) => Number(p.pricePerPerson))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (prices.length) {
        transport = Math.round(prices.reduce((a: number, c: number) => a + c, 0) / prices.length);
      }
    }

    const days = (trip.group_itinerary?.days ?? []) as any[];
    if (days.length) {
      const res = computeItineraryActivitiesCost(days);
      if (res.activitiesPerPerson != null) {
        activities = res.activitiesPerPerson;
      }
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
      topHotelName: topHotelId
        ? (hotels.find((x: any) => x.id === topHotelId)?.name ?? null)
        : null,
      transportPicksCount: picks.length,
      nights,
    };
  }, [tripPreview, selectedRecoPreview, logisticsPreview]);

  function buildWhatsAppStatusMessage() {
    const trip = tripPreview || {};
    const statusLines: string[] = [];
    const actions: { name: string; action: string }[] = [];
    const nameOf = (participant: any) =>
      participant.display_name || participant.email?.split("@")[0] || "Ami";
    if (trip.start_date && trip.end_date) {
      const start = new Date(`${trip.start_date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
      const end = new Date(`${trip.end_date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      statusLines.push(`📅 Dates : ${start} → ${end}`);
    }
    if (liveBudget.destinationName)
      statusLines.push(`📍 Destination : ${liveBudget.destinationName}`);
    if (logisticsPreview.hotels?.length)
      statusLines.push(
        `🏠 Hébergement : ${logisticsPreview.hotelBookingStatus || "vote en cours"}`,
      );
    if (logisticsPreview.transports?.length)
      statusLines.push(`🚆 Transport : ${liveBudget.transportPicksCount || 0} choix enregistré(s)`);
    if (liveBudget.total > 0) statusLines.push(`💰 Budget estimé : ~${liveBudget.total} € / pers.`);
    for (const participant of progress?.participants ?? []) {
      if (!participant.hasAnsweredAvailability)
        actions.push({ name: nameOf(participant), action: "disponibilités" });
      if (!participant.hasAnswered)
        actions.push({ name: nameOf(participant), action: "préférences" });
    }
    if (logisticsPreview.star_mode === "secret" && trip.celebrated_person && !starData?.preferences)
      actions.push({ name: "organisateur", action: `Préférences de ${trip.celebrated_person}` });
    if (logisticsPreview.hotels?.length) {
      const voters = new Set((logisticsPreview.hotelVotes ?? []).map((vote: any) => vote.userId));
      for (const participant of participants.filter(
        (item: any) => item.user_id && item.status !== "absent",
      ))
        if (!voters.has(participant.user_id))
          actions.push({ name: nameOf(participant), action: "voter pour l’hébergement" });
    }
    if (logisticsPreview.transports?.length) {
      const pickers = new Set(
        (logisticsPreview.transportPicks ?? []).map((pick: any) => pick.userId),
      );
      for (const participant of participants.filter(
        (item: any) => item.user_id && item.status !== "absent",
      ))
        if (!pickers.has(participant.user_id))
          actions.push({ name: nameOf(participant), action: "choisir son transport" });
    }
    return buildTripStatusWhatsApp({
      tripName: trip.name || "notre voyage",
      tripUrl:
        typeof window === "undefined"
          ? `/trips/${trip.id}`
          : `${window.location.origin}/trips/${trip.id}`,
      statusLines,
      actions,
    });
  }

  function buildWhatsAppRemindMessage() {
    const trip = tripPreview || {};
    const missingParticipants =
      progress?.participants?.filter((p) => !p.hasAnswered || !p.hasAnsweredAvailability) || [];
    const lines: string[] = [
      `Petit rappel pour « ${trip.name || "notre voyage"} »`,
      "",
      "Il reste quelques réponses à compléter :",
    ];

    for (const p of missingParticipants) {
      const name = p.display_name || p.email?.split("@")[0] || "Ami";
      const missing: string[] = [];
      if (!p.hasAnsweredAvailability) missing.push("disponibilités");
      if (!p.hasAnswered) missing.push("préférences");
      lines.push(`• ${name} : ${missing.join(" + ")}`);
    }

    lines.push("");
    if (typeof window !== "undefined" && trip.id) {
      lines.push(
        `${window.location.origin}/trips/${trip.id}`,
      );
    }
    return lines.join("\n");
  }

  const isStar = useMemo(() => {
    if (!tripPreview || !data?.userId) return false;
    const starUid = tripPreview.star_user_id;
    return Boolean(starUid && data.userId === starUid);
  }, [tripPreview, data]);

  const isSecretStar = useMemo(() => {
    if (!tripPreview || !isStar) return false;
    const starMode = (tripPreview.group_logistics as any)?.star_mode ?? "secret";
    return starMode === "secret";
  }, [tripPreview, isStar]);

  if (isLoading || !data) {
    return (
      <KrewPageShell
        size="standard"
        gutter="compact"
        data-krew-page-surface="trip-hub"
        className="space-y-4 py-10"
      >
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 rounded-3xl" />
      </KrewPageShell>
    );
  }

  if (isSecretStar) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
        <span className="inline-flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse text-4xl">
          🤫
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
          Une surprise se prépare
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Le groupe prépare le voyage en gardant certaines informations secrètes pour le moment (
          <strong>{tripPreview.name}</strong>).
        </p>
        <p className="text-muted-foreground leading-relaxed">
          La destination, l’hébergement et le planning apparaîtront au moment prévu par le groupe.
        </p>
        <p className="text-primary font-medium">
          Tu n’as rien à organiser ici pour l’instant.
        </p>
      </main>
    );
  }

  const trip = data.trip;
  const datesLocked = Boolean(trip.dates_locked);
  const hasItinerary = Boolean((trip as any).group_itinerary?.days?.length);
  const recommendations = (data.recommendations ?? []) as unknown as Recommendation[];
  const rawParticipants = (data.participants ?? []) as any[];
  const celebratedPerson = trip?.celebrated_person;
  const starUid = trip?.star_user_id || "star-virtual-uid";
  const hasStar = Boolean(trip?.has_star || celebratedPerson);

  const combinedParticipants = (() => {
    if (!hasStar) return rawParticipants;

    const starExists = (rawParts: any[]) =>
      rawParts.some((p: any) => Boolean(p.user_id && starUid && p.user_id === starUid));

    if (starExists(rawParticipants)) {
      return rawParticipants.map((p) => {
        const isStarByUid = Boolean(p.user_id && starUid && p.user_id === starUid);
        if (isStarByUid) {
          return { ...p, isStar: true };
        }
        return p;
      });
    }

    const starVirtual = {
      id: "star-virtual-id",
      trip_id: tripId,
      user_id: starUid,
      email: null,
      display_name: celebratedPerson || "La Star",
      status: "accepte",
      role: "membre",
      isStar: true,
      created_at: new Date().toISOString(),
    };

    return [...rawParticipants, starVirtual];
  })();

  const placeholders = Array.from(
    { length: Math.max(0, Number(trip.participants_count || 0) - combinedParticipants.length) },
    (_, index) => ({
      id: `placeholder-${index}`,
      display_name: `Participant ${combinedParticipants.length + index + 1}`,
      email: null,
      status: "à inviter",
      placeholder: true,
    }),
  );
  const participants = [...combinedParticipants, ...placeholders];
  const destinationSelected = recommendations.some((r) => r.is_selected);
  const logistics = ((trip as any).group_logistics || {}) as any;
  const selectedActivityIdsList = ((trip as any).selected_activity_ids ?? []) as string[];
  const activitiesValidated = selectedActivityIdsList.length > 0;
  const finalRestitutionReady = isFinalTripPreparationReady({
    destinationSelected,
    hasItinerary,
    selectedActivityIds: selectedActivityIdsList,
  });
  const tripLifecycle = getTripLifecycleState({
    datesLocked,
    startDate: trip.start_date,
    endDate: trip.end_date,
  });
  const tripEndDatePassed = tripLifecycle === "completed";

  return (
    <KrewPageShell size="standard" gutter="compact" data-krew-page-surface="trip-hub" className="py-10">
      {/* Top Navigation Tabs */}
      <nav aria-label="Navigation principale du voyage" className="flex items-center border-b border-border/50 pb-3 gap-6 font-medium text-sm mb-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "todo" }}
          className={cn(
            "pb-1 transition-colors hover:text-foreground",
            currentView === "todo"
              ? "border-b-2 border-primary text-foreground font-semibold"
              : "text-muted-foreground",
          )}
        >
          Résumé du voyage
        </Link>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className={cn(
            "pb-1 transition-colors hover:text-foreground",
            currentView === "voyage"
              ? "border-b-2 border-primary text-foreground font-semibold"
              : "text-muted-foreground",
          )}
        >
          Détail du voyage
        </Link>
      </nav>

      {currentView === "todo" ? (
        <div className="space-y-8">
          <TripHubDashboard
            viewerUserId={data.userId}
            tripId={tripId}
            trip={{
              ...trip,
              participants: participants,
            }}
            isOwner={data.isOwner}
            participantsCount={progress?.total || participants.length}
            progressAnswered={progress?.answered ?? 0}
            progressTotal={progress?.total || participants.length}
            availabilityAnswered={availData?.answered ?? 0}
            availabilityExpected={progress?.total || participants.length}
            provisionalStart={
              trip.start_date ?? availData?.windows?.[0]?.start ?? (trip as any).provisional_start_date
            }
            provisionalCoverage={availData?.windows?.[0]?.coverageRatio ?? null}
            myAvailabilityDone={Boolean(availData?.mine)}
            myPreferencesDone={Boolean((myPrefsData as any)?.preferences)}
            starDone={Boolean(starData?.preferences)}
            hasRecommendations={recommendations.length > 0}
            profileReady={Boolean(readiness?.profile.questionnairesReady)}
            profileValidated={Boolean(profile?.validated)}
            destinationSelected={recommendations.some((r) => r.is_selected)}
            destinationName={recommendations.find((r) => r.is_selected)?.destinations?.name ?? null}
            liveBudgetTotal={liveBudget.total > 0 ? liveBudget.total : null}
            totalReserved={costSplitData?.totalReserved ?? null}
            totalEstimated={costSplitData?.totalEstimated ?? null}
            topScores={recommendations.slice(0, 3).map((r) => ({
              name: r.destinations?.name ?? "Destination",
              score: r.score,
            }))}
            activitiesValidated={activitiesValidated}
            tripEndDatePassed={tripEndDatePassed}
          />

          {/* ZONE 5 — MEMBRES DU GROUPE (EXACT BLUEPRINT) */}
          <section id="group-section" className="mt-12 space-y-4 scroll-mt-24 relative">
            {/* Loutre trip-progress positionnée en haut à droite (visible mobile à 52px & desktop à 60px) */}
            <div className="absolute top-0 right-0 z-10 pointer-events-none">
              <img
                src="/brand/otter-states/trip-progress.png"
                alt=""
                className="w-[52px] sm:w-[60px] h-auto object-contain filter drop-shadow-2xs opacity-90"
                loading="lazy"
              />
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-14 sm:pr-16">
                <div className="relative inline-flex items-center gap-2 py-0.5 px-1">
                  {/* Forme prune ciblée uniquement derrière le titre de section */}
                  <KrewOrganicBlob
                    tone="plum"
                    variant="sweep"
                    className="absolute -top-2 -left-3 w-[220px] sm:w-[250px] h-[46px] sm:h-[48px] pointer-events-none text-primary opacity-25 z-0"
                  />
                  <KrewIcon name="group" tone="plum" size="sm" className="size-[22px] shrink-0 relative z-10" />
                  <h2 className="font-display text-[28px] sm:text-[30px] font-normal leading-[1.02] text-foreground relative z-10">
                    Membres du groupe
                  </h2>
                </div>
              </div>

              {/* Underline wave KrewMark sous le titre */}
              <KrewMark type="underline-wave" tone="sage" size="sm" className="krew-group-title-underline mt-1 opacity-90 pointer-events-none" />
            </div>

            <ul className="divide-y divide-border/40 pt-1">
              {participants.length === 0 ? (
                <li className="text-sm text-muted-foreground py-4">
                  Personne n’a encore rejoint le groupe.
                </li>
              ) : (
                participants.map((p) => {
                  const picks = (logistics.transportPicks ?? []) as any[];
                  const userPick = p.user_id
                    ? picks.find((pk: any) => pk.userId === p.user_id)
                    : null;
                  const city =
                    progress?.participants?.find((pr: any) => pr.user_id === p.user_id)
                      ?.departure_city ||
                    p.departure_city ||
                    userPick?.city ||
                    null;
                  const isOwner = Boolean(p.user_id && !p.placeholder && p.user_id === trip.owner_id);
                  const isCoOrganizer = Boolean(
                    p.user_id &&
                      !p.placeholder &&
                      p.user_id !== starUid &&
                      p.user_id !== trip.owner_id &&
                      p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId),
                  );

                  const transportMode = userPick?.mode ? String(userPick.mode).toLowerCase() : "";
                  const transportIconName: "plane" | "train" | "car" | "transport" =
                    transportMode.includes("flight") || transportMode.includes("plane") || transportMode.includes("avion")
                      ? "plane"
                      : transportMode.includes("train")
                        ? "train"
                        : transportMode.includes("car") || transportMode.includes("voiture")
                          ? "car"
                          : "transport";

                  const initial = String(p.display_name || p.email || "P").trim().charAt(0).toUpperCase();

                  return (
                    <li
                      key={p.id}
                      className="flex flex-row items-center justify-between min-h-[48px] py-2.5 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Petit repère graphique initial */}
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/16 text-primary font-mono text-xs font-semibold">
                          {initial}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm truncate flex items-center">
                              <span>{p.display_name ?? p.email}</span>
                              {p.user_id === data.userId ? (
                                <span className="font-normal text-[11px] text-muted-foreground ml-1.5 shrink-0">
                                  (Moi)
                                </span>
                              ) : null}
                            </p>
                            {isOwner ? (
                              <span className="text-[11px] font-medium text-primary whitespace-nowrap">
                                Organisateur·rice
                              </span>
                            ) : isCoOrganizer ? (
                              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                Co-organisateur·rice
                              </span>
                            ) : null}
                            {p.isStar ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary whitespace-nowrap">
                                <KrewIcon name="favorite" tone="sage" size="sm" className="size-3" />
                                <span>Star</span>
                              </span>
                            ) : null}
                          </div>
                          {city || userPick ? (
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {city ? (
                                <span className="inline-flex items-center gap-1">
                                  <KrewIcon name="destination" tone="muted" size="sm" className="size-3" />
                                  <span>Départ : <strong className="text-foreground font-normal">{city}</strong></span>
                                </span>
                              ) : null}
                              {userPick ? (
                                <span className="inline-flex items-center gap-1">
                                  <KrewIcon name={transportIconName} tone="muted" size="sm" className="size-3" />
                                  <span>Trajet : <strong className="text-foreground font-normal">{userPick.modeLabel || userPick.mode}</strong></span>
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
                        {p.status === "accepte" ? (
                          <span className="inline-flex items-center gap-1 font-medium text-primary whitespace-nowrap">
                            <KrewIcon name="check" tone="sage" size="sm" className="size-3.5" />
                            <span>Participe</span>
                          </span>
                        ) : p.status === "absent" ? (
                          <span className="text-muted-foreground italic whitespace-nowrap">Absent</span>
                        ) : (
                          <span className="text-muted-foreground whitespace-nowrap capitalize">{p.status}</span>
                        )}

                        {p.user_id === data.userId ? (
                          <button
                            type="button"
                            className="text-xs text-primary font-medium hover:underline ml-2 whitespace-nowrap"
                            onClick={() => {
                              const nextStatus =
                                (p.status as string) === "absent" ? "accepte" : "absent";
                              declareStatusMutation.mutate(nextStatus);
                            }}
                          >
                            {(p.status as string) === "absent"
                              ? "Participer à nouveau"
                              : "Indiquer mon absence"}
                          </button>
                        ) : null}

                        {data.isCreator && p.user_id && !p.placeholder && !p.isStar && p.user_id !== "star-virtual-uid" && p.user_id !== trip.owner_id ? (
                          p.user_id === (trip.co_organizer_id || (trip as any).coOrganizerId) ? (
                            <button
                              type="button"
                              className="text-xs text-destructive/80 hover:underline"
                              disabled={setCoOrgMutation.isPending}
                              onClick={() => setCoOrgMutation.mutate({ coOrganizerId: null })}
                            >
                              Retirer le rôle de co-organisateur·rice
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                              disabled={setCoOrgMutation.isPending}
                              onClick={() =>
                                setCoOrgMutation.mutate({ coOrganizerId: p.user_id || null })
                              }
                            >
                              Nommer co-organisateur·rice
                            </button>
                          )
                        ) : null}

                        {data.isOwner && !p.placeholder && !p.isStar ? (
                          <button
                            type="button"
                            aria-label={`Retirer ${p.email || p.display_name}`}
                            className="text-muted-foreground/70 hover:text-destructive p-1"
                            onClick={() => removeMutation.mutate(p.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="mt-4 border-t-2 border-sage/35 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-sans text-muted-foreground">
                  <span className="font-sans text-foreground font-semibold">Total : <span className="font-mono">
                    {trip.participants_count || 2}
                  </span></span>{" "}
                  participants
                  {data.isOwner ? (
                    isEditingCount ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (countInput >= 2 && countInput <= 25) {
                            updateCountMutation.mutate(countInput);
                          } else {
                            toast.error("Le nombre de participants doit être entre 2 et 25");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 ml-2"
                      >
                        <Input
                          type="number"
                          min={2}
                          max={25}
                          value={countInput}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setCountInput(Number(e.target.value))}
                          className="w-16 h-7 text-xs font-mono"
                        />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-primary hover:underline"
                          disabled={updateCountMutation.isPending}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setIsEditingCount(false)}
                        >
                          Annuler
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-primary font-medium hover:underline ml-1"
                        onClick={() => {
                          setCountInput(Number(trip.participants_count || 2));
                          setIsEditingCount(true);
                        }}
                      >
                        Modifier
                      </button>
                    )
                  ) : null}
                </div>
            </div>

            {/* ACTION UNIQUE : RELANCER LE GROUPE */}
            {data.isOwner ? <div className="pt-4 border-t border-border/40"><Button type="button" variant="ghost" className="w-auto justify-start" onClick={() => shareOnWhatsApp(buildWhatsAppRemindMessage())}><KrewIcon name="group" tone="plum" size="sm" className="size-4 shrink-0" /><span>Relancer le groupe</span></Button></div> : null}
          </section>

          {costSplitData?.split ? (
            <section
              id="hub-cost-split"
              className="mt-8 space-y-4 scroll-mt-24"
            >
              <div>
                <div className="relative inline-flex items-center gap-2 py-0.5 px-1">
                  {/* Forme prune ciblée uniquement derrière le titre de section */}
                  <KrewOrganicBlob
                    tone="plum"
                    variant="soft"
                    className="absolute -top-2 -left-3 w-[230px] sm:w-[270px] h-[46px] sm:h-[48px] pointer-events-none text-primary opacity-25 z-0"
                  />
                  <KrewIcon name="budget" tone="plum" size="sm" className="size-[22px] shrink-0 relative z-10" />
                  <h2 className="font-display text-[28px] sm:text-[30px] font-normal leading-[1.02] text-foreground relative z-10">
                    Répartition des coûts
                  </h2>
                </div>
                <KrewMark type="underline" tone="sage" size="sm" className="w-[100px] h-[8px] mt-1 opacity-85 pointer-events-none" />
              </div>
              <div className="flex justify-end">
                <KrewNote variant="tape" tone="cream" rotation={-1} size="sm">
                  On partage, on s’y retrouve
                </KrewNote>
              </div>
              <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} />
            </section>
          ) : null}

          {data.isOwner && (trip.status as string) !== "annule" ? (
            <footer className="mt-16 pt-6 border-t border-border/40 space-y-4">
              <p className="text-sm font-semibold text-foreground">Gestion du voyage</p>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Archiver le voyage</p>
                    <p className="text-xs text-muted-foreground">
                      Il disparaîtra de tes voyages actifs, mais restera conservé pour être retrouvé ou réactivé plus tard.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="self-start text-sm text-primary hover:underline"
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Archiver ce voyage ? Tu pourras le retrouver et le réactiver plus tard.")) {
                        cancelMutation.mutate(false);
                      }
                    }}
                  >
                    Archiver
                  </button>
                </div>

                {data.isCreator ? (
                  <div className="border-t border-destructive/15 pt-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-destructive/80 hover:text-destructive hover:underline text-sm font-medium"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Supprimer définitivement ce voyage et toutes ses données ? Cette action est irréversible.",
                          )
                        ) {
                          cancelMutation.mutate(true);
                        }
                      }}
                    >
                      <Trash2 className="size-4 shrink-0" />
                      <span>Supprimer définitivement</span>
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Irréversible — le voyage et toutes ses données seront supprimés.
                    </p>
                  </div>
                ) : null}
              </div>
            </footer>
          ) : null}
        </div>
      ) : null}

      {/* Restitution finale uniquement lorsque destination et planning sont réellement validés. */}
      {finalRestitutionReady ? (
        <section className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                Résumé du voyage
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Retrouve ici les éléments principaux du voyage.
              </p>
            </div>
            <Button
              type="button"
              className="bg-[#25D366] text-white hover:bg-[#1ebe57] border-transparent"
              onClick={() => {
                const text = buildWhatsAppStatusMessage();
                shareOnWhatsApp(text);
              }}
            >
              Partager sur WhatsApp
            </Button>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Dates</dt>
              <dd className="mt-0.5 font-medium">
                {trip.start_date && trip.end_date
                  ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(trip.end_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                  : trip.start_date
                    ? new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR")
                    : "À définir"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lieu</dt>
              <dd className="mt-0.5 font-medium">
                {liveBudget.destinationName
                  ? `${liveBudget.destinationName}${liveBudget.country ? ` · ${liveBudget.country}` : ""}`
                  : "Destination à choisir"}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Budget estimé par personne
              </dt>
              <dd className="mt-0.5 font-semibold text-primary text-sm">
                {(costSplitData?.totalReserved != null && costSplitData.totalReserved > 0) ||
                (costSplitData?.totalEstimated != null && costSplitData.totalEstimated > 0) ? (
                  <div className="text-xs space-y-0.5 font-normal">
                    <div className="flex justify-between gap-1">
                      <span>Déjà réservé :</span>{" "}
                      <span className="font-bold text-primary font-mono">
                        {formatEuro(costSplitData.totalReserved ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span>Reste estimé :</span>{" "}
                      <span className="font-bold text-foreground font-mono">
                        {formatEuro(costSplitData.totalEstimated ?? 0)}
                      </span>
                    </div>
                  </div>
                ) : liveBudget.total > 0 ? (
                  `~${formatEuro(liveBudget.total)} / pers.`
                ) : (
                  "À définir"
                )}
              </dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface/40 px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Groupe</dt>
              <dd className="mt-0.5 font-medium">
                {trip.participants_count || participants?.length || "?"} pers.
                {liveBudget.topHotelName ? ` · hébergement : ${liveBudget.topHotelName}` : ""}
              </dd>
            </div>
          </dl>

          {liveBudget.total > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <li className="rounded-full border border-border px-2.5 py-1">
                Transport ~{formatEuro(liveBudget.transport)}
              </li>
              <li className="rounded-full border border-border px-2.5 py-1">
                Hébergement ~{formatEuro(liveBudget.accommodation)}
              </li>
              <li className="rounded-full border border-border px-2.5 py-1">
                Activités ~{formatEuro(liveBudget.activities)}
              </li>
              <li className="rounded-full border border-border px-2.5 py-1">
                Repas ~{formatEuro(liveBudget.food)}
              </li>
              {liveBudget.transportPicksCount > 0 ? (
                <li className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
                  {liveBudget.transportPicksCount} trajet(s) choisi(s)
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}


      {/* VUE VOYAGE (KREW JOURNEY TIMELINE) */}
      {currentView === "voyage" ? (
        !currentSection ? (
          (() => {
            const totalParts = progress?.total || trip.participants_count || 1;
            const availGroupDone = datesLocked || ((availData?.answered ?? 0) >= totalParts && totalParts > 0);
            const prefsGroupDone = (progress?.answered ?? 0) >= totalParts && totalParts > 0;
            const myAvailDone = datesLocked || Boolean(availData?.mine);
            const myPrefsDone = Boolean((myPrefsData as any)?.preferences);
            const starDone = Boolean(starData?.preferences);

            const datesReady = datesLocked;
            const profileDone = Boolean(profile?.validated);
            const profileReady = Boolean(readiness?.profile.questionnairesReady);
            const destDone = destinationSelected;
            const hotelDone = Boolean(logistics.selectedHotelId);
            const hotelOffersReady = Boolean(logistics.hotels?.length);
            const transportDone = Boolean(liveBudget.transportPicksCount && liveBudget.transportPicksCount >= totalParts);
            const planDone = hasItinerary;

            // Single next action matching Dashboard NextActionsPanel
            let nextActionId: string | null = null;
            if (!myAvailDone) nextActionId = "availability";
            else if (!myPrefsDone) nextActionId = "preferences";
            else if (hasStar && !starDone) nextActionId = "star";
            else if (!datesReady && data.isOwner) nextActionId = "dates";
            else if (datesReady && !profileDone && profileReady && data.isOwner) nextActionId = "profile";
            else if (datesReady && profileDone && !destDone && data.isOwner) nextActionId = "destination";
            else if (destDone && hotelOffersReady && !hotelDone && data.isOwner) nextActionId = "accommodation";
            else if (destDone && !transportDone) nextActionId = "transport";
            else if (destDone && !planDone && data.isOwner) nextActionId = "planning";

            // Step accessibility gating
            const isStepAvailable = (id: string): boolean => {
              if (id === "availability" || id === "preferences" || id === "star") return true;
              if (id === "dates") return true; // Always accessible to view/lock dates
              if (id === "profile") return datesReady && profileReady;
              if (id === "destination") return datesReady && (profileDone || Boolean(profile?.legacyBypass));
              if (id === "accommodation" || id === "transport") return destDone;
              if (id === "planning" || id === "tasks" || id === "packing") return destDone;
              return false;
            };

            const getStepStatus = (id: string, isGroupDone: boolean): "done" | "next_action" | "available" | "upcoming" => {
              if (isGroupDone) return "done";
              if (id === nextActionId) return "next_action";
              if (isStepAvailable(id)) return "available";
              return "upcoming";
            };

            const timelineSteps: TimelineStep[] = [
              {
                id: "availability",
                title: "Disponibilités",
                subtitle: datesLocked ? "Dates confirmées" : `${availData?.answered ?? 0}/${totalParts} indiquées`,
                iconName: "availability",
                status: getStepStatus("availability", availGroupDone),
                category: "questionnaire",
                href: `/trips/${tripId}/availability`,
              },
              {
                id: "preferences",
                title: "Préférences",
                subtitle: `${progress?.answered ?? 0}/${totalParts} réponses`,
                iconName: "preferences",
                status: getStepStatus("preferences", prefsGroupDone),
                category: "questionnaire",
                href: `/trips/${tripId}/questionnaire`,
              },
            ];

            if (hasStar || celebratedPerson || ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))) {
              timelineSteps.push({
                id: "star",
                title: `Préférences de ${celebratedPerson || "la Star"}`,
                subtitle: starDone ? "Complété" : "À remplir",
                iconName: "favorite",
                status: getStepStatus("star", starDone),
                category: "questionnaire",
                href: `/trips/${tripId}/star`,
              });
            }

            timelineSteps.push(
              {
                id: "dates",
                title: "Dates du groupe",
                subtitle: datesLocked && trip.start_date
                  ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date((trip.end_date || trip.start_date) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                  : "À confirmer",
                iconName: "calendar",
                status: getStepStatus("dates", datesReady),
                category: "prepare",
                href: `/trips/${tripId}/dates`,
              },
              {
                id: "profile",
                title: "Profil du voyage",
                subtitle: profile?.selectedConcepts?.length
                  ? profile.selectedConcepts.map((c) => PROFILE_LABELS[c.id as StayProfileId] || c.title).join(" · ")
                  : profileDone
                    ? "Profil enregistré"
                    : "À choisir",
                iconName: "profile",
                status: getStepStatus("profile", profileDone),
                category: "prepare",
                href: isStepAvailable("profile") ? `/trips/${tripId}/profile` : null,
              },
              {
                id: "destination",
                title: "Destination",
                subtitle: liveBudget.destinationName || (recommendations.length > 0 ? "Propositions prêtes" : "En attente de choix"),
                iconName: "destination",
                status: getStepStatus("destination", destDone),
                category: "prepare",
                href: isStepAvailable("destination") ? `/trips/${tripId}/destination` : null,
              },
              {
                id: "accommodation",
                title: "Hébergement",
                subtitle: liveBudget.topHotelName || (hotelOffersReady ? "Options à voter" : "En attente"),
                iconName: "accommodation",
                status: getStepStatus("accommodation", hotelDone),
                category: "prepare",
                href: isStepAvailable("accommodation") ? `/trips/${tripId}/accommodation` : null,
              },
              {
                id: "transport",
                title: "Transport",
                subtitle: liveBudget.transportPicksCount ? `${liveBudget.transportPicksCount} trajet${liveBudget.transportPicksCount > 1 ? "s" : ""} choisi${liveBudget.transportPicksCount > 1 ? "s" : ""}` : "Choix individuels",
                iconName: "transport",
                status: getStepStatus("transport", transportDone),
                category: "prepare",
                href: isStepAvailable("transport") ? `/trips/${tripId}/transport` : null,
              },
              {
                id: "planning",
                title: "Planning",
                subtitle: planDone ? "Planning en place" : "Activités et moments forts",
                iconName: "planning",
                status: getStepStatus("planning", planDone),
                category: "organisation",
                href: isStepAvailable("planning") ? `/trips/${tripId}/planning` : null,
              },
              {
                id: "tasks",
                title: "Tâches",
                subtitle: tasksData?.length ? `${tasksData.length} tâche(s)` : "Répartition du groupe",
                iconName: "tasks",
                status: getStepStatus("tasks", Boolean(tasksData?.length && planDone)),
                category: "organisation",
                href: isStepAvailable("tasks") ? `/trips/${tripId}/tasks` : null,
              },
              {
                id: "packing",
                title: "À emporter",
                subtitle: "Liste adaptée au voyage",
                iconName: "packing",
                status: getStepStatus("packing", false),
                category: "organisation",
                href: isStepAvailable("packing") ? `/trips/${tripId}/packing` : null,
              },
            );

            // "Vos souvenirs de voyage" step - active from start_date onwards
            const tripStarted = tripLifecycle === "live" || tripLifecycle === "completed";

            timelineSteps.push({
              id: "memories",
              title: "Souvenirs du voyage",
              subtitle: tripStarted ? "Album et photos du groupe" : "Se débloquera au moment du voyage",
              iconName: "camera",
              status: tripStarted ? "available" : "upcoming",
              category: "souvenirs",
              href: tripStarted ? `/trips/${tripId}/memories` : null,
            });

            return (
              <KrewJourneyTimeline
                tripId={tripId}
                tripName={trip.name}
                steps={timelineSteps}
                annotationText="Prochaine étape"
              />
            );
          })()
        ) : (
          <div className="space-y-6">
            <Link
              to="/trips/$tripId"
              params={{ tripId }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="size-4" /> Retour au voyage
            </Link>

      {currentSection === "expenses" && destinationSelected && costSplitData?.split ? (
        <section
          id="hub-cost-split"
          className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight flex items-center gap-2">
                <Wallet className="size-5 text-primary" />
                Répartition des coûts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Une estimation de la part de chacun pour le voyage.
              </p>
            </div>
          </div>
          <CostSplitCard split={costSplitData.split} tripName={trip.name} tripId={tripId} />
        </section>
      ) : null}

      

          </div>
        )
      ) : null}
    </KrewPageShell>
  );
}
