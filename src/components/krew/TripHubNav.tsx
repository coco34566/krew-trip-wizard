import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  star: "/trips/$tripId/star",
};

export function TripHubNav({
  tripId,
  steps,
  onInviteClick,
}: {
  tripId: string;
  steps: TripStep[];
  onInviteClick?: () => void;
}) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const total = steps.length;
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;

  function stepHref(step: TripStep): string | null {
    if (step.id === "invite") return "#invite-section";
    if (step.id === "destination") return "#hub-destination";
    if (step.id === "organize") return "#hub-activities-plan";
    const routeTo = STEP_ROUTE[step.id];
    if (routeTo) return routeTo.replace("$tripId", tripId);
    return null;
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-surface/40 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Parcours du groupe
          </p>
          <p className="mt-0.5 text-sm text-foreground/80">
            {doneCount === total
              ? "Tout est prêt — place à l'organisation !"
              : `${doneCount} / ${total} étapes complétées`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-border/60 sm:w-32">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Stepper desktop */}
      <ol className="hidden sm:grid sm:grid-cols-5 sm:gap-0">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;

          const node = (
            <div className="relative flex flex-col items-center text-center">
              {/* connector line behind circle */}
              {!isLast ? (
                <div
                  className={cn(
                    "absolute left-[calc(50%+18px)] right-[-50%] top-4 h-0.5 -translate-y-1/2",
                    isDone ? "bg-emerald-500" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}

              <span
                className={cn(
                  "relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                  isDone &&
                    "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.2)]",
                  isActive &&
                    !isDone &&
                    "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(var(--primary-rgb,59,130,246),0.15)] ring-2 ring-primary/20",
                  !isDone &&
                    !isActive &&
                    !isSoon &&
                    "border-border bg-background text-muted-foreground",
                  isSoon &&
                    "border-dashed border-border bg-muted/40 text-muted-foreground opacity-70",
                )}
              >
                {isDone ? (
                  <Check className="size-4 stroke-[2.5]" />
                ) : isSoon ? (
                  <Lock className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>

              <span
                className={cn(
                  "mt-2.5 text-sm font-semibold leading-tight",
                  isDone && "text-emerald-700 dark:text-emerald-400",
                  isActive && !isDone && "text-primary",
                  !isDone && !isActive && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 max-w-[7.5rem] text-[11px] leading-snug",
                  isDone
                    ? "font-medium text-emerald-600/90 dark:text-emerald-400/90"
                    : "text-muted-foreground",
                )}
              >
                {isDone ? "Terminé" : step.description}
              </span>
            </div>
          );

          const key = step.id;
          if (step.id === "invite" && onInviteClick) {
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={onInviteClick}
                  className="w-full cursor-pointer border-0 bg-transparent p-0"
                >
                  {node}
                </button>
              </li>
            );
          }
          if (href) {
            return (
              <li key={key}>
                <a href={href} className="block no-underline">
                  {node}
                </a>
              </li>
            );
          }
          return <li key={key}>{node}</li>;
        })}
      </ol>

      {/* Stepper mobile — vertical timeline */}
      <ol className="space-y-0 sm:hidden">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;

          const row = (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    isDone && "border-emerald-500 bg-emerald-500 text-white",
                    isActive &&
                      !isDone &&
                      "border-primary bg-primary text-primary-foreground",
                    !isDone &&
                      !isActive &&
                      !isSoon &&
                      "border-border bg-background text-muted-foreground",
                    isSoon &&
                      "border-dashed border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="size-3.5 stroke-[2.5]" />
                  ) : isSoon ? (
                    <Lock className="size-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                {!isLast ? (
                  <div
                    className={cn(
                      "mt-1 w-0.5 flex-1 min-h-[1.25rem]",
                      isDone ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <div className={cn("pb-4", isLast && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isDone && "text-emerald-700 dark:text-emerald-400",
                    isActive && !isDone && "text-primary",
                    !isDone && !isActive && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {isDone ? (
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Fait
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isDone ? "Étape terminée" : step.description}
                </p>
              </div>
            </div>
          );

          if (step.id === "invite" && onInviteClick) {
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={onInviteClick}
                  className="w-full border-0 bg-transparent p-0 text-left"
                >
                  {row}
                </button>
              </li>
            );
          }
          if (href) {
            return (
              <li key={step.id}>
                <a href={href} className="block no-underline">
                  {row}
                </a>
              </li>
            );
          }
          return <li key={step.id}>{row}</li>;
        })}
      </ol>
    </div>
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
