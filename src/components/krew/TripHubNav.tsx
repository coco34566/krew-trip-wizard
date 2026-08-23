import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";
import { KrewHighlight, KrewIcon, KrewMark, KrewProgressRing, type KrewIconName } from "@/components/krew/visual-language";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  star: "/trips/$tripId/star",
  memories: "/trips/$tripId/memories",
};

function getStepKrewIcon(stepId: string): KrewIconName {
  switch (stepId) {
    case "invite":
      return "invite";
    case "availability":
      return "availability";
    case "dates":
      return "calendar";
    case "questionnaire":
      return "preferences";
    case "profile":
      return "profile";
    case "destination":
      return "destination";
    case "hotels":
      return "accommodation";
    case "transport":
      return "transport";
    case "organize":
      return "planning";
    default:
      return "planning";
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
    if (step.status === "soon") return null;
    if (step.id === "invite") return `/trips/${tripId}/invite`;
    if (step.id === "dates") return `/trips/${tripId}?view=voyage&section=dates`;
    if (step.id === "profile") return `/trips/${tripId}?view=voyage&section=profile`;
    if (step.id === "destination") return `/trips/${tripId}?view=voyage&section=destination`;
    if (step.id === "hotels") return `/trips/${tripId}?view=voyage&section=accommodation`;
    if (step.id === "transport") return `/trips/${tripId}?view=voyage&section=transport`;
    if (step.id === "organize") return `/trips/${tripId}?view=voyage&section=planning`;
    const routeTo = STEP_ROUTE[step.id];
    if (routeTo) return routeTo.replace("$tripId", tripId);
    return null;
  }

  function renderMetric(stepId: string) {
    if (stepId === "availability" && availabilityExpected != null && availabilityExpected > 0) {
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {availabilityAnswered ?? 0} / {availabilityExpected}
        </span>
      );
    }
    if (stepId === "questionnaire" && progressTotal != null && progressTotal > 0) {
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {progressAnswered ?? 0} / {progressTotal}
        </span>
      );
    }
    return null;
  }

  return (
    <nav aria-label="Parcours du groupe" className="py-4 sm:py-6 space-y-6 sm:rounded-3xl sm:border sm:border-border/60 sm:bg-surface/80 sm:p-6">
      {/* En-tête éditorial du parcours avec dataviz globale */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4 gap-4">
        <h3 className="font-display text-xl sm:text-2xl font-normal text-foreground">
          Parcours du <KrewHighlight tone="sage"><span className="text-foreground">groupe</span></KrewHighlight>
        </h3>
        {total > 0 ? (
          <KrewProgressRing
            value={doneCount}
            total={total}
            tone="plum"
            size="sm"
            label="Avancement"
          />
        ) : null}
      </div>

      {/* Horizontale sur Desktop avec Connecteurs Organiques */}
      <ol className="hidden sm:flex items-start justify-between gap-1 sm:gap-2 pt-1 overflow-x-auto pb-2 scrollbar-none">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);
          const krewIconName = getStepKrewIcon(step.id);

          const StepLabel = (
            <div className="flex flex-col items-center text-center gap-1 mt-2.5 max-w-[90px] sm:max-w-[105px]">
              <span
                className={cn(
                  "font-sans text-xs font-medium leading-tight transition-colors flex items-center gap-1",
                  isActive && "text-primary font-semibold text-sm",
                  isDone && "text-foreground font-medium",
                  !isDone && !isActive && "text-muted-foreground/80",
                )}
              >
                <span>{step.label}</span>
              </span>
              {metric ? <span className="mt-0.5">{metric}</span> : null}
            </div>
          );

          return (
            <li key={step.id} className="flex-1 flex flex-col items-center relative group min-w-[75px] sm:min-w-[90px]">
              <div className="flex items-center w-full">
                {/* Badge circulaire avec pictogramme sémantique */}
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full border transition-all shrink-0 mx-auto z-10",
                    isActive
                      ? "size-9 border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20"
                      : "size-7 text-[11px]",
                    isDone && "border-sage/60 bg-sage/15 text-sage shadow-2xs",
                    !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                    isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-60",
                  )}
                >
                  {isDone ? (
                    <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                  ) : isSoon ? (
                    <Lock className="size-2.5" />
                  ) : (
                    <KrewIcon name={krewIconName} tone={isActive ? "cream" : "plum"} size="sm" className={cn(isActive ? "size-4.5" : "size-3.5")} />
                  )}
                </span>

                {/* Connecteur organique fluide vers l'étape suivante */}
                {!isLast ? (
                  <div className="hidden sm:flex flex-1 items-center justify-center px-0.5" aria-hidden="true">
                    <svg viewBox="0 0 60 16" fill="none" className={cn("w-full h-3 max-w-[60px]", isDone ? "text-sage/60" : "text-border/50")}>
                      <path
                        d="M2,8 C18,3 42,13 58,8"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={isDone ? undefined : "3 3"}
                      />
                    </svg>
                  </div>
                ) : null}
              </div>

              {/* Contenu cliquable ou statique */}
              {step.id === "invite" && onInviteClick ? (
                <button
                  type="button"
                  onClick={onInviteClick}
                  className="flex flex-col items-center text-center bg-transparent border-0 p-0 cursor-pointer w-full"
                >
                  {StepLabel}
                </button>
              ) : href ? (
                <a href={href} className="flex flex-col items-center text-center no-underline w-full">
                  {StepLabel}
                </a>
              ) : (
                <div className="flex flex-col items-center text-center w-full">{StepLabel}</div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Trajectoire Organique Serpentine sur Mobile */}
      <ol className="block sm:hidden space-y-4 py-2 relative">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);
          const isEven = i % 2 === 0;
          const krewIconName = getStepKrewIcon(step.id);

          const StepContent = (
            <div className={cn(
              "flex flex-1 items-center justify-between gap-3 py-2 px-3.5 rounded-2xl transition-all",
              isActive
                ? "bg-primary/8 border border-primary/30 shadow-xs"
                : "bg-surface/50 border border-border/30"
            )}>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {isActive ? (
                  <span className="font-sans text-base font-semibold text-primary">
                    {step.label}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "font-sans text-sm font-medium",
                      isDone && "text-foreground font-semibold",
                      !isDone && !isActive && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                )}
                {metric ? metric : null}
              </div>

              {isActive || href ? (
                <KrewMark
                  type="arrow-right"
                  tone={isActive ? "plum" : "sage"}
                  size="sm"
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:translate-x-1",
                    isActive ? "text-primary" : "text-muted-foreground/60",
                  )}
                />
              ) : null}
            </div>
          );

          return (
            <li key={step.id} className="relative">
              <div className="flex items-center gap-3.5">
                {/* Colonne du nœud avec décalage X alterné & picto sémantique */}
                <div
                  className={cn(
                    "flex w-9 flex-col items-center shrink-0 transition-transform",
                    isEven ? "translate-x-0" : "translate-x-1",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-full border font-semibold transition-all z-10",
                      isActive
                        ? "size-9 border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/15"
                        : "size-7 text-[11px]",
                      isDone && "border-sage/60 bg-sage/15 text-sage shadow-2xs",
                      !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                      isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-50",
                    )}
                  >
                    {isDone ? (
                      <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                    ) : isSoon ? (
                      <Lock className="size-3" />
                    ) : (
                      <KrewIcon name={krewIconName} tone={isActive ? "cream" : "plum"} size="sm" className={cn(isActive ? "size-4.5" : "size-3.5")} />
                    )}
                  </span>

                  {/* Connecteur courbe organique vertical entre nœuds */}
                  {!isLast ? (
                    <div className="my-1 flex h-7 w-full items-center justify-center" aria-hidden="true">
                      <svg viewBox="0 0 16 32" fill="none" className="h-full w-4">
                        <path
                          d={isEven ? "M8,0 C14,10 2,22 8,32" : "M8,0 C2,10 14,22 8,32"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          fill="none"
                          className={isDone ? "text-sage/50" : "text-border/40"}
                          strokeDasharray={isDone ? undefined : "3 3"}
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>

                {/* Contenu cliquable */}
                <div className="flex-1 min-w-0">
                  {step.id === "invite" && onInviteClick ? (
                    <button
                      type="button"
                      onClick={onInviteClick}
                      className="group flex w-full items-center text-left bg-transparent border-0 p-0 cursor-pointer"
                    >
                      {StepContent}
                    </button>
                  ) : href ? (
                    <a href={href} className="group flex w-full items-center no-underline">
                      {StepContent}
                    </a>
                  ) : (
                    <div className="flex w-full items-center">{StepContent}</div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function ComingSoonGrid() {
  const items = [
    "Planning du séjour",
    "Hébergements",
    "Activités réservées",
    "Dépenses communes",
    "Répartition des chambres",
    "Check-list",
    "Documents & billets",
    "Sondages",
    "Chat de groupe",
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((label) => (
        <div
          key={label}
          className="rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-5 text-sm text-muted-foreground"
        >
          <span className="font-medium text-foreground/80">{label}</span>
          <span className="mt-1 block text-xs">À venir</span>
        </div>
      ))}
    </div>
  );
}
