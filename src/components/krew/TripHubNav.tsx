import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";
import {
  KrewHighlight,
  KrewIcon,
  KrewMark,
  KrewProgressRing,
  type KrewIconName,
} from "@/components/krew/visual-language";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  star: "/trips/$tripId/star",
  memories: "/trips/$tripId/memories",
};

function getStepKrewIcon(stepId: string): KrewIconName {
  switch (stepId) {
    case "invite": return "invite";
    case "availability": return "availability";
    case "dates": return "calendar";
    case "questionnaire": return "preferences";
    case "profile": return "profile";
    case "destination": return "destination";
    case "hotels": return "accommodation";
    case "transport": return "transport";
    case "organize": return "planning";
    default: return "planning";
  }
}

export function TripHubNav({
  tripId,
  steps,
  availabilityAnswered,
  availabilityExpected,
  progressAnswered,
  progressTotal,
  onInviteClick,
}: {
  tripId: string;
  steps: TripStep[];
  availabilityAnswered?: number;
  availabilityExpected?: number;
  progressAnswered?: number;
  progressTotal?: number;
  onInviteClick?: () => void;
}) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const total = steps.length;

  function stepHref(step: TripStep): string | null {
    const remainsAccessibleWhenSoon = step.id === "questionnaire";
    if (step.status === "soon" && !remainsAccessibleWhenSoon) return null;
    if (step.id === "invite") return `/trips/${tripId}/invite`;
    if (step.id === "dates") return `/trips/${tripId}?view=voyage&section=dates`;
    if (step.id === "profile") return `/trips/${tripId}?view=voyage&section=profile`;
    if (step.id === "destination") return `/trips/${tripId}?view=voyage&section=destination`;
    if (step.id === "hotels") return `/trips/${tripId}?view=voyage&section=accommodation`;
    if (step.id === "transport") return `/trips/${tripId}?view=voyage&section=transport`;
    if (step.id === "organize") return `/trips/${tripId}?view=voyage&section=planning`;
    const routeTo = STEP_ROUTE[step.id];
    return routeTo ? routeTo.replace("$tripId", tripId) : null;
  }

  function renderMetric(stepId: string) {
    if (stepId === "availability" && availabilityExpected != null && availabilityExpected > 0) {
      return <span className="font-mono text-xs text-muted-foreground">{availabilityAnswered ?? 0} / {availabilityExpected}</span>;
    }
    if (stepId === "questionnaire" && progressTotal != null && progressTotal > 0) {
      return <span className="font-mono text-xs text-muted-foreground">{progressAnswered ?? 0} / {progressTotal}</span>;
    }
    return null;
  }

  return (
    <nav aria-label="Parcours du groupe" className="space-y-5 border-y border-border/50 py-5 sm:space-y-6 sm:py-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-xl font-normal text-foreground sm:text-2xl">
          Parcours du <KrewHighlight tone="sage"><span className="text-foreground">groupe</span></KrewHighlight>
        </h3>
        {total > 0 ? <KrewProgressRing value={doneCount} total={total} tone="plum" size="sm" label="Avancement" /> : null}
      </div>

      <ol className="hidden items-start justify-between gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none sm:flex">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);
          const krewIconName = getStepKrewIcon(step.id);

          const StepLabel = (
            <div className="mt-2.5 flex min-h-10 max-w-[105px] flex-col items-center justify-center gap-1 text-center">
              <span className={cn(
                "flex items-center gap-1 font-sans text-xs font-medium leading-tight transition-colors",
                isActive && "text-sm font-semibold text-primary",
                isDone && "font-medium text-foreground",
                !isDone && !isActive && "text-muted-foreground/80",
              )}>
                {step.label}
              </span>
              {metric ? <span className="mt-0.5">{metric}</span> : null}
            </div>
          );

          return (
            <li key={step.id} className="group relative flex min-w-[90px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <span className={cn(
                  "mx-auto z-10 flex shrink-0 items-center justify-center rounded-full border transition-all",
                  isActive ? "size-9 border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20" : "size-7",
                  isDone && "border-sage/60 bg-sage/15 text-sage shadow-2xs",
                  !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                  isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-60",
                )}>
                  {isDone ? (
                    <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                  ) : isSoon ? (
                    <Lock className="size-2.5" />
                  ) : (
                    <KrewIcon name={krewIconName} tone="plum" size="sm" className={cn(isActive ? "size-4.5 text-primary-foreground" : "size-3.5")} />
                  )}
                </span>

                {!isLast ? (
                  <div className="hidden flex-1 items-center justify-center px-0.5 sm:flex" aria-hidden="true">
                    <KrewMark
                      type={isDone ? "connector" : "connector-dotted"}
                      tone={isDone ? "sage" : "ink"}
                      size="sm"
                      className={cn("h-3 w-full max-w-[60px]", !isDone && "opacity-20")}
                    />
                  </div>
                ) : null}
              </div>

              {step.id === "invite" && onInviteClick ? (
                <button type="button" onClick={onInviteClick} className="flex min-h-10 w-full flex-col items-center justify-center border-0 bg-transparent p-0 text-center cursor-pointer">{StepLabel}</button>
              ) : href ? (
                <a href={href} className="flex min-h-10 w-full flex-col items-center justify-center text-center no-underline">{StepLabel}</a>
              ) : (
                <div className="flex min-h-10 w-full flex-col items-center justify-center text-center">{StepLabel}</div>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="relative block space-y-2 sm:hidden">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const metric = renderMetric(step.id);
          const krewIconName = getStepKrewIcon(step.id);

          const StepContent = (
            <div className={cn(
              "flex min-h-11 flex-1 items-center justify-between gap-3 border-b border-border/35 px-1 py-2.5 transition-colors",
              isActive && "border-primary/20 bg-primary/[0.045] px-3 rounded-[14px]",
            )}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border",
                  isActive ? "size-9 border-primary bg-primary text-primary-foreground ring-4 ring-primary/10" : "size-8",
                  isDone && "border-sage/60 bg-sage/15 text-sage",
                  !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                  isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-55",
                )}>
                  {isDone ? (
                    <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                  ) : isSoon ? (
                    <Lock className="size-3" />
                  ) : (
                    <KrewIcon name={krewIconName} tone="plum" size="sm" className={cn("size-4", isActive && "text-primary-foreground")} />
                  )}
                </span>
                <div className="min-w-0">
                  <span className={cn(
                    "block font-sans text-sm font-medium",
                    isActive && "text-base font-semibold text-primary",
                    isDone && "font-semibold text-foreground",
                    !isDone && !isActive && "text-muted-foreground",
                  )}>{step.label}</span>
                  {metric ? <span className="mt-0.5 block">{metric}</span> : null}
                </div>
              </div>
              {isActive || href ? <KrewMark type="arrow-right" tone={isActive ? "plum" : "sage"} size="sm" className="size-4 shrink-0 opacity-75" /> : null}
            </div>
          );

          return (
            <li key={step.id} className="relative">
              {step.id === "invite" && onInviteClick ? (
                <button type="button" onClick={onInviteClick} className="group flex min-h-11 w-full items-center border-0 bg-transparent p-0 text-left cursor-pointer">{StepContent}</button>
              ) : href ? (
                <a href={href} className="group flex min-h-11 w-full items-center no-underline">{StepContent}</a>
              ) : (
                <div className="flex min-h-11 w-full items-center">{StepContent}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ComingSoonGrid() {
  const items: Array<{ label: string; icon: KrewIconName }> = [
    { label: "Planning du séjour", icon: "planning" },
    { label: "Hébergements", icon: "accommodation" },
    { label: "Activités réservées", icon: "booked" },
    { label: "Dépenses communes", icon: "budget" },
    { label: "Répartition des chambres", icon: "accommodation" },
    { label: "Check-list", icon: "tasks" },
    { label: "Documents & billets", icon: "packing" },
    { label: "Sondages", icon: "vote" },
    { label: "Chat de groupe", icon: "message" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ label, icon }) => (
        <div key={label} className="rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-5 text-sm text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <KrewIcon name={icon} tone="sage" size="sm" className="mt-0.5 size-4 shrink-0" />
            <div>
              <span className="font-medium text-foreground/80">{label}</span>
              <span className="mt-1 block text-xs">À venir</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
