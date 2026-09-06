import type { ComponentProps, MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
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
import "@/styles/krew-product-motion-refinement.css";
import "@/styles/krew-summary-hierarchy.css";
import { TripHubDashboard as TripHubDashboardLegacy } from "./TripHubDashboard";

type Props = ComponentProps<typeof TripHubDashboardLegacy>;
type SummaryStage = "formation" | "choices" | "destination" | "organized" | "live" | "completed";

const DEDICATED_JOURNEY_ROUTES: Partial<Record<string, string>> = {
  profile: "profile",
  dates: "dates",
  destination: "destination",
  accommodation: "accommodation",
  packing: "packing",
};

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

function enableDashboardMotion(root: HTMLElement, summaryStage: SummaryStage) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scope = root.parentElement ?? root;
  scope.dataset.krewDashboardMotion = "true";
  scope.dataset.krewSummaryStage = summaryStage;

  const nodes = Array.from(
    scope.querySelectorAll<HTMLElement>(
      "header, [data-krew-dashboard-stage-note=\"true\"], section[id]",
    ),
  );
  const animatedIcons: HTMLElement[] = [];

  nodes.forEach((node) => {
    node.classList.add("krew-reveal");
    node.dataset.revealed = reduced ? "true" : "false";

    const heading = node.querySelector<HTMLHeadingElement>("h2");
    const headingGroup = heading?.parentElement ?? null;
    const candidate = headingGroup?.querySelector<HTMLElement>('svg[viewBox="0 0 24 24"]') ?? null;
    if (candidate) {
      candidate.classList.add("krew-structure-icon-draw");
      animatedIcons.push(candidate);
    }
  });

  const cleanup = () => {
    delete scope.dataset.krewDashboardMotion;
    delete scope.dataset.krewSummaryStage;
    nodes.forEach((node) => {
      node.classList.remove("krew-reveal");
      delete node.dataset.revealed;
    });
    animatedIcons.forEach((icon) => icon.classList.remove("krew-structure-icon-draw"));
  };

  if (reduced || nodes.length === 0) return cleanup;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.revealed = "true";
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
  );

  nodes.forEach((node) => observer.observe(node));

  return () => {
    observer.disconnect();
    cleanup();
  };
}

export function TripHubDashboard(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
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
  const hasCurrentItinerary = !itineraryStale && Boolean(trip?.group_itinerary?.days?.length);
  const summaryStage: SummaryStage = completed
    ? "completed"
    : lifecycle === "live"
      ? "live"
      : props.destinationSelected
        ? hasCurrentItinerary
          ? "organized"
          : "destination"
        : datesLocked || props.profileReady || props.profileValidated
          ? "choices"
          : "formation";

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
    if (!accommodationStale && logistics.selectedHotelId) once("accommodation_selected", `hotel:${logistics.selectedHotelId}`);
    if (!transportStale && viewerId && (logistics.transportPicks ?? []).some((pick: any) => pick?.userId === viewerId && !pick?.stale)) {
      once("transport_selected", `transport:${viewerId}`);
    }
    if (!itineraryStale && trip?.group_itinerary?.days?.length) once("planning_generated", "planning-generated");
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cleanup = () => {};
    const frame = window.requestAnimationFrame(() => {
      cleanup = enableDashboardMotion(root, summaryStage);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [props.tripId, responseReady, summaryStage]);

  const suppressPreparationChrome = completed || !responseReady;

  const handleDashboardClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.pathname !== `/trips/${props.tripId}`) return;

    const section = url.searchParams.get("section");
    const dedicatedRoute = section ? DEDICATED_JOURNEY_ROUTES[section] : null;
    if (!dedicatedRoute) return;

    event.preventDefault();
    event.stopPropagation();
    window.location.assign(`/trips/${props.tripId}/${dedicatedRoute}`);
  };

  return (
    <TripLifecycleProvider lifecycle={lifecycle}>
      <div
        ref={rootRef}
        data-trip-lifecycle={lifecycle}
        data-response-progress={responseState.state}
        data-krew-summary-stage={summaryStage}
        data-krew-dashboard-root="true"
        onClickCapture={handleDashboardClickCapture}
      >
        {completed ? (
          <div className="mb-5">
            <KrewJourneyStatusPanel title="Voyage terminé" icon="check" tone="complete">
              <p>Le séjour est terminé. Les choix et l’organisation restent accessibles ci-dessous pour consultation.</p>
            </KrewJourneyStatusPanel>
          </div>
        ) : null}
        <div className={suppressPreparationChrome ? "[&>div>header>.mt-4.px-4]:!hidden [&>div>header+div]:!hidden" : undefined}>
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
