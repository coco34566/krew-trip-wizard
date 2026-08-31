import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { supabase } from "@/integrations/supabase/client";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
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
 * This prevents the historical journey parent from reintroducing estimated
 * participant capacity or a separate availability denominator.
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
          .select("dates_locked, group_logistics, owner_id, co_organizer_id")
          .eq("id", props.tripId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (tripResult.error) throw tripResult.error;

      const userId = userResult.data.user?.id ?? null;
      const trip = tripResult.data;
      return {
        progress,
        datesLocked: Boolean(trip?.dates_locked),
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

  const steps = props.steps.map((step): TimelineStep => {
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
      const complete = expected > 0 && answered >= expected;
      return {
        ...step,
        subtitle: `${answered}/${expected} réponses`,
        status: complete ? "done" : pendingStatus(step),
      };
    }

    return step;
  });

  return (
    <div className="space-y-5">
      <OrganizationRefreshNotice
        logistics={responseQuery.data?.logistics}
        canManage={responseQuery.data?.canManage ?? false}
      />
      <KrewJourneyTimelineLegacy {...props} steps={steps} />
    </div>
  );
}
