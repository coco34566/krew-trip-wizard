import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";

import { PlanningMapSection } from "@/components/krew/PlanningMapSection";
import { TripInvitePage } from "@/components/krew/TripInvitePage";
import { TripPlanningPage } from "@/components/krew/TripPlanningPage";
import { TripProfilePage } from "@/components/krew/TripProfilePage";
import { TripStarAccessGate } from "@/components/krew/TripStarAccessGate";
import { TripTasksPage } from "@/components/krew/TripTasksPage";
import { TripTransportPage } from "@/components/krew/TripTransportPage";
import { getTripAvailability } from "@/lib/availability.functions";
import { getMyParticipantPreferences } from "@/lib/participant-preferences.functions";

/**
 * Layout parent du voyage : obligatoire pour que les routes enfants
 * (availability, questionnaire, invite, star, recap) s'affichent via <Outlet />.
 */
export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripLayout,
});

function ClosedResponseState({ tripId, title, hasPreviousAnswer, children }: { tripId: string; title: string; hasPreviousAnswer: boolean; children: ReactNode }) {
  return (
    <>
      <div className="mx-auto mt-8 w-full max-w-[820px] px-5 sm:px-7 lg:px-8">
        <section className="rounded-3xl border border-sage/30 bg-sage/10 px-5 py-5 sm:px-6" role="status">
          <p className="font-display text-2xl font-normal text-foreground">{title} clôturées</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Les réponses du groupe sont maintenant clôturées car les dates du voyage sont confirmées.
            {hasPreviousAnswer ? " Ta réponse précédente reste visible ci-dessous, en lecture seule." : " Tu n’as rien à compléter pour cette étape."}
          </p>
          {!hasPreviousAnswer ? (
            <Link to="/trips/$tripId" params={{ tripId }} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Retour au voyage
            </Link>
          ) : null}
        </section>
      </div>
      {hasPreviousAnswer ? <fieldset disabled className="min-w-0 border-0 p-0 opacity-90">{children}</fieldset> : null}
    </>
  );
}

function AvailabilityResponseGate({ tripId, children }: { tripId: string; children: ReactNode }) {
  const fetchAvailability = useServerFn(getTripAvailability);
  const { data, isLoading } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvailability({ data: { tripId } }),
  });
  if (isLoading || !data?.trip?.datesLocked) return <>{children}</>;
  return (
    <ClosedResponseState tripId={tripId} title="Disponibilités" hasPreviousAnswer={Boolean(data.mine)}>
      {children}
    </ClosedResponseState>
  );
}

function PreferencesResponseGate({ tripId, children }: { tripId: string; children: ReactNode }) {
  const fetchMine = useServerFn(getMyParticipantPreferences);
  const { data, isLoading } = useQuery({
    queryKey: ["my-preferences", tripId],
    queryFn: () => fetchMine({ data: { tripId } }),
  });
  if (isLoading || !data?.trip?.dates_locked) return <>{children}</>;
  return (
    <ClosedResponseState tripId={tripId} title="Préférences" hasPreviousAnswer={Boolean(data.preferences)}>
      {children}
    </ClosedResponseState>
  );
}

function TripLayout() {
  const { tripId } = Route.useParams();
  const location = useRouterState({ select: (state) => state.location });
  const search = location.search as Record<string, unknown>;
  const showPlanningPage = search.view === "voyage" && search.section === "planning";
  const showProfilePage = search.view === "voyage" && search.section === "profile";
  const showTasksPage = search.view === "voyage" && search.section === "tasks";
  const showTransportPage = search.view === "voyage" && search.section === "transport";
  const showInvitePage = location.pathname.endsWith(`/trips/${tripId}/invite`);
  const showStarGate = location.pathname.endsWith(`/trips/${tripId}/star`);
  const showAvailabilityPage = location.pathname.endsWith(`/trips/${tripId}/availability`);
  const showQuestionnairePage = location.pathname.endsWith(`/trips/${tripId}/questionnaire`);

  const outlet = showStarGate ? (
    <TripStarAccessGate tripId={tripId}>
      <Outlet />
    </TripStarAccessGate>
  ) : showAvailabilityPage ? (
    <AvailabilityResponseGate tripId={tripId}>
      <Outlet />
    </AvailabilityResponseGate>
  ) : showQuestionnairePage ? (
    <PreferencesResponseGate tripId={tripId}>
      <Outlet />
    </PreferencesResponseGate>
  ) : (
    <Outlet />
  );

  return (
    <>
      {showInvitePage ? (
        <TripInvitePage tripId={tripId} />
      ) : showTasksPage ? (
        <TripTasksPage tripId={tripId} />
      ) : showTransportPage ? (
        <TripTransportPage tripId={tripId} />
      ) : showPlanningPage ? (
        <TripPlanningPage tripId={tripId} />
      ) : showProfilePage ? (
        <TripProfilePage tripId={tripId} />
      ) : (
        outlet
      )}
      {showPlanningPage ? <PlanningMapSection tripId={tripId} /> : null}
    </>
  );
}
