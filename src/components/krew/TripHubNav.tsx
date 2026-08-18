import { Check, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";
import { KrewConnector, KrewHighlight, KrewMark } from "@/components/krew/visual-language";

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
    if (step.id === "dates") return "#hub-dates";
    if (step.id === "profile") return "#hub-profile";
    if (step.id === "destination") return "#hub-destination";
    if (step.id === "hotels") return "#hub-logistics";
    if (step.id === "transport") return "#hub-transports";
    if (step.id === "organize") return "#hub-activities-plan";
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
    <nav aria-label="Parcours du groupe" className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-sm">
      {/* En-tête de progression */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Parcours du groupe
          </h3>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            {doneCount} / {total} étapes
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted sm:w-36">
            <div
              className="h-full rounded-full bg-lagoon transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-xs font-semibold tabular-nums text-lagoon">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Liste verticale du parcours avec connecteurs KREW */}
      <ol className="space-y-0">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;
          const metric = renderMetric(step.id);

          return (
            <li key={step.id} className="relative">
              <div className="flex items-start gap-4">
                {/* Colonne gauche : nœud statut + ligne de connexion KREW */}
                <div className="flex w-9 flex-col items-center shrink-0">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                      isDone && "border-lagoon/80 bg-lagoon/10 text-lagoon",
                      isActive && !isDone && "border-primary bg-primary text-primary-foreground shadow-sm",
                      !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
                      isSoon && "border-dashed border-border bg-muted/30 text-muted-foreground opacity-60",
                    )}
                  >
                    {isDone ? (
                      <KrewMark type="check" tone="sage" size="sm" className="size-4" />
                    ) : isSoon ? (
                      <Lock className="size-3.5" />
                    ) : (
                      <span className="font-mono">{i + 1}</span>
                    )}
                  </span>

                  {!isLast ? (
                    <div className="my-1 flex h-8 items-center justify-center">
                      <div
                        aria-hidden="true"
                        className={cn(
                          "w-0.5 h-full rounded-full transition-colors",
                          isDone ? "bg-lagoon/50" : "bg-border/60",
                        )}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Colonne droite : Titre, métrique et action */}
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pb-5 pt-1">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isActive ? (
                        <KrewHighlight tone="plum" className="font-sans text-sm sm:text-base font-semibold">
                          {step.label}
                        </KrewHighlight>
                      ) : (
                        <span
                          className={cn(
                            "font-sans text-sm sm:text-base font-semibold",
                            isDone && "text-foreground",
                            !isDone && !isActive && "text-muted-foreground",
                          )}
                        >
                          {step.label}
                        </span>
                      )}
                      {metric ? metric : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    {step.id === "invite" && onInviteClick ? (
                      <button
                        type="button"
                        onClick={onInviteClick}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                      >
                        {step.label}
                        <ArrowRight className="size-3.5" />
                      </button>
                    ) : isActive && href ? (
                      <a
                        href={href}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                      >
                        {step.label}
                        <ArrowRight className="size-3.5" />
                      </a>
                    ) : isDone && href ? (
                      <a
                        href={href}
                        className="text-xs font-medium text-lagoon hover:underline underline-offset-2"
                      >
                        {step.label}
                      </a>
                    ) : null}
                  </div>
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
