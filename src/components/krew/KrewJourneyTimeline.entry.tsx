import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { supabase } from "@/integrations/supabase/client";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import {
  KrewJourneyTimeline as KrewJourneyTimelineLegacy,
  type TimelineStep,
} from "./KrewJourneyTimeline";

type Props = ComponentProps<typeof KrewJourneyTimelineLegacy>;

function pendingStatus(step: TimelineStep) {
  return step.status === "next_action" ? ("next_action" as const) : ("available" as const);
}

/**
 * Recomputes the two questionnaire steps from the shared response selector.
 * Once dates are locked, the response phase is closed for both steps: a late
 * participant must never reopen an earlier journey step or make it look pending.
 */
export function KrewJourneyTimeline(props: Props) {
  const fetchProgress = useServerFn(getParticipantsProgress);
  const responseQuery = useQuery({
    queryKey: ["journey-response-progress", props.tripId],
    queryFn: async () => {
      const [progress, tripResult, userResult] = await Promise.all([
        fetchProgress({ data: { tripId: props.tripId } }),
        supabase
          .from("trips")
          .select("dates_locked, start_date, end_date, group_logistics, owner_id, co_organizer_id")
          .eq("id", props.tripId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (tripResult.error) throw tripResult.error;

      const userId = userResult.data.user?.id ?? null;
      const trip = tripResult.data;
      const datesLocked = Boolean(trip?.dates_locked);
      return {
        progress,
        datesLocked,
        lifecycle: getTripLifecycleState({
          datesLocked,
          startDate: trip?.start_date ?? null,
          endDate: trip?.end_date ?? null,
        }),
        logistics: trip?.group_logistics ?? null,
        canManage: Boolean(
          userId && trip && (trip.owner_id === userId || trip.co_organizer_id === userId),
        ),
      };
    },
    retry: false,
  });

  const progress = responseQuery.data?.progress;
  const datesLocked = responseQuery.data?.datesLocked ?? false;
  const progressReady = responseQuery.isSuccess && Boolean(progress);

  const steps = props.steps.map((step): TimelineStep => {
    if ((step.id === "availability" || step.id === "preferences") && !progressReady) {
      return {
        ...step,
        subtitle: "Chargement des réponses…",
      };
    }

    if (step.id === "availability" && progress) {
      const expected = progress.availabilityExpected ?? 0;
      const answered = progress.availabilityAnswered ?? 0;
      const complete = datesLocked || (expected > 0 && answered >= expected);
      return {
        ...step,
        subtitle: datesLocked ? "Dates confirmées" : `${answered}/${expected} indiquées`,
        status: complete ? "done" : pendingStatus(step),
      };
    }

    if (step.id === "preferences" && progress) {
      const expected = progress.preferencesExpected ?? progress.total ?? 0;
      const answered = progress.answered ?? 0;
      const complete = datesLocked || (expected > 0 && answered >= expected);
      return {
        ...step,
        subtitle: datesLocked ? "Réponses clôturées" : `${answered}/${expected} réponses`,
        status: complete ? "done" : pendingStatus(step),
      };
    }

    return step;
  });

  return (
    <TripLifecycleProvider lifecycle={responseQuery.data?.lifecycle ?? "future"}>
      <div className="space-y-5" data-response-progress={progressReady ? "ready" : "loading"}>
        <OrganizationRefreshNotice
          logistics={responseQuery.data?.logistics}
          canManage={responseQuery.data?.canManage ?? false}
        />
        <div className="krew-journey-motion-root">
          <KrewJourneyTimelineLegacy {...props} steps={steps} />
        </div>
      </div>
    </TripLifecycleProvider>
  );
}
