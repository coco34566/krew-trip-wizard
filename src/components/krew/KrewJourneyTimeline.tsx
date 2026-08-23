import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  KrewIcon,
  KrewMark,
  KrewOrganicBlob,
  KrewNote,
  type KrewIconName,
} from "@/components/krew/visual-language";

export type TimelineStep = {
  id: string;
  title: string;
  subtitle?: string | null;
  iconName: KrewIconName;
  status: "done" | "available" | "next_action" | "upcoming";
  category?: "questionnaire" | "prepare" | "organisation" | "souvenirs";
  href?: string | null;
};

type Props = {
  tripId: string;
  tripName: string;
  steps: TimelineStep[];
  annotationText?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  questionnaire: "Questionnaire",
  prepare: "Préparer le voyage",
  organisation: "Organisation",
  souvenirs: "Vos souvenirs",
};

function parseStepHref(href: string) {
  const [path, queryString] = href.split("?");
  if (!queryString) return { to: path, search: undefined };
  const search: Record<string, string> = {};
  for (const pair of queryString.split("&")) {
    const [k, v] = pair.split("=");
    if (k) search[k] = decodeURIComponent(v || "");
  }
  return { to: path, search };
}

export function KrewJourneyTimeline({
  tripName,
  steps,
  annotationText,
}: Props) {
  const nextActionIdx = steps.findIndex((s) => s.status === "next_action");
  const lastDoneIdx = steps.reduce(
    (acc, s, idx) => (s.status === "done" || s.status === "next_action" ? idx : acc),
    0,
  );
  const activeProgressIdx = nextActionIdx >= 0 ? nextActionIdx : lastDoneIdx;

  // Group steps by category
  const categories: { key: string; label: string; steps: TimelineStep[] }[] = [];
  for (const step of steps) {
    const catKey = step.category || "prepare";
    let cat = categories.find((c) => c.key === catKey);
    if (!cat) {
      cat = { key: catKey, label: CATEGORY_LABELS[catKey] || catKey, steps: [] };
      categories.push(cat);
    }
    cat.steps.push(step);
  }

  return (
    <div className="w-full max-w-[720px] mx-auto px-1 py-2 space-y-4 font-sans">
      {/* HEADER SECTION */}
      <header className="space-y-1 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[28px] sm:text-[34px] font-normal leading-tight text-foreground">
            Parcours du groupe
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-1.5 w-[140px] pointer-events-none opacity-85"
          />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground font-sans pt-1">
          L&apos;avancement du séjour pour <strong className="text-foreground font-semibold">{tripName}</strong>
        </p>
      </header>

      {/* TIMELINE CONTAINER WITH SINGLE CONTINUOUS TRAJECTORY LINE */}
      <div className="relative my-4 py-1">
        {/* SINGLE CONTINUOUS TRAJECTORY LINE ALIGNED LEFT (AXIS AT left-6 sm:left-8) */}
        <div className="absolute top-2 bottom-2 left-6 sm:left-8 -translate-x-1/2 w-4 pointer-events-none z-0">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 16 600"
            fill="none"
          >
            {/* Soft background trajectory path with gentle organic wave */}
            <path
              d="M8 0 C12 100, 4 200, 8 300 C12 400, 4 500, 8 600"
              stroke="var(--secondary)"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              className="opacity-35"
            />
            {/* Active progress path */}
            <path
              d="M8 0 C12 100, 4 200, 8 300 C12 400, 4 500, 8 600"
              stroke="var(--secondary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                strokeDasharray: 600,
                strokeDashoffset: Math.max(
                  0,
                  600 - (600 * (activeProgressIdx + 0.5)) / Math.max(1, steps.length),
                ),
              }}
            />
          </svg>
        </div>

        {/* CATEGORIES & STEPS */}
        <div className="relative z-10 space-y-6">
          {categories.map((cat) => (
            <div key={cat.key} className="space-y-3">
              {/* CATEGORY INTERTITLE ALIGNED WITH CONTENT */}
              <div className="pl-14 sm:pl-16 relative flex items-center gap-2 py-0.5 z-10">
                <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-primary bg-sage/12 px-2.5 py-1 rounded-md border border-sage/25">
                  {cat.label}
                </span>
              </div>

              {/* STEPS IN CATEGORY — COMPACT VERTICAL LAYOUT */}
              <div className="space-y-2 sm:space-y-2.5">
                {cat.steps.map((step) => {
                  const isDone = step.status === "done";
                  const isNextAction = step.status === "next_action";
                  const isAvailable = step.status === "available";
                  const isUpcoming = step.status === "upcoming";

                  const StepContent = (
                    <div
                      className={cn(
                        "relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl transition-all w-full text-left",
                        isNextAction
                          ? "bg-surface border-2 border-primary/40 shadow-xs"
                          : isDone
                            ? "bg-surface/40 border border-border/40 hover:border-border/70"
                            : isAvailable
                              ? "bg-background border border-border/60 hover:border-primary/40"
                              : "bg-surface/20 border border-border/30 opacity-70",
                      )}
                    >
                      {/* NEXT ACTION ORGANIC BLOB NAPPE */}
                      {isNextAction ? (
                        <KrewOrganicBlob
                          tone="plum"
                          variant="soft"
                          className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] opacity-20 pointer-events-none z-0"
                        />
                      ) : null}

                      <div className="relative z-10 space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={cn(
                              "font-display leading-tight transition-colors",
                              isNextAction
                                ? "text-lg sm:text-xl font-medium text-foreground"
                                : "text-base font-normal",
                              isDone && "text-foreground/90 font-medium",
                              isAvailable && "text-foreground",
                              isUpcoming && "text-muted-foreground/80",
                            )}
                          >
                            {step.title}
                          </h3>
                        </div>

                        {step.subtitle ? (
                          <p
                            className={cn(
                              "text-xs sm:text-[13px] font-sans leading-snug",
                              isNextAction
                                ? "text-primary font-medium"
                                : isDone
                                  ? "text-primary/90 font-mono"
                                  : "text-muted-foreground",
                            )}
                          >
                            {step.subtitle}
                          </p>
                        ) : null}
                      </div>

                      {/* CTA / LINK INDICATOR */}
                      {step.href && !isUpcoming ? (
                        <div className="relative z-10 shrink-0 flex items-center gap-1 text-xs font-semibold text-primary">
                          {isNextAction ? (
                            <span className="hidden sm:inline-block font-sans text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full shadow-2xs">
                              Continuer →
                            </span>
                          ) : null}
                          <KrewMark
                            type="arrow-right"
                            tone={isNextAction ? "plum" : "sage"}
                            size="sm"
                            className="size-4 shrink-0"
                          />
                        </div>
                      ) : null}
                    </div>
                  );

                  return (
                    <div
                      key={step.id}
                      className="relative flex items-center min-h-[52px] group"
                    >
                      {/* NODE DIRECTLY ON THE TRAJECTORY LINE (left-6 sm:left-8) */}
                      <div className="absolute left-6 sm:left-8 -translate-x-1/2 z-20 flex items-center justify-center">
                        <div
                          className={cn(
                            "flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105",
                            isDone &&
                              "size-8 sm:size-9 bg-sage/18 border border-secondary text-primary shadow-2xs",
                            isNextAction &&
                              "size-11 sm:size-12 bg-primary text-primary-foreground border-2 border-background ring-4 ring-primary/20 shadow-md scale-105",
                            isAvailable &&
                              "size-8 sm:size-9 bg-background border border-primary/40 text-primary shadow-2xs",
                            isUpcoming &&
                              "size-7 sm:size-8 bg-muted/30 border border-border/60 text-muted-foreground/50",
                          )}
                        >
                          <KrewIcon
                            name={step.iconName}
                            size="sm"
                            tone={isNextAction ? "cream" : isDone ? "plum" : isAvailable ? "plum" : "muted"}
                            className={cn(
                              isNextAction ? "size-5" : "size-4",
                            )}
                          />

                          {/* Check badge for done steps */}
                          {isDone ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-secondary text-white text-[8px] font-bold shadow-2xs">
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* STEP CONTENT WRAPPER — ALL CONTENT ON THE RIGHT SIDE (pl-14 sm:pl-16) */}
                      <div className="pl-14 sm:pl-16 w-full">
                        {step.href && !isUpcoming ? (
                          (() => {
                            const parsed = parseStepHref(step.href);
                            return (
                              <Link
                                to={parsed.to as any}
                                search={parsed.search as any}
                                className="block w-full no-underline"
                              >
                                {StepContent}
                              </Link>
                            );
                          })()
                        ) : (
                          <div className="w-full">{StepContent}</div>
                        )}
                      </div>

                      {/* HANDWRITTEN CAVEAT ANNOTATION ON NEXT ACTION */}
                      {isNextAction && annotationText ? (
                        <div className="absolute -top-3.5 right-2 sm:right-4 z-30 pointer-events-none">
                          <KrewNote
                            variant="label"
                            tone="cream"
                            rotation={-2}
                            className="text-xs sm:text-sm py-1 px-2.5"
                          >
                            {annotationText}
                          </KrewNote>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
