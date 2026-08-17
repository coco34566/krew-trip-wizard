import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripStep } from "@/lib/krew/availability";

const STEP_ROUTE: Record<string, string> = {
  availability: "/trips/$tripId/availability",
  questionnaire: "/trips/$tripId/questionnaire",
  star: "/trips/$tripId/star",
  memories: "/trips/$tripId/memories",
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
  // Remplissage de la barre entre la 1re et la dernière pastille (pas au-delà)
  const lineFillPct =
    total <= 1 ? 0 : Math.min(100, Math.max(0, ((doneCount - 1) / (total - 1)) * 100));

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

  function renderStepNode(step: TripStep, i: number) {
    const isDone = step.status === "done";
    const isActive = step.status === "active";
    const isSoon = step.status === "soon";

    return (
      <div className="relative z-10 flex flex-col items-center text-center">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
            isDone &&
              "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
            isActive &&
              !isDone &&
              "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20",
            !isDone && !isActive && !isSoon && "border-border bg-background text-muted-foreground",
            isSoon && "border-dashed border-border bg-muted/40 text-muted-foreground opacity-70",
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
            "mt-2.5 max-w-[5.5rem] text-[13px] font-semibold leading-tight",
            isDone && "text-emerald-700 dark:text-emerald-400",
            isActive && !isDone && "text-primary",
            !isDone && !isActive && "text-muted-foreground",
          )}
        >
          {step.label}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-surface/40 p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Parcours du groupe
          </p>
          <p className="mt-0.5 text-sm text-foreground/80">
            {doneCount === total
              ? "Tout est prêt pour la suite !"
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

      {/* Desktop : une seule barre centrée sous les pastilles, fill selon étapes done */}
      <div className="relative hidden sm:block">
        {/* Track : de centre 1re pastille → centre dernière (padding = demi-colonne) */}
        <div
          className="pointer-events-none absolute top-[1.125rem] h-0.5 -translate-y-1/2 rounded-full bg-border"
          style={{ left: `${100 / (total * 2)}%`, right: `${100 / (total * 2)}%` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-[1.125rem] h-0.5 max-w-full -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-500"
          style={{
            left: `${50 / total}%`,
            width: `calc((100% - ${100 / total}%) * ${lineFillPct / 100})`,
          }}
          aria-hidden
        />

        <ol
          className="relative z-10 grid gap-0"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((step, i) => {
            const href = stepHref(step);
            const node = renderStepNode(step, i);
            if (step.id === "invite" && onInviteClick) {
              return (
                <li key={step.id}>
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
                <li key={step.id}>
                  <a href={href} className="block no-underline">
                    {node}
                  </a>
                </li>
              );
            }
            return <li key={step.id}>{node}</li>;
          })}
        </ol>
      </div>

      {/* Mobile — timeline verticale (ligne limitée entre les pastilles) */}
      <ol className="space-y-0 sm:hidden">
        {steps.map((step, i) => {
          const isDone = step.status === "done";
          const isActive = step.status === "active";
          const isSoon = step.status === "soon";
          const href = stepHref(step);
          const isLast = i === steps.length - 1;

          const row = (
            <div className="flex gap-3">
              <div className="flex w-8 flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    isDone && "border-emerald-500 bg-emerald-500 text-white",
                    isActive && !isDone && "border-primary bg-primary text-primary-foreground",
                    !isDone &&
                      !isActive &&
                      !isSoon &&
                      "border-border bg-background text-muted-foreground",
                    isSoon && "border-dashed border-border bg-muted/40 text-muted-foreground",
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
                      "mt-1 w-0.5 flex-1 min-h-[1.5rem]",
                      isDone ? "bg-emerald-500" : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <div className={cn("pb-5 pt-0.5", isLast && "pb-0")}>
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
