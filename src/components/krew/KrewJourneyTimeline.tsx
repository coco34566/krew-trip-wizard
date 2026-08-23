import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { KrewIcon, KrewMark, KrewNote, type KrewIconName } from "@/components/krew/visual-language";

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

const PATH_POINTS = [
  { x: 29, y: 5 },
  { x: 66, y: 16 },
  { x: 35, y: 28 },
  { x: 72, y: 40 },
  { x: 31, y: 52 },
  { x: 68, y: 64 },
  { x: 38, y: 76 },
  { x: 65, y: 88 },
  { x: 46, y: 97 },
];

export function KrewJourneyTimeline({ tripName, steps, annotationText }: Props) {
  const nextActionIdx = steps.findIndex((step) => step.status === "next_action");
  const lastDoneIdx = steps.reduce(
    (acc, step, idx) => (step.status === "done" || step.status === "next_action" ? idx : acc),
    0,
  );
  const activeProgressIdx = nextActionIdx >= 0 ? nextActionIdx : lastDoneIdx;
  const progress = steps.length > 1 ? Math.max(0, activeProgressIdx) / (steps.length - 1) : 1;

  return (
    <div className="w-full max-w-[760px] mx-auto px-1 py-1 font-sans">
      <header className="relative mb-5 sm:mb-7">
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
        <p className="pt-2 text-xs sm:text-sm text-muted-foreground">
          Le chemin de <strong className="font-semibold text-foreground">{tripName}</strong>
        </p>
      </header>

      <div className="relative h-[720px] sm:h-[780px] lg:h-[820px] overflow-hidden">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M29 5 C45 7 74 10 66 16 C56 22 28 21 35 28 C44 34 80 32 72 40 C63 47 22 44 31 52 C40 59 77 56 68 64 C58 71 28 69 38 76 C48 82 75 81 65 88 C59 92 51 94 46 97"
            stroke="var(--secondary)"
            strokeWidth="0.7"
            strokeDasharray="1.3 1.4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="opacity-35"
          />
          <path
            d="M29 5 C45 7 74 10 66 16 C56 22 28 21 35 28 C44 34 80 32 72 40 C63 47 22 44 31 52 C40 59 77 56 68 64 C58 71 28 69 38 76 C48 82 75 81 65 88 C59 92 51 94 46 97"
            pathLength="100"
            stroke="var(--secondary)"
            strokeWidth="1.15"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress * 100 }}
          />
        </svg>

        {steps.map((step, index) => {
          const fallbackY = steps.length > 1 ? 5 + (92 * index) / (steps.length - 1) : 50;
          const point = PATH_POINTS[index] ?? {
            x: index % 2 === 0 ? 34 : 66,
            y: fallbackY,
          };
          const isDone = step.status === "done";
          const isNextAction = step.status === "next_action";
          const isAvailable = step.status === "available";
          const isUpcoming = step.status === "upcoming";
          const placeTextRight = point.x < 52;
          const parsed = step.href ? parseStepHref(step.href) : null;

          const content = (
            <div
              className={cn(
                "group relative flex items-center gap-2 sm:gap-3",
                placeTextRight ? "flex-row" : "flex-row-reverse text-right",
              )}
            >
              <div
                className={cn(
                  "relative shrink-0 flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105",
                  isDone && "size-8 sm:size-9 bg-sage/20 border border-secondary text-primary shadow-2xs",
                  isNextAction && "size-11 sm:size-12 bg-primary text-primary-foreground border-2 border-background ring-4 ring-primary/20 shadow-md",
                  isAvailable && "size-8 sm:size-9 bg-background border border-primary/40 text-primary shadow-2xs",
                  isUpcoming && "size-7 sm:size-8 bg-background border border-border text-muted-foreground/55",
                )}
              >
                <KrewIcon
                  name={step.iconName}
                  size="sm"
                  tone={isNextAction ? "cream" : isDone || isAvailable ? "plum" : "muted"}
                  className={isNextAction ? "size-5" : "size-4"}
                />
                {isDone ? (
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-secondary text-white text-[8px] font-bold shadow-2xs">
                    ✓
                  </span>
                ) : null}
              </div>

              <div className={cn("relative min-w-0 max-w-[150px] sm:max-w-[220px]", isNextAction && "max-w-[180px] sm:max-w-[250px]") }>
                {isNextAction ? (
                  <div className={cn("absolute -top-8 z-20 pointer-events-none", placeTextRight ? "left-0" : "right-0")}>
                    <KrewNote variant="label" tone="cream" rotation={placeTextRight ? -2 : 2} className="whitespace-nowrap px-2.5 py-1 text-[11px] sm:text-xs">
                      Prochaine étape
                    </KrewNote>
                  </div>
                ) : null}
                <h3
                  className={cn(
                    "font-display leading-tight transition-colors",
                    isNextAction ? "text-lg sm:text-xl font-medium text-foreground" : "text-sm sm:text-base font-normal",
                    isDone && "text-foreground/90",
                    isAvailable && "text-foreground group-hover:text-primary",
                    isUpcoming && "text-muted-foreground/65",
                  )}
                >
                  {step.title}
                </h3>
                {isNextAction ? (
                  <span className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                    Continuer
                  </span>
                ) : null}
              </div>
            </div>
          );

          return (
            <div
              key={step.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {parsed && !isUpcoming ? (
                <Link to={parsed.to as any} search={parsed.search as any} className="block no-underline">
                  {content}
                </Link>
              ) : (
                content
              )}
              {isNextAction && annotationText ? (
                <span className="sr-only">{annotationText}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
