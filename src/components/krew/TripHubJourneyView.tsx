import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Wallet } from "lucide-react";

import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { KrewJourneyTimeline } from "@/components/krew/KrewJourneyTimeline.entry";
import type { TimelineStep } from "@/components/krew/KrewJourneyTimeline";
import { PROFILE_LABELS, type StayProfileId } from "@/lib/krew/stay-profiles";

type CostSplit = ComponentProps<typeof CostSplitCard>["split"];

type TripLike = {
  name?: string | null;
  participants_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  event_type?: string | null;
  dates_locked?: boolean | null;
};

type ProfileLike = {
  selectedConcepts?: Array<{ id: string; title: string }>;
  validated?: boolean;
  legacyBypass?: boolean;
};

type LiveBudget = {
  destinationName: string | null;
  topHotelName: string | null;
  transportPicksCount: number;
};

export function TripHubJourneyView({
  currentView,
  currentSection,
  tripId,
  trip,
  isOwner,
  profile,
  progressAnswered,
  progressTotal,
  availabilityAnswered,
  availabilityMine,
  myPreferencesDone,
  starDone,
  profileReady,
  destinationSelected,
  selectedHotelId,
  hotelOffersReady,
  liveBudget,
  recommendationsCount,
  tasksCount,
  hasStar,
  celebratedPerson,
  tripLifecycle,
  hasItinerary,
  costSplitSplit,
}: {
  currentView: string;
  currentSection: string | undefined;
  tripId: string;
  trip: TripLike;
  isOwner: boolean;
  profile: ProfileLike | undefined;
  progressAnswered: number;
  progressTotal: number;
  availabilityAnswered: number;
  availabilityMine: boolean;
  myPreferencesDone: boolean;
  starDone: boolean;
  profileReady: boolean;
  destinationSelected: boolean;
  selectedHotelId: string | null | undefined;
  hotelOffersReady: boolean;
  liveBudget: LiveBudget;
  recommendationsCount: number;
  tasksCount: number;
  hasStar: boolean;
  celebratedPerson: string | null | undefined;
  tripLifecycle: string;
  hasItinerary: boolean;
  costSplitSplit: CostSplit | undefined;
}) {
  if (currentView !== "voyage") return null;

  if (currentSection) {
    return (
      <div className="space-y-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage", section: undefined }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" /> Retour au voyage
        </Link>

        {currentSection === "expenses" && destinationSelected && costSplitSplit ? (
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
            <CostSplitCard split={costSplitSplit} tripName={trip.name ?? undefined} tripId={tripId} />
          </section>
        ) : null}
      </div>
    );
  }

  const totalParts = progressTotal || trip.participants_count || 1;
  const datesLocked = Boolean(trip.dates_locked);
  const availGroupDone =
    datesLocked || (availabilityAnswered >= totalParts && totalParts > 0);
  const prefsGroupDone = progressAnswered >= totalParts && totalParts > 0;
  const myAvailDone = datesLocked || availabilityMine;
  const datesReady = datesLocked;
  const profileDone = Boolean(profile?.validated);
  const destDone = destinationSelected;
  const hotelDone = Boolean(selectedHotelId);
  const transportDone = Boolean(
    liveBudget.transportPicksCount && liveBudget.transportPicksCount >= totalParts,
  );
  const planDone = hasItinerary;

  let nextActionId: string | null = null;
  if (!myAvailDone) nextActionId = "availability";
  else if (!myPreferencesDone) nextActionId = "preferences";
  else if (hasStar && !starDone) nextActionId = "star";
  else if (!datesReady && isOwner) nextActionId = "dates";
  else if (datesReady && !profileDone && profileReady && isOwner) nextActionId = "profile";
  else if (datesReady && profileDone && !destDone && isOwner) nextActionId = "destination";
  else if (destDone && hotelOffersReady && !hotelDone && isOwner) nextActionId = "accommodation";
  else if (destDone && !transportDone) nextActionId = "transport";
  else if (destDone && !planDone && isOwner) nextActionId = "planning";

  const isStepAvailable = (id: string): boolean => {
    if (id === "availability" || id === "preferences" || id === "star") return true;
    if (id === "dates") return true;
    if (id === "profile") return datesReady && profileReady;
    if (id === "destination") return datesReady && (profileDone || Boolean(profile?.legacyBypass));
    if (id === "accommodation" || id === "transport") return destDone;
    if (id === "planning" || id === "tasks" || id === "packing") return destDone;
    return false;
  };

  const getStepStatus = (
    id: string,
    isGroupDone: boolean,
  ): "done" | "next_action" | "available" | "upcoming" => {
    if (isGroupDone) return "done";
    if (id === nextActionId) return "next_action";
    if (isStepAvailable(id)) return "available";
    return "upcoming";
  };

  const timelineSteps: TimelineStep[] = [
    {
      id: "availability",
      title: "Disponibilités",
      subtitle: datesLocked
        ? "Dates confirmées"
        : `${availabilityAnswered}/${totalParts} indiquées`,
      iconName: "availability",
      status: getStepStatus("availability", availGroupDone),
      category: "questionnaire",
      href: `/trips/${tripId}/availability`,
    },
    {
      id: "preferences",
      title: "Préférences",
      subtitle: `${progressAnswered}/${totalParts} réponses`,
      iconName: "preferences",
      status: getStepStatus("preferences", prefsGroupDone),
      category: "questionnaire",
      href: `/trips/${tripId}/questionnaire`,
    },
  ];

  if (
    hasStar ||
    celebratedPerson ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))
  ) {
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
      subtitle:
        datesLocked && trip.start_date
          ? `${new Date(trip.start_date + "T12:00:00").toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })} → ${new Date((trip.end_date || trip.start_date) + "T12:00:00").toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}`
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
        ? profile.selectedConcepts
            .map(
              (concept) =>
                PROFILE_LABELS[concept.id as StayProfileId] || concept.title,
            )
            .join(" · ")
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
      subtitle:
        liveBudget.destinationName ||
        (recommendationsCount > 0 ? "Propositions prêtes" : "En attente de choix"),
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
      subtitle: liveBudget.transportPicksCount
        ? `${liveBudget.transportPicksCount} trajet${liveBudget.transportPicksCount > 1 ? "s" : ""} choisi${liveBudget.transportPicksCount > 1 ? "s" : ""}`
        : "Choix individuels",
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
      subtitle: tasksCount ? `${tasksCount} tâche(s)` : "Répartition du groupe",
      iconName: "tasks",
      status: getStepStatus("tasks", Boolean(tasksCount && planDone)),
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

  const tripStarted = tripLifecycle === "live" || tripLifecycle === "completed";
  timelineSteps.push({
    id: "memories",
    title: "Souvenirs du voyage",
    subtitle: tripStarted
      ? "Album et photos du groupe"
      : "Se débloquera au moment du voyage",
    iconName: "camera",
    status: tripStarted ? "available" : "upcoming",
    category: "souvenirs",
    href: tripStarted ? `/trips/${tripId}/memories` : null,
  });

  return (
    <KrewJourneyTimeline
      tripId={tripId}
      tripName={trip.name ?? "Voyage"}
      steps={timelineSteps}
      annotationText="Prochaine étape"
    />
  );
}
