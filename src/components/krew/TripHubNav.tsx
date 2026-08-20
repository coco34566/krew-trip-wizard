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
    <nav aria-label="Parcours du groupe" className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-3">
      {/* En-tête discret */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parcours du groupe
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {doneCount} / {total} étapes
        </span>
      </div>

      {/* Liste verticale compacte du parcours */}
      <ol className="space-y-0">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);

          const StepContent = (
            <div className="flex flex-1 items-center justify-between gap-2 py-0.5">
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
                    "size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5",
                    isActive ? "text-primary" : "text-muted-foreground/50",
                  )}
                />
              ) : null}
            </div>
          );

          return (
            <li key={step.id} className="relative">
              <div className="flex items-start gap-3">
                {/* Colonne gauche : nœud statut + ligne de connexion */}
                <div className="flex w-6 flex-col items-center shrink-0">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                      isDone && "border-secondary/80 bg-secondary/10 text-secondary",
                      isActive && !isDone && "border-primary bg-primary text-primary-foreground shadow-sm",
                      !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                      isSoon && "border-dashed border-border bg-muted/20 text-muted-foreground opacity-50",
                    )}
                  >
                    {isDone ? (
                      <KrewMark type="check" tone="sage" size="sm" className="size-3" />
                    ) : isSoon ? (
                      <Lock className="size-2.5" />
                    ) : (
                      <span className="font-mono text-[10px]">{i + 1}</span>
                    )}
                  </span>

                  {!isLast ? (
                    <div className="my-0.5 flex h-5 items-center justify-center">
                      <div
                        aria-hidden="true"
                        className={cn(
                          "w-0.5 h-full rounded-full transition-colors",
                          isDone ? "bg-secondary/40" : "bg-border/40",
                        )}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Colonne droite : Ligne cliquable si lien/action disponible */}
                <div className="flex-1 pb-2">
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
