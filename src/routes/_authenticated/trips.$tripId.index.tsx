import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Trash2, Wallet } from "lucide-react";

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
import { useTripHubData } from "@/hooks/useTripHubData";
import { cn } from "@/lib/utils";
import { buildTripStatusWhatsApp, shareOnWhatsApp } from "@/lib/krew/whatsapp";

export const Route = createFileRoute("/_authenticated/trips/$tripId/")({
  validateSearch: (search: Record<string, unknown>): { view: string; section?: string } => ({
    view: (search["view"] as string) || "todo",
    ...(typeof search["section"] === "string" ? { section: search["section"] } : {}),
  }),
  beforeLoad: ({ params, search }) => {
    switch (search.section) {
      case "dates":
        throw redirect({ to: "/trips/$tripId/dates", params: { tripId: params.tripId } });
      case "profile":
        throw redirect({ to: "/trips/$tripId/profile", params: { tripId: params.tripId } });
      case "destination":
        throw redirect({ to: "/trips/$tripId/destination", params: { tripId: params.tripId } });
      case "accommodation":
        throw redirect({ to: "/trips/$tripId/accommodation", params: { tripId: params.tripId } });
      case "transport":
        throw redirect({ to: "/trips/$tripId/transport", params: { tripId: params.tripId } });
      case "planning":
        throw redirect({ to: "/trips/$tripId/planning", params: { tripId: params.tripId } });
      case "tasks":
        throw redirect({ to: "/trips/$tripId/tasks", params: { tripId: params.tripId } });
      case "packing":
        throw redirect({ to: "/trips/$tripId/packing", params: { tripId: params.tripId } });
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
  const hub = useTripHubData(tripId);
  const actions = useTripHubActions(tripId);

  if (hub.isLoading || !hub.data || !hub.trip) {
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

  if (hub.isSecretStar) {
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
          <strong>{hub.tripPreview.name}</strong>).
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

  const data = hub.data;
  const trip = hub.trip;

  function buildWhatsAppStatusMessage() {
    const statusLines: string[] = [];
    const pendingActions: { name: string; action: string }[] = [];
    const nameOf = (participant: (typeof hub.participants)[number]) =>
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
    if (hub.liveBudget.destinationName) {
      statusLines.push(`📍 Destination : ${hub.liveBudget.destinationName}`);
    }
    if (hub.logisticsPreview.hotels?.length) {
      statusLines.push(
        `🏠 Hébergement : ${hub.logisticsPreview.hotelBookingStatus || "vote en cours"}`,
      );
    }
    if (hub.logisticsPreview.transports?.length) {
      statusLines.push(
        `🚆 Transport : ${hub.liveBudget.transportPicksCount || 0} choix enregistré(s)`,
      );
    }
    if (hub.liveBudget.total > 0) {
      statusLines.push(`💰 Budget estimé : ~${hub.liveBudget.total} € / pers.`);
    }

    for (const participant of (hub.progress?.participants ?? []) as Array<{
      display_name?: string | null;
      email?: string | null;
      hasAnsweredAvailability?: boolean;
      hasAnswered?: boolean;
    }>) {
      if (!participant.hasAnsweredAvailability) {
        pendingActions.push({ name: nameOf(participant), action: "disponibilités" });
      }
      if (!participant.hasAnswered) {
        pendingActions.push({ name: nameOf(participant), action: "préférences" });
      }
    }

    if (
      hub.logisticsPreview.star_mode === "secret" &&
      trip.celebrated_person &&
      !hub.starData?.preferences
    ) {
      pendingActions.push({
        name: "organisateur",
        action: `Préférences de ${trip.celebrated_person}`,
      });
    }

    if (hub.logisticsPreview.hotels?.length) {
      const voters = new Set(
        (hub.logisticsPreview.hotelVotes ?? []).map((vote: { userId?: string }) => vote.userId),
      );
      for (const participant of hub.participants.filter(
        (item) => item.user_id && item.status !== "absent",
      )) {
        if (!voters.has(participant.user_id)) {
          pendingActions.push({
            name: nameOf(participant),
            action: "voter pour l’hébergement",
          });
        }
      }
    }

    if (hub.logisticsPreview.transports?.length) {
      const pickers = new Set(
        (hub.logisticsPreview.transportPicks ?? []).map(
          (pick: { userId?: string }) => pick.userId,
        ),
      );
      for (const participant of hub.participants.filter(
        (item) => item.user_id && item.status !== "absent",
      )) {
        if (!pickers.has(participant.user_id)) {
          pendingActions.push({
            name: nameOf(participant),
            action: "choisir son transport",
          });
        }
      }
    }

    return buildTripStatusWhatsApp({
      tripName: trip.name || "notre voyage",
      tripUrl:
        typeof window === "undefined"
          ? `/trips/${trip.id}`
          : `${window.location.origin}/trips/${trip.id}`,
      statusLines,
      actions: pendingActions,
    });
  }

  function buildWhatsAppRemindMessage() {
    const missingParticipants =
      hub.progress?.participants?.filter(
        (participant: {
          display_name?: string | null;
          email?: string | null;
          hasAnsweredAvailability?: boolean;
          hasAnswered?: boolean;
        }) =>
          !participant.hasAnswered || !participant.hasAnsweredAvailability,
      ) || [];
    const lines = [
      `Petit rappel pour « ${trip.name || "notre voyage"} »`,
      "",
      "Il reste quelques réponses à compléter :",
    ];

    for (const participant of missingParticipants) {
      const name =
        participant.display_name ||
        participant.email?.split("@")[0] ||
        "Ami";
      const missing: string[] = [];
      if (!participant.hasAnsweredAvailability) missing.push("disponibilités");
      if (!participant.hasAnswered) missing.push("préférences");
      lines.push(`• ${name} : ${missing.join(" + ")}`);
    }

    lines.push("");
    if (typeof window !== "undefined" && trip.id) {
      lines.push(`${window.location.origin}/trips/${trip.id}`);
    }
    return lines.join("\n");
  }

  return (
    <KrewPageShell
      size="standard"
      gutter="compact"
      data-krew-page-surface="trip-hub"
      className="py-10"
    >
      <nav
        aria-label="Navigation principale du voyage"
        className="flex items-center border-b border-border/50 pb-3 gap-6 font-medium text-sm mb-6"
      >
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
            trip={{ ...trip, participants: hub.participants }}
            isOwner={data.isOwner}
            participantsCount={hub.progress?.total || hub.participants.length}
            progressAnswered={hub.progress?.answered ?? 0}
            progressTotal={hub.progress?.total || hub.participants.length}
            availabilityAnswered={hub.availData?.answered ?? 0}
            availabilityExpected={hub.progress?.total || hub.participants.length}
            provisionalStart={
              trip.start_date ??
              hub.availData?.windows?.[0]?.start ??
              (trip as any).provisional_start_date
            }
            provisionalCoverage={hub.availData?.windows?.[0]?.coverageRatio ?? null}
            myAvailabilityDone={Boolean(hub.availData?.mine)}
            myPreferencesDone={Boolean((hub.myPrefsData as any)?.preferences)}
            starDone={Boolean(hub.starData?.preferences)}
            hasRecommendations={hub.recommendations.length > 0}
            profileReady={Boolean(hub.readiness?.profile.questionnairesReady)}
            profileValidated={Boolean(hub.profile?.validated)}
            destinationSelected={hub.destinationSelected}
            destinationName={hub.selectedReco?.destinations?.name ?? null}
            liveBudgetTotal={hub.liveBudget.total > 0 ? hub.liveBudget.total : null}
            totalReserved={hub.costSplitData?.totalReserved ?? null}
            totalEstimated={hub.costSplitData?.totalEstimated ?? null}
            topScores={hub.recommendations.slice(0, 3).map((recommendation) => ({
              name: recommendation.destinations?.name ?? "Destination",
              score: recommendation.score,
            }))}
            activitiesValidated={hub.activitiesValidated}
            tripEndDatePassed={hub.tripEndDatePassed}
          />

          <TripHubMembersSection
            hub={hub}
            actions={actions}
            onRemind={() => shareOnWhatsApp(buildWhatsAppRemindMessage())}
          />

          {hub.costSplitData?.split ? (
            <section id="hub-cost-split" className="mt-8 space-y-4 scroll-mt-24">
              <div>
                <div className="relative inline-flex items-center gap-2 py-0.5 px-1">
                  <KrewOrganicBlob
                    tone="plum"
                    variant="soft"
                    className="absolute -top-2 -left-3 w-[230px] sm:w-[270px] h-[46px] sm:h-[48px] pointer-events-none text-primary opacity-25 z-0"
                  />
                  <KrewIcon
                    name="budget"
                    tone="plum"
                    size="sm"
                    className="size-[22px] shrink-0 relative z-10"
                  />
                  <h2 className="font-display text-[28px] sm:text-[30px] font-normal leading-[1.02] text-foreground relative z-10">
                    Répartition des coûts
                  </h2>
                </div>
                <KrewMark
                  type="underline"
                  tone="sage"
                  size="sm"
                  className="w-[100px] h-[8px] mt-1 opacity-85 pointer-events-none"
                />
              </div>
              <div className="flex justify-end">
                <KrewNote variant="tape" tone="cream" rotation={-1} size="sm">
                  On partage, on s’y retrouve
                </KrewNote>
              </div>
              <CostSplitCard
                split={hub.costSplitData.split}
                tripName={trip.name}
                tripId={tripId}
              />
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
                    disabled={actions.cancelMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archiver ce voyage ? Tu pourras le retrouver et le réactiver plus tard.",
                        )
                      ) {
                        actions.cancelMutation.mutate(false);
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
                      disabled={actions.cancelMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Supprimer définitivement ce voyage et toutes ses données ? Cette action est irréversible.",
                          )
                        ) {
                          actions.cancelMutation.mutate(true);
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

      <TripHubFinalRecap
        hub={hub}
        onShare={() => shareOnWhatsApp(buildWhatsAppStatusMessage())}
      />

      {currentView === "voyage" && !currentSection ? (
        <TripHubJourneyView tripId={tripId} hub={hub} />
      ) : null}

      {currentView === "voyage" &&
      currentSection === "expenses" &&
      hub.destinationSelected &&
      hub.costSplitData?.split ? (
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
          <CostSplitCard
            split={hub.costSplitData.split}
            tripName={trip.name}
            tripId={tripId}
          />
        </section>
      ) : null}
    </KrewPageShell>
  );
}
