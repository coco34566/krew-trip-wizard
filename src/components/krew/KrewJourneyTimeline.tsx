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
  status: "done" | "current" | "upcoming";
  href?: string | null;
};

type Props = {
  tripId: string;
  tripName: string;
  steps: TimelineStep[];
  annotationText?: string | null;
};

export function KrewJourneyTimeline({
  tripId,
  tripName,
  steps,
  annotationText,
}: Props) {
  const currentIndex = steps.findIndex((s) => s.status === "current");
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="w-full max-w-[820px] mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-8 font-sans">
      {/* HEADER SECTION */}
      <header className="space-y-1 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[30px] sm:text-[36px] font-normal leading-tight text-foreground">
            Parcours du groupe
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-1.5 w-[140px] pointer-events-none"
          />
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground font-sans pt-1">
          L&apos;avancement du séjour pour <strong className="text-foreground font-semibold">{tripName}</strong>
        </p>
      </header>

      {/* TIMELINE CONTAINER */}
      <div className="relative my-8 py-4">
        {/* FIL SAUGE CONTINU (SVG CURVED PATH) */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none z-0">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 40 800"
            fill="none"
          >
            {/* Background dashed path for full line */}
            <path
              d="M20 0 Q10 100 20 200 T20 400 T20 600 T20 800"
              stroke="var(--secondary)"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
              className="opacity-35"
            />
            {/* Active solid path representing progress */}
            <path
              d="M20 0 Q10 100 20 200 T20 400 T20 600 T20 800"
              stroke="var(--secondary)"
              strokeWidth="3"
              strokeLinecap="round"
              style={{
                strokeDasharray: 800,
                strokeDashoffset: Math.max(
                  0,
                  800 - (800 * (activeIndex + 0.5)) / Math.max(1, steps.length),
                ),
              }}
            />
          </svg>
        </div>

        {/* STEPS LIST */}
        <div className="relative z-10 space-y-8 sm:space-y-12">
          {steps.map((step, idx) => {
            const isEven = idx % 2 === 0;
            const isDone = step.status === "done";
            const isCurrent = step.status === "current";
            const isUpcoming = step.status === "upcoming";

            const cardContent = (
              <div
                className={cn(
                  "relative transition-all duration-200 p-3.5 sm:p-4 rounded-2xl",
                  isCurrent
                    ? "text-left"
                    : isEven
                      ? "text-right sm:text-right"
                      : "text-left sm:text-left",
                )}
              >
                {/* ORGANIC BLOB ACCENT ON CURRENT STEP */}
                {isCurrent ? (
                  <KrewOrganicBlob
                    tone="plum"
                    variant="soft"
                    className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] opacity-20 pointer-events-none z-0"
                  />
                ) : null}

                <div className="relative z-10 space-y-1">
                  {/* STEP STATUS BADGE */}
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-mono font-medium uppercase tracking-wider",
                      isDone && "text-secondary font-semibold",
                      isCurrent && "text-primary font-bold",
                      isUpcoming && "text-muted-foreground/70",
                    )}
                  >
                    {isDone ? (
                      <>
                        <KrewMark type="check" tone="sage" size="sm" className="size-3.5 shrink-0" />
                        <span>Terminé</span>
                      </>
                    ) : isCurrent ? (
                      <>
                        <span className="size-2 rounded-full bg-primary animate-pulse" />
                        <span>En cours</span>
                      </>
                    ) : (
                      <span>À venir</span>
                    )}
                  </div>

                  {/* STEP TITLE */}
                  <h3
                    className={cn(
                      "font-display leading-snug transition-colors",
                      isCurrent
                        ? "text-[22px] sm:text-[26px] font-normal text-foreground"
                        : "text-[15px] sm:text-[17px] font-normal text-foreground/90",
                    )}
                  >
                    {step.title}
                  </h3>

                  {/* SUBTITLE DETAILS */}
                  {step.subtitle ? (
                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
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
                  "grid grid-cols-12 items-center gap-2 sm:gap-4 relative group",
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

                {/* CENTRAL TIMELINE NODE */}
                <div className="col-span-2 flex flex-col items-center justify-center relative z-20">
                  <div
                    className={cn(
                      "relative flex size-10 sm:size-12 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105",
                      isDone && "bg-sage/18 border-2 border-secondary text-primary shadow-2xs",
                      isCurrent && "bg-primary text-primary-foreground border-4 border-background ring-4 ring-primary/20 shadow-md scale-110",
                      isUpcoming && "bg-muted/40 border border-border/80 text-muted-foreground/60",
                    )}
                  >
                    <KrewIcon
                      name={step.iconName}
                      size="sm"
                      tone={isCurrent ? "cream" : isDone ? "plum" : "muted"}
                      className="size-5 sm:size-6"
                    />

                    {/* Check overlay for done steps */}
                    {isDone ? (
                      <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-secondary text-white text-[9px] font-bold shadow-2xs">
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

                {/* SINGLE HANDWRITTEN ANNOTATION (MAX 1 ON CURRENT STEP) */}
                {isCurrent && annotationText ? (
                  <div className="absolute -top-6 right-0 sm:right-4 z-30 pointer-events-none hidden sm:block">
                    <KrewNote variant="label" tone="cream" rotation={-2} className="text-xs py-1 px-2.5">
                      {annotationText} ✦
                    </KrewNote>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
