import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { maskStaleOrganizationDataForDashboard } from "@/lib/krew/organization-refresh";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { trackProductEventOnce, type ProductAnalyticsProperties } from "@/lib/product-analytics";
import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;

/**
 * Single counter boundary for the trip dashboard.
 * The historical parent still computes a few legacy fallbacks; this entry point
 * deliberately ignores them and reads the centralized response selector from
 * the same React Query cache used by the rest of the trip page.
 */
export function TripHubDashboard(props: Props) {
  const fetchProgress = useServerFn(getParticipantsProgress);
  const { data: centralized } = useQuery({
    queryKey: ["trip-progress", props.tripId],
    queryFn: () => fetchProgress({ data: { tripId: props.tripId } }),
  });

  const preferencesExpected = centralized?.preferencesExpected ?? centralized?.total ?? 0;
  const rawPreferencesAnswered = centralized?.answered ?? 0;
  const availabilityExpected = centralized?.availabilityExpected ?? 0;
  const rawAvailabilityAnswered = centralized?.availabilityAnswered ?? 0;
  const trip = props.trip as any;
  const logistics = (trip?.group_logistics ?? {}) as any;
  const datesLocked = Boolean(trip?.dates_locked);
  const lifecycle = getTripLifecycleState({
    datesLocked,
    startDate: trip?.start_date,
    endDate: trip?.end_date,
  });
  const responsesClosed = datesLocked;
  const completed = lifecycle === "completed";

  // Once dates are locked, the response phase is closed. A participant who joins
  // later must not make the dashboard look incomplete or receive impossible CTAs.
  const preferencesAnswered = responsesClosed ? preferencesExpected : rawPreferencesAnswered;
  const availabilityAnswered = responsesClosed ? availabilityExpected : rawAvailabilityAnswered;

  const tripForDashboard = maskStaleOrganizationDataForDashboard({
    ...props.trip,
    participants_count: preferencesExpected,
  });

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
      group_size: preferencesExpected,
      expected_responses: preferencesExpected,
      received_responses: rawPreferencesAnswered,
      dates_locked: datesLocked,
      destination_selected: Boolean(props.destinationSelected),
    };
    const once = (event: Parameters<typeof trackProductEventOnce>[0], stateKey: string) =>
      trackProductEventOnce(event, `${props.tripId}:${stateKey}`, common);

    if (role === "organizer") once("trip_created", "created");
    if (role !== "organizer" && viewerId) once("participant_joined", `joined:${viewerId}`);
    if (props.myAvailabilityDone) once("availability_submitted", `availability:${viewerId ?? "viewer"}`);
    if (props.myPreferencesDone) once("preferences_submitted", `preferences:${viewerId ?? "viewer"}`);
    if (datesLocked) once("dates_locked", "dates-locked");
    if (props.profileValidated) once("trip_profile_validated", "profile-validated");
    if (props.hasRecommendations) once("destination_proposals_generated", "destination-proposals");
    if (props.destinationSelected) once("destination_selected", "destination-selected");
    if (logistics.selectedHotelId) once("accommodation_selected", `hotel:${logistics.selectedHotelId}`);
    if (viewerId && (logistics.transportPicks ?? []).some((pick: any) => pick?.userId === viewerId)) {
      once("transport_selected", `transport:${viewerId}`);
    }
    if (trip?.group_itinerary?.days?.length) once("planning_generated", "planning-generated");
    if (lifecycle === "live") once("trip_started", "started");
    if (lifecycle === "completed") once("trip_completed", "completed");
  }, [
    datesLocked,
    lifecycle,
    logistics.selectedHotelId,
    logistics.transportPicks,
    preferencesExpected,
    props.destinationSelected,
    props.hasRecommendations,
    props.myAvailabilityDone,
    props.myPreferencesDone,
    props.profileValidated,
    props.tripId,
    props.viewerUserId,
    rawPreferencesAnswered,
    trip,
  ]);

  return (
    <div data-trip-lifecycle={lifecycle}>
      {completed ? (
        <section className="mb-5 rounded-3xl border border-sage/30 bg-sage/10 px-5 py-5 sm:px-6" aria-label="Voyage terminé">
          <p className="font-display text-2xl font-normal text-foreground">Voyage terminé</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Le séjour est terminé. Les choix et l’organisation restent accessibles ci-dessous pour consultation.
          </p>
        </section>
      ) : null}
      <div className={completed ? "[&>div>header+*]:hidden" : undefined}>
        <TripHubDashboardLegacy
          {...props}
          // A completed trip is a restitution state. Preserve the viewer's real
          // role and historical selections, while hiding only the legacy action
          // panel that otherwise continues to propose preparation work.
          isOwner={props.isOwner}
          myAvailabilityDone={responsesClosed || completed ? true : props.myAvailabilityDone}
          myPreferencesDone={responsesClosed || completed ? true : props.myPreferencesDone}
          participantsCount={preferencesExpected}
          progressAnswered={preferencesAnswered}
          progressTotal={preferencesExpected}
          availabilityAnswered={availabilityAnswered}
          availabilityExpected={availabilityExpected}
          destinationSelected={props.destinationSelected}
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
    </div>
  );
}
