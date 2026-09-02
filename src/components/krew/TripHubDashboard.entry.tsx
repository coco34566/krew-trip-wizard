import type { ComponentProps } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
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

function refineDashboardPresentation() {
  if (typeof document === "undefined") return () => {};
  const cleanups: Array<() => void> = [];
  const groupSection = document.getElementById("group-section");

  if (groupSection) {
    const decorativeOtter = Array.from(groupSection.children).find((child) =>
      child instanceof HTMLElement && Boolean(child.querySelector('img[src*="trip-progress.png"]')),
    ) as HTMLElement | undefined;
    if (decorativeOtter) {
      const previousHidden = decorativeOtter.hidden;
      decorativeOtter.hidden = true;
      cleanups.push(() => { decorativeOtter.hidden = previousHidden; });
    }

    const stageTextNode = Array.from(document.querySelectorAll<HTMLElement>("main header *")).find(
      (node) => node.textContent?.trim() === "Le groupe prend forme",
    );
    const heading = Array.from(groupSection.querySelectorAll("h2")).find(
      (node) => node.textContent?.trim() === "Membres du groupe",
    );
    const headingRow = heading?.closest(".flex.flex-col") as HTMLElement | null;

    if (stageTextNode && headingRow) {
      const stageContainer = stageTextNode.parentElement as HTMLElement | null;
      if (stageContainer) {
        const previousHidden = stageContainer.hidden;
        stageContainer.hidden = true;
        cleanups.push(() => { stageContainer.hidden = previousHidden; });
      }
      const clone = stageTextNode.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      const wrapper = document.createElement("div");
      wrapper.dataset.krewGroupStageNote = "true";
      wrapper.className = "shrink-0 self-start sm:self-center";
      wrapper.appendChild(clone);
      headingRow.appendChild(wrapper);
      cleanups.push(() => wrapper.remove());
    }

    const remindButton = Array.from(groupSection.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Relancer le groupe",
    );
    if (remindButton) {
      const previous = remindButton.className;
      remindButton.className = `${previous} justify-start gap-2 pl-0 pr-3`;
      cleanups.push(() => { remindButton.className = previous; });
    }
  }

  const managementFooter = Array.from(document.querySelectorAll<HTMLElement>("main footer")).find((candidate) =>
    candidate.textContent?.includes("Gestion du voyage"),
  );
  const deleteButton = managementFooter
    ? Array.from(managementFooter.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        button.textContent?.includes("Supprimer définitivement"),
      )
    : null;
  const deleteBlock = deleteButton?.parentElement;
  if (deleteBlock) {
    const previous = deleteBlock.className;
    deleteBlock.className = previous
      .replace(/border-t/g, "")
      .replace(/border-destructive\/15/g, "")
      .replace(/pt-4/g, "pt-1");
    cleanups.push(() => { deleteBlock.className = previous; });
  }

  return () => cleanups.reverse().forEach((cleanup) => cleanup());
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

  useEffect(() => setCompletedGroupSectionReadOnly(completed), [completed]);
  useEffect(() => setOrganizerOnlyManagementVisible(isCreator), [isCreator]);
  useEffect(() => refineDashboardPresentation(), [datesLocked, preferencesExpected, props.tripId]);

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
            suppressPreparationChrome
              ? "[&>div>header>.mt-4.px-4]:!hidden [&>div>header+div]:!hidden"
              : undefined
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
      </div>
    </TripLifecycleProvider>
  );
}
