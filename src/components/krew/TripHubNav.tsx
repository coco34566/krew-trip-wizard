import { Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";
import { KrewHighlight, KrewMark } from "@/components/krew/visual-language";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  star: "/trips/$tripId/star",
  memories: "/trips/$tripId/memories",
};

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
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;

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
    <nav aria-label="Parcours du groupe" className="rounded-3xl border border-border/60 bg-surface/80 p-5 sm:p-6 space-y-5">
      {/* En-tête du parcours du groupe */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3.5">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parcours du <KrewHighlight tone="sage"><span className="text-foreground">groupe</span></KrewHighlight>
        </h3>
        <span className="text-xs text-muted-foreground font-mono bg-surface-strong/60 px-2.5 py-1 rounded-full">
          {doneCount} / {total} étapes
        </span>
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

          const StepLabel = (
            <div className="flex flex-col items-center text-center gap-0.5 mt-2.5 max-w-[90px] sm:max-w-[105px]">
              <span
                className={cn(
                  "font-sans text-xs font-medium leading-tight transition-colors",
                  isActive && "text-primary font-semibold",
                  isDone && "text-foreground font-medium",
                  !isDone && !isActive && "text-muted-foreground/80",
                )}
              >
                {step.label}
              </span>
              {metric ? <span className="mt-0.5">{metric}</span> : null}
            </div>
          );

          return (
            <li key={step.id} className="flex-1 flex flex-col items-center relative group min-w-[75px] sm:min-w-[90px]">
              <div className="flex items-center w-full">
                {/* Badge circulaire */}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-all shrink-0 mx-auto z-10",
                    isDone && "border-sage/60 bg-sage/15 text-sage shadow-2xs",
                    isActive && !isDone && "border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20",
                    !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                    isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-60",
                  )}
                >
                  {isDone ? (
                    <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                  ) : isSoon ? (
                    <Lock className="size-2.5" />
                  ) : (
                    <span className="font-mono text-[11px]">{i + 1}</span>
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

      {/* Timeline Verticale Organique sur Mobile */}
      <ol className="block sm:hidden space-y-0 relative">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);

          const StepContent = (
            <div className="flex flex-1 items-center justify-between gap-2 py-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {isActive ? (
                  <span className="font-sans text-sm font-semibold text-primary">
                    {step.label}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "font-sans text-sm font-medium",
                      isDone && "text-foreground",
                      !isDone && !isActive && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                )}
                {metric ? metric : null}
              </div>

              {isActive || href ? (
                <ArrowRight
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                    isActive ? "text-primary" : "text-muted-foreground/50",
                  )}
                />
              ) : null}
            </div>
          );

          return (
            <li key={step.id} className="relative">
              <div className="flex items-start gap-3.5">
                {/* Colonne gauche : nœud statut + ligne de connexion organique */}
                <div className="flex w-7 flex-col items-center shrink-0">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors z-10",
                      isDone && "border-sage/60 bg-sage/15 text-sage shadow-2xs",
                      isActive && !isDone && "border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20",
                      !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                      isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-50",
                    )}
                  >
                    {isDone ? (
                      <KrewMark type="check" tone="sage" size="sm" className="size-3.5" />
                    ) : isSoon ? (
                      <Lock className="size-2.5" />
                    ) : (
                      <span className="font-mono text-[11px]">{i + 1}</span>
                    )}
                  </span>

                  {!isLast ? (
                    <div className="my-0.5 flex h-6 items-center justify-center" aria-hidden="true">
                      <div
                        className={cn(
                          "w-0.5 h-full rounded-full transition-colors",
                          isDone ? "bg-sage/50" : "bg-border/40",
                        )}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Colonne droite : Ligne cliquable si lien/action disponible */}
                <div className="flex-1 pb-2 min-w-0">
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
