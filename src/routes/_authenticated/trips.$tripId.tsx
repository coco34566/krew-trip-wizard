import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import {
  KrewJourneyAfterHeaderProvider,
  KrewJourneyPageHeader,
} from "@/components/krew/KrewJourneyPageHeader";
import {
  KrewJourneyStatusOverrideProvider,
  KrewJourneyStatusPanel,
} from "@/components/krew/KrewJourneyStatusPanel";
import { PlanningMapSection } from "@/components/krew/PlanningMapSection";
import { TripAccommodationPage } from "@/components/krew/TripAccommodationPage";
import { TripDatesPage } from "@/components/krew/TripDatesPage";
import { TripDestinationPage } from "@/components/krew/TripDestinationPage";
import { TripInvitePage } from "@/components/krew/TripInvitePage";
import { TripPackingPage } from "@/components/krew/TripPackingPage";
import { TripPlanningPage } from "@/components/krew/TripPlanningPage";
import { TripProfilePage } from "@/components/krew/TripProfilePage";
import { TripStarAccessGate } from "@/components/krew/TripStarAccessGate";
import { TripTasksPage } from "@/components/krew/TripTasksPage";
import { TripTransportPage } from "@/components/krew/TripTransportPage";
import { getTripAvailability } from "@/lib/availability.functions";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { getMyParticipantPreferences } from "@/lib/participant-preferences.functions";
import { getTripDetail } from "@/lib/trips.functions";

/**
 * Layout parent du voyage : obligatoire pour que les routes enfants
 * (availability, questionnaire, invite, star, recap) s'affichent via <Outlet />.
 */
export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  component: TripLayout,
});

function ResponseGateLoading({ maxWidthClassName = "max-w-5xl" }: { maxWidthClassName?: string }) {
  return (
    <KrewJourneyLoadingState
      maxWidthClassName={maxWidthClassName}
      message="Vérification de l’étape…"
    />
  );
}

function ResponseGateError({
  tripId,
  onRetry,
  isFetching,
  maxWidthClassName = "max-w-5xl",
}: {
  tripId: string;
  onRetry: () => void;
  isFetching: boolean;
  maxWidthClassName?: string;
}) {
  return (
    <KrewJourneyErrorState
      tripId={tripId}
      maxWidthClassName={maxWidthClassName}
      title="Impossible de vérifier cette étape"
      description="Les informations nécessaires ne sont pas disponibles pour le moment."
      retrying={isFetching}
      onRetry={onRetry}
    />
  );
}

function ClosedResponseState({
  tripId,
  tripName,
  title,
  otterSrc,
  intro,
  hasPreviousAnswer,
  answeredStatusOverride,
  maxWidthClassName = "max-w-5xl",
  children,
}: {
  tripId: string;
  tripName: string;
  title: string;
  otterSrc: string;
  intro: string;
  hasPreviousAnswer: boolean;
  answeredStatusOverride?: { title: string; content: ReactNode };
  maxWidthClassName?: string;
  children: ReactNode;
}) {
  if (hasPreviousAnswer) {
    const readOnlyContent = (
      <fieldset disabled className="min-w-0 border-0 p-0 opacity-90">
        {children}
      </fieldset>
    );

    return answeredStatusOverride ? (
      <KrewJourneyStatusOverrideProvider override={answeredStatusOverride}>
        {readOnlyContent}
      </KrewJourneyStatusOverrideProvider>
    ) : (
      readOnlyContent
    );
  }

  return (
    <main className={`mx-auto w-full ${maxWidthClassName} space-y-8 px-5 py-8 sm:px-7 sm:py-10 lg:px-8`}>
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <KrewJourneyPageHeader tripName={tripName} title={title} otterSrc={otterSrc}>
        <p>{intro}</p>
      </KrewJourneyPageHeader>

      <KrewJourneyStatusPanel title={`${title} clôturées`} icon="check" tone="complete">
        <p>Les réponses du groupe sont maintenant clôturées car les dates du voyage sont confirmées. Tu n’as rien à compléter pour cette étape.</p>
      </KrewJourneyStatusPanel>
    </main>
  );
}

function AvailabilityResponseGate({ tripId, children }: { tripId: string; children: ReactNode }) {
  const fetchAvailability = useServerFn(getTripAvailability);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvailability({ data: { tripId } }),
  });
  if (isLoading) return <ResponseGateLoading maxWidthClassName="max-w-[820px]" />;
  if (isError) {
    return (
      <ResponseGateError
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        onRetry={() => void refetch()}
        isFetching={isFetching}
      />
    );
  }
  if (!data?.trip?.datesLocked) return <>{children}</>;
  return (
    <ClosedResponseState
      tripId={tripId}
      tripName={data.trip.name ?? "Voyage"}
      title="Disponibilités"
      otterSrc="/brand/otter-states/availability.png"
      intro="Les dates du voyage sont confirmées. Les réponses de disponibilité sont maintenant en lecture seule."
      maxWidthClassName="max-w-[820px]"
      hasPreviousAnswer={Boolean(data.mine)}
    >
      {children}
    </ClosedResponseState>
  );
}

function PreferencesResponseGate({ tripId, children }: { tripId: string; children: ReactNode }) {
  const fetchMine = useServerFn(getMyParticipantPreferences);
  const fetchDetail = useServerFn(getTripDetail);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["my-preferences-gate", tripId],
    queryFn: async () => {
      const [mine, detail] = await Promise.all([
        fetchMine({ data: { tripId } }),
        fetchDetail({ data: { tripId } }),
      ]);
      return {
        preferences: mine.preferences,
        tripName: (mine.trip as any)?.name ?? (detail.trip as any)?.name ?? "Voyage",
        datesLocked: Boolean((detail.trip as any)?.dates_locked),
      };
    },
  });
  if (isLoading) return <ResponseGateLoading maxWidthClassName="max-w-[820px]" />;
  if (isError) {
    return (
      <ResponseGateError
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        onRetry={() => void refetch()}
        isFetching={isFetching}
      />
    );
  }
  if (!data?.datesLocked) return <>{children}</>;
  return (
    <ClosedResponseState
      tripId={tripId}
      tripName={data.tripName}
      title="Préférences"
      otterSrc="/brand/otter-states/preferences.png"
      intro="Les dates du voyage sont confirmées. Les préférences du groupe sont maintenant en lecture seule."
      maxWidthClassName="max-w-[820px]"
      hasPreviousAnswer={Boolean(data.preferences)}
      answeredStatusOverride={{
        title: "Préférences clôturées",
        content: (
          <p>Ta réponse précédente reste visible ci-dessous en lecture seule. Les dates étant confirmées, cette étape n’est plus modifiable.</p>
        ),
      }}
    >
      {children}
    </ClosedResponseState>
  );
}

function CompletedPreparationGate({
  tripId,
  children,
  externalStatus = false,
}: {
  tripId: string;
  children: ReactNode;
  externalStatus?: boolean;
}) {
  const fetchDetail = useServerFn(getTripDetail);
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
    retry: false,
  });

  if (isLoading) return <ResponseGateLoading />;
  if (isError) return <ResponseGateError tripId={tripId} onRetry={() => void refetch()} isFetching={isFetching} />;

  const trip = data?.trip as any;
  const completed = trip
    ? getTripLifecycleState({
        datesLocked: Boolean(trip.dates_locked),
        startDate: trip.start_date,
        endDate: trip.end_date,
      }) === "completed"
    : false;

  if (!completed) return <>{children}</>;

  const completedStatus = (
    <KrewJourneyStatusPanel
      title="Voyage terminé · consultation"
      icon="check"
      tone="complete"
      className="krew-journey-lifecycle-status"
    >
      <p>Cette partie reste disponible comme historique du voyage. Les actions de préparation et de modification sont désactivées.</p>
    </KrewJourneyStatusPanel>
  );

  if (externalStatus) {
    return (
      <>
        <div className="mx-auto mt-8 w-full max-w-5xl px-5 sm:px-7 lg:px-8">
          {completedStatus}
        </div>
        <div inert className="opacity-90">
          {children}
        </div>
      </>
    );
  }

  return (
    <KrewJourneyAfterHeaderProvider afterHeader={completedStatus}>
      <fieldset
        disabled
        className="min-w-0 border-0 p-0 [&_[data-krew-journey-status]:not(.krew-journey-lifecycle-status)]:hidden"
      >
        {children}
      </fieldset>
    </KrewJourneyAfterHeaderProvider>
  );
}

function parseHrefSearch(href: string) {
  const questionMarkIndex = href.indexOf("?");
  if (questionMarkIndex === -1) return {} as Record<string, string>;
  const hashIndex = href.indexOf("#", questionMarkIndex);
  const queryString = href.slice(questionMarkIndex + 1, hashIndex === -1 ? undefined : hashIndex);
  return Object.fromEntries(new URLSearchParams(queryString));
}

function TripLayout() {
  const { tripId } = Route.useParams();
  const location = useRouterState({ select: (state) => state.location });
  const locationSearch =
    location.search && typeof location.search === "object"
      ? (location.search as Record<string, unknown>)
      : {};
  const hrefSearch = parseHrefSearch(location.href ?? "");
  const view =
    typeof locationSearch.view === "string"
      ? locationSearch.view
      : hrefSearch.view;
  const section =
    typeof locationSearch.section === "string"
      ? locationSearch.section
      : hrefSearch.section;
  const hrefHasProfileSection = /(?:\?|&)section=profile(?:&|#|$)/.test(location.href ?? "");

  const showPlanningPage = view === "voyage" && section === "planning";
  const showProfilePage = section === "profile" || hrefHasProfileSection;
  const showTasksPage = view === "voyage" && section === "tasks";
  const showTransportPage = view === "voyage" && section === "transport";
  const showInvitePage = location.pathname.endsWith(`/trips/${tripId}/invite`);
  const showStarGate = location.pathname.endsWith(`/trips/${tripId}/star`);
  const showAvailabilityPage = location.pathname.endsWith(`/trips/${tripId}/availability`);
  const showQuestionnairePage = location.pathname.endsWith(`/trips/${tripId}/questionnaire`);
  const showGatedDedicatedPage = ["profile", "dates", "destination", "accommodation", "transport"].some(
    (chapter) => location.pathname.endsWith(`/trips/${tripId}/${chapter}`),
  );

  const legacyPreparationPage =
    view === "voyage" && section === "dates" ? (
      <TripDatesPage tripId={tripId} />
    ) : view === "voyage" && section === "destination" ? (
      <TripDestinationPage tripId={tripId} />
    ) : view === "voyage" && section === "accommodation" ? (
      <TripAccommodationPage tripId={tripId} />
    ) : view === "voyage" && section === "packing" ? (
      <TripPackingPage tripId={tripId} />
    ) : null;

  const gatedLegacyPreparationPage =
    legacyPreparationPage && section !== "packing" ? (
      <CompletedPreparationGate tripId={tripId}>{legacyPreparationPage}</CompletedPreparationGate>
    ) : legacyPreparationPage;

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
  ) : showGatedDedicatedPage ? (
    <CompletedPreparationGate tripId={tripId}>
      <Outlet />
    </CompletedPreparationGate>
  ) : (
    <Outlet />
  );

  return (
    <>
      {showInvitePage ? (
        <CompletedPreparationGate tripId={tripId} externalStatus>
          <TripInvitePage tripId={tripId} />
        </CompletedPreparationGate>
      ) : showTasksPage ? (
        <TripTasksPage tripId={tripId} />
      ) : showTransportPage ? (
        <CompletedPreparationGate tripId={tripId}>
          <TripTransportPage tripId={tripId} />
        </CompletedPreparationGate>
      ) : showPlanningPage ? (
        <TripPlanningPage tripId={tripId} />
      ) : showProfilePage ? (
        <CompletedPreparationGate tripId={tripId}>
          <TripProfilePage tripId={tripId} />
        </CompletedPreparationGate>
      ) : gatedLegacyPreparationPage ? (
        gatedLegacyPreparationPage
      ) : (
        outlet
      )}
      {showPlanningPage ? <PlanningMapSection tripId={tripId} /> : null}
    </>
  );
}
