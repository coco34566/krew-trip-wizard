import { Link } from "@tanstack/react-router";
import { ArrowLeft, Wallet } from "lucide-react";

import { CostSplitCard } from "@/components/krew/CostSplitCard";
import { KrewJourneyTimeline } from "@/components/krew/KrewJourneyTimeline.entry";
import type { TimelineStep } from "@/components/krew/KrewJourneyTimeline";
import { PROFILE_LABELS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";

export function TripHubJourneyView({
  currentView,
  currentSection,
  progress,
  trip,
  datesLocked,
  availData,
  myPrefsData,
  starData,
  profile,
  readiness,
  destinationSelected,
  logistics,
  liveBudget,
  hasItinerary,
  data,
  recommendations,
  tasksData,
  hasStar,
  celebratedPerson,
  tripLifecycle,
  tripId,
  costSplitData,
}: {
  currentView: string;
  currentSection: string | undefined;
  progress: any;
  trip: any;
  datesLocked: boolean;
  availData: any;
  myPrefsData: any;
  starData: any;
  profile: any;
  readiness: any;
  destinationSelected: boolean;
  logistics: any;
  liveBudget: any;
  hasItinerary: boolean;
  data: any;
  recommendations: any[];
  tasksData: any[] | undefined;
  hasStar: boolean;
  celebratedPerson: string | null | undefined;
  tripLifecycle: string;
  tripId: string;
  costSplitData: any;
}) {
  return (
    <>
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
                  ? profile.selectedConcepts.map((c: StayConcept) => PROFILE_LABELS[c.id as StayProfileId] || c.title).join(" · ")
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
              search={{ view: "voyage" }}
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
    </>
  );
}
