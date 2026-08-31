import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { maskStaleOrganizationDataForDashboard } from "@/lib/krew/organization-refresh";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { trackProductEventOnce } from "@/lib/product-analytics";
import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;

/**
 * Single counter boundary for the trip dashboard.
 * The historical parent still computes a few legacy fallbacks; this entry point
 * deliberately ignores them and reads the centralized response selector from
 * the same React Query cache used by the rest of the trip page.
 *
 * It also masks stale organization data only for dashboard progress/readiness:
 * the old content remains persisted and visible in its own sections, while the
 * dashboard cannot incorrectly present it as current after a structural change.
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
  const datesLocked = Boolean((props.trip as any)?.dates_locked);
  const lifecycle = getTripLifecycleState({
    datesLocked,
    startDate: (props.trip as any)?.start_date,
    endDate: (props.trip as any)?.end_date,
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
    if (lifecycle === "live") {
      trackProductEventOnce("trip_started", props.tripId, {
        trip_id: props.tripId,
        trip_type: (props.trip as any)?.event_type,
        group_size: preferencesExpected,
        dates_locked: datesLocked,
        destination_selected: Boolean(props.destinationSelected),
      });
    }
    if (lifecycle === "completed") {
      trackProductEventOnce("trip_completed", props.tripId, {
        trip_id: props.tripId,
        trip_type: (props.trip as any)?.event_type,
        group_size: preferencesExpected,
        dates_locked: datesLocked,
        destination_selected: Boolean(props.destinationSelected),
      });
    }
  }, [datesLocked, lifecycle, preferencesExpected, props.destinationSelected, props.trip, props.tripId]);

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
      <TripHubDashboardLegacy
        {...props}
        // A completed trip is a restitution state: suppress the legacy preparation
        // action stack without hiding the trip data rendered by the dashboard.
        isOwner={completed ? false : props.isOwner}
        myAvailabilityDone={responsesClosed || completed ? true : props.myAvailabilityDone}
        myPreferencesDone={responsesClosed || completed ? true : props.myPreferencesDone}
        participantsCount={preferencesExpected}
        progressAnswered={preferencesAnswered}
        progressTotal={preferencesExpected}
        availabilityAnswered={availabilityAnswered}
        availabilityExpected={availabilityExpected}
        destinationSelected={completed ? false : props.destinationSelected}
        trip={tripForDashboard}
      >
        <OrganizationRefreshNotice
          logistics={(props.trip as any).group_logistics}
          destinationName={props.destinationName}
          canManage={!completed && props.isOwner}
        />
        {props.children}
      </TripHubDashboardLegacy>
    </div>
  );
}
