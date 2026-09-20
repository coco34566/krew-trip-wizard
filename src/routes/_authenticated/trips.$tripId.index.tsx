import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { TripHubDashboard } from "@/components/krew/TripHubDashboard.entry";
import { TripHubFinalRecap } from "@/components/krew/TripHubFinalRecap";
import { TripHubJourneyView } from "@/components/krew/TripHubJourneyView";
import { TripHubMembersSection } from "@/components/krew/TripHubMembersSection";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { useTripHubActions } from "@/hooks/useTripHubActions";
import { useTripHubData, type TripHubRecommendation } from "@/hooks/useTripHubData";
import { computeItineraryActivitiesCost } from "@/lib/krew/cost-split";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { isFinalTripPreparationReady } from "@/lib/krew/packing-list";
import { buildTripStatusWhatsApp, shareOnWhatsApp } from "@/lib/krew/whatsapp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: (search.view as string) || "todo",
    section: (search.section as string) || undefined,
  }),
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

function TripDetail() {
  const { tripId } = Route.useParams();
  const search = Route.useSearch();
  const currentView = search?.view ?? "todo";
  const currentSection = search?.section;
  const {
    data,
    isLoading,
    readiness,
    tasksData,
    starData,
    availData,
    costSplitData,
    progress,
    myPrefsData,
    profile,
  } = useTripHubData(tripId);
  const {
    isEditingCount,
    setIsEditingCount,
    countInput,
    setCountInput,
    updateCountMutation,
    setCoOrgMutation,
    removeMutation,
    declareStatusMutation,
    cancelMutation,
  } = useTripHubActions(tripId);

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
  const recommendations = (data.recommendations ?? []) as unknown as TripHubRecommendation[];
  const activities = (data.activities ?? []) as {
    id: string;
    name: string;
    category: string;
    price_per_person: number;
    rating: number;
  }[];
  const votes = (data.votes ?? []) as { recommendation_id: string; user_id: string }[];
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
        if (isStarByUid) return { ...p, isStar: true };
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
  const selectedReco = recommendations.find((r) => r.is_selected);
  const logistics = ((trip as any).group_logistics || {}) as any;
  const selectedActivityIds = new Set<string>(
    ((trip as any).selected_activity_ids ?? []) as string[],
  );

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

          <TripHubMembersSection
            trip={trip}
            participants={participants}
            logistics={logistics}
            progress={progress}
            viewerUserId={data.userId}
            isCreator={Boolean(data.isCreator)}
            isOwner={Boolean(data.isOwner)}
            starUid={starUid}
            isEditingCount={isEditingCount}
            countInput={countInput}
            updateCountPending={updateCountMutation.isPending}
            setCoOrgPending={setCoOrgMutation.isPending}
            onEditingCountChange={setIsEditingCount}
            onCountInputChange={setCountInput}
            onUpdateCount={(count) => updateCountMutation.mutate(count)}
            onDeclareStatus={(status) => declareStatusMutation.mutate(status)}
            onSetCoOrganizer={(coOrganizerId) => setCoOrgMutation.mutate({ coOrganizerId })}
            onRemoveParticipant={(participantId) => removeMutation.mutate(participantId)}
            onRemind={() => shareOnWhatsApp(buildWhatsAppRemindMessage())}
          />

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

      {finalRestitutionReady ? (
        <TripHubFinalRecap
          trip={trip}
          participantsCount={participants.length}
          liveBudget={liveBudget}
          costSplitData={costSplitData}
          onShare={() => shareOnWhatsApp(buildWhatsAppStatusMessage())}
        />
      ) : null}


      {currentView === "voyage" ? (
        <TripHubJourneyView
          tripId={tripId}
          currentSection={currentSection}
          trip={trip}
          isOwner={Boolean(data.isOwner)}
          progress={progress}
          availData={availData}
          myPrefsData={myPrefsData}
          starData={starData}
          profile={profile}
          readiness={readiness}
          destinationSelected={destinationSelected}
          logistics={logistics}
          liveBudget={liveBudget}
          hasItinerary={hasItinerary}
          hasStar={hasStar}
          celebratedPerson={celebratedPerson}
          recommendations={recommendations}
          tasksData={tasksData}
          tripLifecycle={tripLifecycle}
          costSplitData={costSplitData}
        />
      ) : null}
    </KrewPageShell>
  );
}
