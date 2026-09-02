import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import {
  getOrganizationRefreshState,
  maskStaleOrganizationDataForDashboard,
} from "@/lib/krew/organization-refresh";
import { getDashboardResponseState } from "@/lib/krew/trip-dashboard-response-state";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { trackProductEventOnce, type ProductAnalyticsProperties } from "@/lib/product-analytics";
import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;

function setCompletedGroupSectionReadOnly(completed: boolean) {
  if (typeof document === "undefined") return () => {};
  const section = document.getElementById("group-section");
  if (!section) return () => {};

  const controls = Array.from(section.querySelectorAll<HTMLElement>("button, input, select"));
  const previous = controls.map((control) => ({ control, hidden: control.hidden }));
  for (const control of controls) control.hidden = completed || control.hidden;

  return () => {
    for (const { control, hidden } of previous) control.hidden = hidden;
  };
}

function setOrganizerOnlyManagementVisible(isCreator: boolean) {
  if (typeof document === "undefined") return () => {};
  const footer = Array.from(document.querySelectorAll<HTMLElement>("main footer")).find((candidate) =>
    candidate.textContent?.includes("Gestion du voyage"),
  );
  if (!footer) return () => {};

  const previousHidden = footer.hidden;
  if (!isCreator) footer.hidden = true;
  return () => {
    footer.hidden = previousHidden;
  };
}

export function TripHubDashboard(props: Props) {
  const fetchProgress = useServerFn(getParticipantsProgress);
  const { data: centralized, isSuccess: progressReady } = useQuery({
    queryKey: ["trip-progress", props.tripId],
    queryFn: () => fetchProgress({ data: { tripId: props.tripId } }),
  });

  const centralizedPreferencesExpected = centralized?.preferencesExpected ?? centralized?.total ?? 0;
  const rawPreferencesAnswered = centralized?.answered ?? 0;
  const centralizedAvailabilityExpected = centralized?.availabilityExpected ?? 0;
  const rawAvailabilityAnswered = centralized?.availabilityAnswered ?? 0;
  const trip = props.trip as any;
  const logistics = (trip?.group_logistics ?? {}) as any;
  const organizationRefresh = getOrganizationRefreshState(logistics);
  const accommodationStale = Boolean(organizationRefresh?.items.some((item) => item.section === "accommodation"));
  const transportStale = Boolean(organizationRefresh?.items.some((item) => item.section === "transport"));
  const itineraryStale = Boolean(organizationRefresh?.items.some((item) => item.section === "itinerary"));
  const organizationStale = Boolean(organizationRefresh?.items.length);
  const datesLocked = Boolean(trip?.dates_locked);
  const lifecycle = getTripLifecycleState({
    datesLocked,
    startDate: trip?.start_date,
    endDate: trip?.end_date,
  });
  const completed = lifecycle === "completed";
  const isCreator = Boolean(props.viewerUserId && props.viewerUserId === trip?.owner_id);

  const responseState = getDashboardResponseState({
    progressReady,
    datesLocked,
    preferencesExpected: centralizedPreferencesExpected,
    preferencesAnswered: rawPreferencesAnswered,
    availabilityExpected: centralizedAvailabilityExpected,
    availabilityAnswered: rawAvailabilityAnswered,
  });
  const responseReady = responseState.state === "ready";
  const preferencesExpected = responseReady ? responseState.preferencesExpected : 0;
  const preferencesAnswered = responseReady ? responseState.preferencesAnswered : 0;
  const availabilityExpected = responseReady ? responseState.availabilityExpected : 0;
  const availabilityAnswered = responseReady ? responseState.availabilityAnswered : 0;

  const tripForDashboard = maskStaleOrganizationDataForDashboard({
    ...props.trip,
    participants_count: responseReady ? preferencesExpected : props.participantsCount,
  });

  const hasItinerary = Boolean(tripForDashboard?.group_itinerary?.days?.length);
  const dashboardStageNote = completed
    ? null
    : !datesLocked || !props.profileValidated
      ? "Le groupe prend forme"
      : !props.destinationSelected
        ? "La suite se dessine"
        : !hasItinerary
          ? "La suite se prépare"
          : null;

  useEffect(() => setCompletedGroupSectionReadOnly(completed), [completed]);
  useEffect(() => setOrganizerOnlyManagementVisible(isCreator), [isCreator]);

  useEffect(() => {
    const viewerId = props.viewerUserId ?? null;
    const role: ProductAnalyticsProperties["role"] =
      viewerId && viewerId === trip?.owner_id
        ? "organizer"
        : viewerId && viewerId === trip?.co_organizer_id
          ? "co_organizer"
          : "participant";
    const common: ProductAnalyticsProperties = {
      role,
      trip_id: props.tripId,
      trip_type: trip?.event_type,
      group_size: centralizedPreferencesExpected,
      expected_responses: centralizedPreferencesExpected,
      received_responses: rawPreferencesAnswered,
      dates_locked: datesLocked,
      destination_selected: Boolean(props.destinationSelected),
    };
    const once = (event: Parameters<typeof trackProductEventOnce>[0], stateKey: string) =>
      trackProductEventOnce(event, `${props.tripId}:${stateKey}`, common);

    if (role === "organizer") once("trip_created", "created");
    if (role === "participant" && viewerId) once("participant_joined", `joined:${viewerId}`);
    if (props.myAvailabilityDone) once("availability_submitted", `availability:${viewerId ?? "viewer"}`);
    if (props.myPreferencesDone) once("preferences_submitted", `preferences:${viewerId ?? "viewer"}`);
    if (datesLocked) once("dates_locked", "dates-locked");
    if (props.profileValidated) once("trip_profile_validated", "profile-validated");
    if (props.hasRecommendations) once("destination_proposals_generated", "destination-proposals");
    if (props.destinationSelected) once("destination_selected", "destination-selected");
    if (!accommodationStale && logistics.selectedHotelId) {
      once("accommodation_selected", `hotel:${logistics.selectedHotelId}`);
    }
    if (!transportStale && viewerId && (logistics.transportPicks ?? []).some((pick: any) => pick?.userId === viewerId && !pick?.stale)) {
      once("transport_selected", `transport:${viewerId}`);
    }
    if (!itineraryStale && trip?.group_itinerary?.days?.length) {
      once("planning_generated", "planning-generated");
    }
    if (lifecycle === "live") once("trip_started", "started");
    if (lifecycle === "completed") once("trip_completed", "completed");
  }, [
    accommodationStale,
    centralizedPreferencesExpected,
    datesLocked,
    itineraryStale,
    lifecycle,
    logistics.selectedHotelId,
    logistics.transportPicks,
    props.destinationSelected,
    props.hasRecommendations,
    props.myAvailabilityDone,
    props.myPreferencesDone,
    props.profileValidated,
    props.tripId,
    props.viewerUserId,
    rawPreferencesAnswered,
    transportStale,
    trip,
  ]);

  const suppressPreparationChrome = completed || !responseReady;

  return (
    <TripLifecycleProvider lifecycle={lifecycle}>
      <div data-trip-lifecycle={lifecycle} data-response-progress={responseState.state}>
        {completed ? (
          <section className="mb-5 rounded-3xl border border-sage/30 bg-sage/10 px-5 py-5 sm:px-6" aria-label="Voyage terminé">
            <p className="font-display text-2xl font-normal text-foreground">Voyage terminé</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Le séjour est terminé. Les choix et l’organisation restent accessibles ci-dessous pour consultation.
            </p>
          </section>
        ) : null}
        <div
          className={
            `${suppressPreparationChrome
              ? "[&>div>header>.mt-4.px-4]:!hidden [&>div>header+div]:!hidden "
              : ""}[&_[data-krew-note='post-it'].text-right]:!hidden`
          }
        >
          <TripHubDashboardLegacy
            {...props}
            isOwner={props.isOwner}
            myAvailabilityDone={datesLocked || completed ? true : props.myAvailabilityDone}
            myPreferencesDone={datesLocked || completed ? true : props.myPreferencesDone}
            starDone={completed ? true : props.starDone}
            participantsCount={responseReady ? preferencesExpected : props.participantsCount}
            progressAnswered={responseReady ? preferencesAnswered : 0}
            progressTotal={responseReady ? preferencesExpected : 0}
            availabilityAnswered={responseReady ? availabilityAnswered : 0}
            availabilityExpected={responseReady ? availabilityExpected : 0}
            destinationSelected={completed ? false : props.destinationSelected}
            totalReserved={organizationStale ? null : props.totalReserved}
            totalEstimated={organizationStale ? null : props.totalEstimated}
            liveBudgetTotal={organizationStale ? null : props.liveBudgetTotal}
            tripEndDatePassed={completed}
            trip={tripForDashboard}
          >
            <OrganizationRefreshNotice
              logistics={trip.group_logistics}
              destinationName={props.destinationName}
              canManage={!completed && props.isOwner}
            />
            {props.children}
          </TripHubDashboardLegacy>
        </div>
        {dashboardStageNote ? (
          <div
            data-krew-group-stage-note="true"
            className="pointer-events-none relative z-20 -mb-12 flex justify-end pr-1 translate-y-8 sm:translate-y-9"
          >
            <KrewNote variant="tape" tone="plum" rotation={1} size="sm" className="max-w-[46%] text-right sm:max-w-none">
              {dashboardStageNote}
            </KrewNote>
          </div>
        ) : null}
      </div>
    </TripLifecycleProvider>
  );
}
