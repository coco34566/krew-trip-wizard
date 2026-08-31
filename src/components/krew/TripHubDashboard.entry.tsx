import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { maskStaleOrganizationDataForDashboard } from "@/lib/krew/organization-refresh";
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
  const preferencesAnswered = centralized?.answered ?? 0;
  const availabilityExpected = centralized?.availabilityExpected ?? 0;
  const availabilityAnswered = centralized?.availabilityAnswered ?? 0;

  const tripForDashboard = maskStaleOrganizationDataForDashboard({
    ...props.trip,
    participants_count: preferencesExpected,
  });

  return (
    <TripHubDashboardLegacy
      {...props}
      participantsCount={preferencesExpected}
      progressAnswered={preferencesAnswered}
      progressTotal={preferencesExpected}
      availabilityAnswered={availabilityAnswered}
      availabilityExpected={availabilityExpected}
      trip={tripForDashboard}
    >
      <OrganizationRefreshNotice
        logistics={(props.trip as any).group_logistics}
        destinationName={props.destinationName}
        canManage={props.isOwner}
      />
      {props.children}
    </TripHubDashboardLegacy>
  );
}
