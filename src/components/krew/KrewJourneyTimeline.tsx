import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  KrewIcon,
  KrewMark,
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
    <div className="w-full max-w-[700px] mx-auto px-1 py-1 space-y-4 font-sans">
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
      <div className="relative my-3 py-1">
        {/* SINGLE CONTINUOUS TRAJECTORY LINE ALIGNED LEFT (AXIS AT left-5 sm:left-6) */}
        <div className="absolute top-2 bottom-2 left-5 sm:left-6 -translate-x-1/2 w-4 pointer-events-none z-0">
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
              strokeWidth="1.75"
              strokeDasharray="3 3"
              strokeLinecap="round"
              className="opacity-35"
            />
            {/* Active progress path */}
            <path
              d="M8 0 C12 100, 4 200, 8 300 C12 400, 4 500, 8 600"
              stroke="var(--secondary)"
              strokeWidth="2.25"
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
        <div className="relative z-10 space-y-5">
          {categories.map((cat) => (
            <div key={cat.key} className="space-y-2">
              {/* TYPOGRAPHIC DISCRETE INTERTITLE */}
              <div className="pl-12 sm:pl-14 pt-1 pb-0.5">
                <span className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat.label}
                </span>
              </div>

              {/* OPEN COMPOSITION STEPS (NO HEAVY CARDS) */}
              <div className="space-y-1 sm:space-y-1.5">
                {cat.steps.map((step) => {
                  const isDone = step.status === "done";
                  const isNextAction = step.status === "next_action";
                  const isAvailable = step.status === "available";
                  const isUpcoming = step.status === "upcoming";

                  const StepContent = (
                    <div
                      className={cn(
                        "relative flex items-center justify-between gap-3 py-1.5 sm:py-2 px-1 transition-all w-full text-left group",
                        isNextAction ? "py-2 sm:py-2.5" : "",
                      )}
                    >
                      <div className="relative z-10 space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={cn(
                              "font-display leading-tight transition-colors",
                              isNextAction
                                ? "text-lg sm:text-xl font-medium text-foreground group-hover:text-primary"
                                : "text-base font-normal",
                              isDone && "text-foreground/90 font-medium group-hover:text-primary",
                              isAvailable && "text-foreground group-hover:text-primary",
                              isUpcoming && "text-muted-foreground/70",
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
                                  ? "text-muted-foreground font-sans"
                                  : "text-muted-foreground/80",
                            )}
                          >
                            {step.subtitle}
                          </p>
                        ) : null}
                      </div>

                      {/* PROMINENT NEXT ACTION CTA BUTTON & DISCRETIONARY ARROWS */}
                      {isNextAction ? (
                        <div className="relative z-10 shrink-0 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 font-sans text-xs bg-primary text-primary-foreground font-semibold px-3.5 py-1.5 rounded-full shadow-2xs group-hover:opacity-90 transition-opacity">
                            Continuer <KrewMark type="arrow-right" tone="cream" size="sm" className="size-3.5 shrink-0" />
                          </span>
                        </div>
                      ) : step.href && !isUpcoming ? (
                        <div className="relative z-10 shrink-0 flex items-center gap-1 text-xs font-semibold text-primary opacity-50 group-hover:opacity-100 transition-opacity">
                          <KrewMark
                            type="arrow-right"
                            tone="sage"
                            size="sm"
                            className="size-3.5 shrink-0"
                          />
                        </div>
                      ) : null}
                    </div>
                  );

                  return (
                    <div
                      key={step.id}
                      className="relative flex items-center min-h-[48px] group"
                    >
                      {/* NODE DIRECTLY ON THE TRAJECTORY LINE (left-5 sm:left-6) */}
                      <div className="absolute left-5 sm:left-6 -translate-x-1/2 z-20 flex items-center justify-center">
                        <div
                          className={cn(
                            "flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105",
                            isDone &&
                              "size-7 sm:size-8 bg-sage/20 border border-secondary text-primary shadow-2xs",
                            isNextAction &&
                              "size-10 sm:size-11 bg-primary text-primary-foreground border-2 border-background ring-4 ring-primary/20 shadow-md scale-105",
                            isAvailable &&
                              "size-7 sm:size-8 bg-background border border-primary/40 text-primary shadow-2xs",
                            isUpcoming &&
                              "size-6 sm:size-7 bg-muted/30 border border-border/60 text-muted-foreground/50",
                          )}
                        >
                          <KrewIcon
                            name={step.iconName}
                            size="sm"
                            tone={isNextAction ? "cream" : isDone ? "plum" : isAvailable ? "plum" : "muted"}
                            className={cn(
                              isNextAction ? "size-4.5" : "size-3.5",
                            )}
                          />

                          {/* Check badge for done steps */}
                          {isDone ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-secondary text-white text-[7px] font-bold shadow-2xs">
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* STEP CONTENT WRAPPER — ALL CONTENT ON THE RIGHT SIDE (pl-12 sm:pl-14) */}
                      <div className="pl-12 sm:pl-14 w-full">
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
