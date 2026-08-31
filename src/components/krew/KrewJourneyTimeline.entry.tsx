import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { supabase } from "@/integrations/supabase/client";
import { isCompletedTripView } from "@/lib/krew/completed-trip-view";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import {
  KrewJourneyTimeline as KrewJourneyTimelineLegacy,
  type TimelineStep,
} from "./KrewJourneyTimeline";

type Props = ComponentProps<typeof KrewJourneyTimelineLegacy>;

function pendingStatus(step: TimelineStep) {
  return step.status === "next_action" ? ("next_action" as const) : ("available" as const);
}

function parseStepHref(href: string) {
  const [path, queryString] = href.split("?");
  if (!queryString) return { to: path, search: undefined as Record<string, string> | undefined };
  const search: Record<string, string> = {};
  for (const pair of queryString.split("&")) {
    const [key, value] = pair.split("=");
    if (key) search[key] = decodeURIComponent(value || "");
  }
  return { to: path, search };
}

function CompletedJourney({ props }: { props: Props }) {
  return (
    <div className="mx-auto w-full max-w-[940px] px-1 py-1 font-sans">
      <header className="relative mb-7 sm:mb-9">
        <div className="relative inline-block max-w-full pb-2 pr-2">
          <h1 className="font-display text-[34px] font-normal leading-[.96] tracking-[-0.02em] text-foreground sm:text-[44px]">Parcours de {props.tripName}</h1>
          <KrewMark type="underline-wave" tone="sage" size="lg" className="pointer-events-none absolute -bottom-2 left-1 w-[170px] opacity-75 sm:w-[210px]" />
        </div>
        <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">Le parcours reste consultable comme historique du voyage.</p>
      </header>

      <ol className="divide-y divide-border/45 border-y border-border/45">
        {props.steps.map((step) => {
          const directHref = step.id === "preferences"
            ? `/trips/${props.tripId}/questionnaire`
            : step.id === "profile"
              ? `/trips/${props.tripId}?view=voyage&section=profile`
              : step.id === "memories"
                ? `/trips/${props.tripId}/memories`
                : null;
          const href = directHref || step.href || null;
          const content = (
            <div className="flex items-start gap-3 py-4 sm:py-5">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background"><KrewIcon name={step.iconName} tone="plum" size="sm" className="size-4.5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[20px] font-normal text-foreground sm:text-[22px]">{step.title}</h3>
                {step.subtitle ? <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.subtitle}</p> : null}
              </div>
              {href ? <span className="shrink-0 pt-2 text-xs font-semibold text-primary">Consulter →</span> : null}
            </div>
          );

          if (!href) return <li key={step.id}>{content}</li>;
          const parsed = parseStepHref(href);
          return <li key={step.id}><Link to={parsed.to as any} search={parsed.search as any} className="block hover:bg-muted/30">{content}</Link></li>;
        })}
      </ol>
    </div>
  );
}

/**
 * Recomputes questionnaire steps from the shared response selector.
 * Once dates are locked, a late participant never reopens an earlier step.
 * Completed trips bypass preparation statuses entirely and use a neutral history view.
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
          .select("dates_locked,start_date,end_date,group_logistics,owner_id,co_organizer_id")
          .eq("id", props.tripId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (tripResult.error) throw tripResult.error;

      const userId = userResult.data.user?.id ?? null;
      const trip = tripResult.data as any;
      return {
        progress,
        datesLocked: Boolean(trip?.dates_locked),
        completedTrip: isCompletedTripView(trip),
        logistics: trip?.group_logistics ?? null,
        canManage: Boolean(userId && trip && (trip.owner_id === userId || trip.co_organizer_id === userId)),
      };
    },
    retry: false,
  });

  if (responseQuery.data?.completedTrip) {
    return <CompletedJourney props={props} />;
  }

  const progress = responseQuery.data?.progress;
  const datesLocked = responseQuery.data?.datesLocked ?? false;
  const steps = props.steps.map((step): TimelineStep => {
    if (step.id === "availability" && progress) {
      const expected = progress.availabilityExpected ?? 0;
      const answered = progress.availabilityAnswered ?? 0;
      const complete = datesLocked || (expected > 0 && answered >= expected);
      return { ...step, subtitle: datesLocked ? "Dates confirmées" : `${answered}/${expected} indiquées`, status: complete ? "done" : pendingStatus(step) };
    }
    if (step.id === "preferences" && progress) {
      const expected = progress.preferencesExpected ?? progress.total ?? 0;
      const answered = progress.answered ?? 0;
      const complete = datesLocked || (expected > 0 && answered >= expected);
      return { ...step, subtitle: datesLocked ? "Réponses clôturées" : `${answered}/${expected} réponses`, status: complete ? "done" : pendingStatus(step) };
    }
    return step;
  });

  return (
    <div className="space-y-5">
      <OrganizationRefreshNotice logistics={responseQuery.data?.logistics} canManage={responseQuery.data?.canManage ?? false} />
      <KrewJourneyTimelineLegacy {...props} steps={steps} />
    </div>
  );
}
