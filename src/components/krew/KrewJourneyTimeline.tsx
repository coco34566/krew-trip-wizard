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
  category?: "questionnaire" | "prepare" | "organisation";
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
};

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

  let globalStepCounter = 0;

  return (
    <div className="w-full max-w-[740px] mx-auto px-2 sm:px-4 py-2 space-y-4 font-sans">
      {/* HEADER SECTION */}
      <header className="space-y-1 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[28px] sm:text-[32px] font-normal leading-tight text-foreground">
            Parcours du groupe
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-1.5 w-[130px] pointer-events-none opacity-85"
          />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground font-sans pt-1">
          L&apos;avancement du séjour pour <strong className="text-foreground font-semibold">{tripName}</strong>
        </p>
      </header>

      {/* COMPACT TIMELINE CONTAINER */}
      <div className="relative my-4 py-2">
        {/* FIL SAUGE ORGANIQUE DESSINÉ (SVG CURVED PATH) */}
        <div className="absolute inset-y-0 left-[44%] sm:left-1/2 -translate-x-1/2 w-6 pointer-events-none z-0">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 30 600"
            fill="none"
          >
            {/* Background dashed path */}
            <path
              d="M15 0 C25 60, 5 120, 15 180 C25 240, 5 300, 15 360 C25 420, 5 480, 15 540 L15 600"
              stroke="var(--secondary)"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              className="opacity-30"
            />
            {/* Active progress path */}
            <path
              d="M15 0 C25 60, 5 120, 15 180 C25 240, 5 300, 15 360 C25 420, 5 480, 15 540 L15 600"
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
        <div className="relative z-10 space-y-5">
          {categories.map((cat) => (
            <div key={cat.key} className="space-y-2">
              {/* CATEGORY CHAPTER INTERTITLE */}
              <div className="relative flex items-center gap-2 py-1 z-10">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-primary/90 bg-background/80 px-2 py-0.5 rounded-md border border-primary/10">
                  {cat.label}
                </span>
                <KrewMark
                  type="underline-wave"
                  tone="sage"
                  size="sm"
                  className="w-16 h-1.5 opacity-60 pointer-events-none"
                />
              </div>

              {/* STEPS IN CATEGORY */}
              <div className="space-y-2 sm:space-y-3">
                {cat.steps.map((step) => {
                  const currentGlobalIdx = globalStepCounter++;
                  const isEven = currentGlobalIdx % 2 === 0;
                  const isDone = step.status === "done";
                  const isNextAction = step.status === "next_action";
                  const isAvailable = step.status === "available";
                  const isUpcoming = step.status === "upcoming";

                  const cardContent = (
                    <div
                      className={cn(
                        "relative transition-all duration-150 py-1.5 px-2.5 sm:px-3 rounded-xl",
                        isNextAction
                          ? "p-3 sm:p-4 text-left"
                          : isEven
                            ? "text-right sm:text-right"
                            : "text-left sm:text-left",
                      )}
                    >
                      {/* PROMINENT PLUM ORGANIC NAPPE FOR NEXT ACTION */}
                      {isNextAction ? (
                        <KrewOrganicBlob
                          tone="plum"
                          variant="soft"
                          className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] opacity-25 pointer-events-none z-0"
                        />
                      ) : null}

                      <div className="relative z-10 space-y-0.5">
                        {/* STEP TITLE */}
                        <h3
                          className={cn(
                            "font-display leading-tight transition-colors",
                            isNextAction
                              ? "text-[20px] sm:text-[24px] font-normal text-foreground"
                              : isDone
                                ? "text-[14px] sm:text-[15px] font-normal text-foreground/80"
                                : isAvailable
                                  ? "text-[14px] sm:text-[15px] font-normal text-foreground"
                                  : "text-[14px] sm:text-[15px] font-normal text-muted-foreground/80",
                          )}
                        >
                          {step.title}
                        </h3>

                        {/* INFORMATIVE SUBTITLE ONLY (NO REPETITIVE BADGES) */}
                        {step.subtitle ? (
                          <p
                            className={cn(
                              "text-[11px] sm:text-xs font-sans leading-snug",
                              isNextAction
                                ? "text-foreground/90 font-medium"
                                : isDone
                                  ? "text-primary/90 font-mono"
                                  : "text-muted-foreground",
                            )}
                          >
                            {step.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "grid grid-cols-12 items-center gap-1.5 sm:gap-3 relative group min-h-[48px]",
                      )}
                    >
                      {/* LEFT COLUMN */}
                      <div className="col-span-5 flex justify-end">
                        {isEven ? (
                          step.href ? (
                            <Link
                              to={step.href as any}
                              className="w-full hover:opacity-90 transition-opacity"
                            >
                              {cardContent}
                            </Link>
                          ) : (
                            <div className="w-full">{cardContent}</div>
                          )
                        ) : null}
                      </div>

                      {/* CENTRAL TIMELINE NODE / SEAL */}
                      <div className="col-span-2 flex flex-col items-center justify-center relative z-20">
                        <div
                          className={cn(
                            "relative flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105",
                            isDone &&
                              "size-8 sm:size-9 bg-sage/18 border border-secondary text-primary shadow-2xs",
                            isNextAction &&
                              "size-11 sm:size-13 bg-primary text-primary-foreground border-2 border-background ring-4 ring-primary/20 shadow-md scale-110",
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
                              isNextAction ? "size-5 sm:size-6" : "size-4 sm:size-4.5",
                            )}
                          />

                          {/* Check icon for done steps */}
                          {isDone ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-secondary text-white text-[8px] font-bold shadow-2xs">
                              ✓
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* RIGHT COLUMN */}
                      <div className="col-span-5 flex justify-start">
                        {!isEven ? (
                          step.href ? (
                            <Link
                              to={step.href as any}
                              className="w-full hover:opacity-90 transition-opacity"
                            >
                              {cardContent}
                            </Link>
                          ) : (
                            <div className="w-full">{cardContent}</div>
                          )
                        ) : null}
                      </div>

                      {/* MAX 1 HANDWRITTEN CAVEAT ANNOTATION ON NEXT ACTION */}
                      {isNextAction && annotationText ? (
                        <div className="absolute -top-5 right-1 sm:right-3 z-30 pointer-events-none hidden sm:block">
                          <KrewNote
                            variant="label"
                            tone="cream"
                            rotation={-2}
                            className="text-[11px] py-0.5 px-2"
                          >
                            {annotationText} ✦
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
