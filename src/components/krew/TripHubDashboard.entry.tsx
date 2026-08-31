import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { KrewIcon } from "@/components/krew/visual-language";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import {
  getOrganizationRefreshState,
  maskStaleOrganizationDataForDashboard,
} from "@/lib/krew/organization-refresh";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import { trackProductEventOnce, type ProductAnalyticsProperties } from "@/lib/product-analytics";
import { formatEuro } from "@/lib/krew/constants";
import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;

function formatHistoricalDates(startDate?: string | null, endDate?: string | null) {
  if (!startDate) return null;
  const format = (value: string) =>
    new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return endDate ? `${format(startDate)} → ${format(endDate)}` : format(startDate);
}

function CompletedTripDashboard(props: Props & { participantsCount: number; trip: any }) {
  const dates = formatHistoricalDates(props.trip.start_date, props.trip.end_date);
  const confirmedCost = props.totalReserved ?? props.liveBudgetTotal ?? null;
  return (
    <div className="space-y-6 sm:space-y-8" data-trip-lifecycle="completed">
      <section className="rounded-3xl border border-sage/30 bg-sage/10 px-5 py-5 sm:px-6" aria-label="Voyage terminé">
        <p className="font-display text-2xl font-normal text-foreground">Voyage terminé</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Le séjour est terminé. Les informations conservées restent accessibles comme historique du voyage.
        </p>
      </section>

      <header className="space-y-4 border-b border-border/50 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{props.trip.name}</p>
          <h1 className="mt-1 font-display text-[38px] font-normal leading-tight text-foreground sm:text-[48px]">
            {props.destinationName || "Voyage terminé"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/85">
          {dates ? (
            <span className="inline-flex items-center gap-1.5">
              <KrewIcon name="calendar" tone="plum" size="sm" className="size-4" />
              {dates}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <KrewIcon name="group" tone="plum" size="sm" className="size-4" />
            {props.participantsCount} participant{props.participantsCount > 1 ? "s" : ""}
          </span>
          {confirmedCost != null && confirmedCost > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <KrewIcon name="budget" tone="plum" size="sm" className="size-4" />
              {props.totalReserved != null ? `Réservé ${formatEuro(props.totalReserved)}` : `~${formatEuro(confirmedCost)} / pers.`}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Les anciens indicateurs de préparation ne sont plus affichés : seules les informations historiques utiles sont conservées.
        </p>
      </header>

      {props.children}
    </div>
  );
}

export function TripHubDashboard(props: Props) {
  const fetchProgress = useServerFn(getParticipantsProgress);
  const { data: centralized, isLoading: progressLoading } = useQuery({
    queryKey: ["trip-progress", props.tripId],
    queryFn: () => fetchProgress({ data: { tripId: props.tripId } }),
  });

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

  const preferencesExpected = centralized?.preferencesExpected ?? centralized?.total ?? 0;
  const rawPreferencesAnswered = centralized?.answered ?? 0;
  const availabilityExpected = centralized?.availabilityExpected ?? 0;
  const rawAvailabilityAnswered = centralized?.availabilityAnswered ?? 0;
  const responsesClosed = datesLocked;
  const preferencesAnswered = responsesClosed ? preferencesExpected : rawPreferencesAnswered;
  const availabilityAnswered = responsesClosed ? availabilityExpected : rawAvailabilityAnswered;

  const tripForDashboard = maskStaleOrganizationDataForDashboard({
    ...props.trip,
    participants_count: preferencesExpected,
  });

  useEffect(() => {
    if (!centralized) return;
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
    if (completed) once("trip_completed", "completed");
  }, [
    accommodationStale,
    centralized,
    completed,
    datesLocked,
    itineraryStale,
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
    transportStale,
    trip,
  ]);

  if (progressLoading || !centralized) {
    return (
      <div className="space-y-4" aria-busy="true" data-trip-lifecycle={lifecycle}>
        <section className="rounded-3xl border border-border/60 bg-card px-5 py-5 sm:px-6" role="status">
          <p className="font-display text-xl font-normal text-foreground">Chargement du voyage…</p>
          <p className="mt-1 text-sm text-muted-foreground">Les indicateurs du groupe se mettent à jour.</p>
        </section>
      </div>
    );
  }

  if (completed) {
    return (
      <CompletedTripDashboard
        {...props}
        participantsCount={preferencesExpected}
        trip={tripForDashboard}
        totalReserved={organizationStale ? null : props.totalReserved}
        totalEstimated={organizationStale ? null : props.totalEstimated}
        liveBudgetTotal={organizationStale ? null : props.liveBudgetTotal}
      >
        <OrganizationRefreshNotice
          logistics={trip.group_logistics}
          destinationName={props.destinationName}
          canManage={false}
        />
        {props.children}
      </CompletedTripDashboard>
    );
  }

  return (
    <div data-trip-lifecycle={lifecycle}>
      <TripHubDashboardLegacy
        {...props}
        isOwner={props.isOwner}
        myAvailabilityDone={responsesClosed ? true : props.myAvailabilityDone}
        myPreferencesDone={responsesClosed ? true : props.myPreferencesDone}
        participantsCount={preferencesExpected}
        progressAnswered={preferencesAnswered}
        progressTotal={preferencesExpected}
        availabilityAnswered={availabilityAnswered}
        availabilityExpected={availabilityExpected}
        totalReserved={organizationStale ? null : props.totalReserved}
        totalEstimated={organizationStale ? null : props.totalEstimated}
        liveBudgetTotal={organizationStale ? null : props.liveBudgetTotal}
        tripEndDatePassed={false}
        trip={tripForDashboard}
      >
        <OrganizationRefreshNotice
          logistics={trip.group_logistics}
          destinationName={props.destinationName}
          canManage={props.isOwner}
        />
        {props.children}
      </TripHubDashboardLegacy>
    </div>
  );
}
