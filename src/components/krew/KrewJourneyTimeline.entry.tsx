import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { OrganizationRefreshNotice } from "@/components/krew/OrganizationRefreshNotice";
import { supabase } from "@/integrations/supabase/client";
import { getParticipantsProgress } from "@/lib/participant-preferences.functions";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import "@/styles/krew-mobile-review.css";
import {
  KrewJourneyTimeline as KrewJourneyTimelineLegacy,
  type TimelineStep,
} from "./KrewJourneyTimeline";

type Props = ComponentProps<typeof KrewJourneyTimelineLegacy>;

function pendingStatus(step: TimelineStep) {
  return step.status === "next_action" ? ("next_action" as const) : ("available" as const);
}

function enableJourneyMotion(root: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const title = Array.from(root.querySelectorAll<HTMLHeadingElement>("h1")).find((heading) =>
    heading.textContent?.trim().startsWith("Parcours de "),
  );
  const header = title?.closest("header");
  const heroMark = title?.parentElement?.querySelector<HTMLElement>("svg") ?? null;
  const chapters = Array.from(root.querySelectorAll<HTMLElement>("ol > li"));

  if (heroMark) {
    heroMark.classList.add("krew-journey-draw-mark");
    heroMark.dataset.revealed = "true";
  }

  chapters.forEach((chapter) => {
    chapter.classList.add("krew-journey-reveal");
    chapter.dataset.revealed = reduced ? "true" : "false";
    chapter
      .querySelectorAll<HTMLElement>("svg")
      .forEach((icon) => icon.classList.add("krew-journey-icon-draw"));
  });

  if (header) header.dataset.krewJourneyHero = "true";

  if (reduced || chapters.length === 0) {
    return () => {
      if (header) delete header.dataset.krewJourneyHero;
      if (heroMark) {
        heroMark.classList.remove("krew-journey-draw-mark");
        delete heroMark.dataset.revealed;
      }
      chapters.forEach((chapter) => {
        chapter.classList.remove("krew-journey-reveal");
        delete chapter.dataset.revealed;
        chapter
          .querySelectorAll<HTMLElement>("svg")
          .forEach((icon) => icon.classList.remove("krew-journey-icon-draw"));
      });
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        (entry.target as HTMLElement).dataset.revealed = entry.isIntersecting ? "true" : "false";
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  chapters.forEach((chapter) => observer.observe(chapter));

  return () => {
    observer.disconnect();
    if (header) delete header.dataset.krewJourneyHero;
    if (heroMark) {
      heroMark.classList.remove("krew-journey-draw-mark");
      delete heroMark.dataset.revealed;
    }
    chapters.forEach((chapter) => {
      chapter.classList.remove("krew-journey-reveal");
      delete chapter.dataset.revealed;
      chapter
        .querySelectorAll<HTMLElement>("svg")
        .forEach((icon) => icon.classList.remove("krew-journey-icon-draw"));
    });
  };
}

/**
 * Recomputes the two questionnaire steps from the shared response selector.
 * Once dates are locked, the response phase is closed for both steps: a late
 * participant must never reopen an earlier journey step or make it look pending.
 */
export function KrewJourneyTimeline(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cleanup = () => {};
    const frame = window.requestAnimationFrame(() => {
      cleanup = enableJourneyMotion(root);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [props.tripId, progressReady, steps.length]);

  return (
    <TripLifecycleProvider lifecycle={responseQuery.data?.lifecycle ?? "future"}>
      <div
        ref={rootRef}
        className="space-y-5"
        data-response-progress={progressReady ? "ready" : "loading"}
        data-krew-journey-root="true"
      >
        <OrganizationRefreshNotice
          logistics={responseQuery.data?.logistics}
          canManage={responseQuery.data?.canManage ?? false}
        />
        <KrewJourneyTimelineLegacy {...props} steps={steps} />
      </div>
    </TripLifecycleProvider>
  );
}
