import { KrewJourneyTimeline } from "@/components/krew/KrewJourneyTimeline.entry";
import type { TimelineStep } from "@/components/krew/KrewJourneyTimeline";
import type { TripHubData } from "@/hooks/useTripHubData";
import { PROFILE_LABELS, type StayProfileId } from "@/lib/krew/stay-profiles";

export function TripHubJourneyView({
  tripId,
  hub,
}: {
  tripId: string;
  hub: TripHubData;
}) {
  const data = hub.data;
  const trip = hub.trip;
  if (!data || !trip) return null;

  const totalParts = hub.progress?.total || trip.participants_count || 1;
  const availGroupDone =
    hub.datesLocked ||
    ((hub.availData?.answered ?? 0) >= totalParts && totalParts > 0);
  const prefsGroupDone =
    (hub.progress?.answered ?? 0) >= totalParts && totalParts > 0;
  const myAvailDone = hub.datesLocked || Boolean(hub.availData?.mine);
  const myPrefsDone = Boolean((hub.myPrefsData as any)?.preferences);
  const starDone = Boolean(hub.starData?.preferences);

  const datesReady = hub.datesLocked;
  const profileDone = Boolean(hub.profile?.validated);
  const profileReady = Boolean(hub.readiness?.profile.questionnairesReady);
  const destDone = hub.destinationSelected;
  const hotelDone = Boolean(hub.logistics.selectedHotelId);
  const hotelOffersReady = Boolean(hub.logistics.hotels?.length);
  const transportDone = Boolean(
    hub.liveBudget.transportPicksCount &&
      hub.liveBudget.transportPicksCount >= totalParts,
  );
  const planDone = hub.hasItinerary;

  let nextActionId: string | null = null;
  if (!myAvailDone) nextActionId = "availability";
  else if (!myPrefsDone) nextActionId = "preferences";
  else if (hub.hasStar && !starDone) nextActionId = "star";
  else if (!datesReady && data.isOwner) nextActionId = "dates";
  else if (datesReady && !profileDone && profileReady && data.isOwner) nextActionId = "profile";
  else if (datesReady && profileDone && !destDone && data.isOwner) nextActionId = "destination";
  else if (destDone && hotelOffersReady && !hotelDone && data.isOwner) nextActionId = "accommodation";
  else if (destDone && !transportDone) nextActionId = "transport";
  else if (destDone && !planDone && data.isOwner) nextActionId = "planning";

  const isStepAvailable = (id: string): boolean => {
    if (id === "availability" || id === "preferences" || id === "star") return true;
    if (id === "dates") return true;
    if (id === "profile") return datesReady && profileReady;
    if (id === "destination") {
      return datesReady && (profileDone || Boolean(hub.profile?.legacyBypass));
    }
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
      subtitle: hub.datesLocked
        ? "Dates confirmées"
        : `${hub.availData?.answered ?? 0}/${totalParts} indiquées`,
      iconName: "availability",
      status: getStepStatus("availability", availGroupDone),
      category: "questionnaire",
      href: `/trips/${tripId}/availability`,
    },
    {
      id: "preferences",
      title: "Préférences",
      subtitle: `${hub.progress?.answered ?? 0}/${totalParts} réponses`,
      iconName: "preferences",
      status: getStepStatus("preferences", prefsGroupDone),
      category: "questionnaire",
      href: `/trips/${tripId}/questionnaire`,
    },
  ];

  if (
    hub.hasStar ||
    hub.celebratedPerson ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(String(trip.event_type))
  ) {
    timelineSteps.push({
      id: "star",
      title: `Préférences de ${hub.celebratedPerson || "la Star"}`,
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
        hub.datesLocked && trip.start_date
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
      subtitle: hub.profile?.selectedConcepts?.length
        ? hub.profile.selectedConcepts
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
        hub.liveBudget.destinationName ||
        (hub.recommendations.length > 0
          ? "Propositions prêtes"
          : "En attente de choix"),
      iconName: "destination",
      status: getStepStatus("destination", destDone),
      category: "prepare",
      href: isStepAvailable("destination")
        ? `/trips/${tripId}/destination`
        : null,
    },
    {
      id: "accommodation",
      title: "Hébergement",
      subtitle:
        hub.liveBudget.topHotelName ||
        (hotelOffersReady ? "Options à voter" : "En attente"),
      iconName: "accommodation",
      status: getStepStatus("accommodation", hotelDone),
      category: "prepare",
      href: isStepAvailable("accommodation")
        ? `/trips/${tripId}/accommodation`
        : null,
    },
    {
      id: "transport",
      title: "Transport",
      subtitle: hub.liveBudget.transportPicksCount
        ? `${hub.liveBudget.transportPicksCount} trajet${hub.liveBudget.transportPicksCount > 1 ? "s" : ""} choisi${hub.liveBudget.transportPicksCount > 1 ? "s" : ""}`
        : "Choix individuels",
      iconName: "transport",
      status: getStepStatus("transport", transportDone),
      category: "prepare",
      href: isStepAvailable("transport")
        ? `/trips/${tripId}/transport`
        : null,
    },
    {
      id: "planning",
      title: "Planning",
      subtitle: planDone ? "Planning en place" : "Activités et moments forts",
      iconName: "planning",
      status: getStepStatus("planning", planDone),
      category: "organisation",
      href: isStepAvailable("planning")
        ? `/trips/${tripId}/planning`
        : null,
    },
    {
      id: "tasks",
      title: "Tâches",
      subtitle: hub.tasksData?.length
        ? `${hub.tasksData.length} tâche(s)`
        : "Répartition du groupe",
      iconName: "tasks",
      status: getStepStatus(
        "tasks",
        Boolean(hub.tasksData?.length && planDone),
      ),
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
      href: isStepAvailable("packing")
        ? `/trips/${tripId}/packing`
        : null,
    },
  );

  const tripStarted =
    hub.tripLifecycle === "live" || hub.tripLifecycle === "completed";

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
      tripName={trip.name}
      steps={timelineSteps}
      annotationText="Prochaine étape"
    />
  );
}
