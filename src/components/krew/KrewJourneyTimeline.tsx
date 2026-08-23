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
  { x: 68, y: 13 },
  { x: 32, y: 21 },
  { x: 70, y: 29 },
  { x: 30, y: 37 },
  { x: 68, y: 45 },
  { x: 32, y: 53 },
  { x: 70, y: 61 },
  { x: 30, y: 69 },
  { x: 68, y: 77 },
  { x: 32, y: 85 },
  { x: 65, y: 92 },
  { x: 48, y: 97 },
];

export function KrewJourneyTimeline({ tripId, tripName, steps, annotationText }: Props) {
  const nextActionIdx = steps.findIndex((step) => step.status === "next_action");
  const lastDoneIdx = steps.reduce(
    (acc, step, idx) => (step.status === "done" || step.status === "next_action" ? idx : acc),
    0,
  );
  const activeProgressIdx = nextActionIdx >= 0 ? nextActionIdx : lastDoneIdx;
  const progress = steps.length > 1 ? Math.max(0, activeProgressIdx) / (steps.length - 1) : 1;
  const pathD = "M29 5 C48 7 74 9 68 13 C58 19 26 17 32 21 C42 27 80 25 70 29 C58 35 22 33 30 37 C40 43 77 41 68 45 C56 51 24 49 32 53 C44 59 80 57 70 61 C58 67 22 65 30 69 C40 75 77 73 68 77 C56 83 24 81 32 85 C44 90 75 88 65 92 C58 95 52 96 48 97";

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
        <nav aria-label="Accès rapides au questionnaire et au profil" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a
            href={`/trips/${tripId}/questionnaire`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir mes préférences
          </a>
          <a
            href={`/trips/${tripId}?view=voyage&section=profile`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir le profil du voyage
          </a>
        </nav>
      </header>

      <div className="relative pt-4 pb-2 sm:pt-6 sm:pb-4 overflow-visible h-[800px] sm:h-[880px] lg:h-[920px]">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d={pathD}
            stroke="var(--secondary)"
            strokeWidth="1.2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="opacity-35"
          />
          <path
            d={pathD}
            pathLength="100"
            stroke="var(--secondary)"
            strokeWidth="2"
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
          const directHref =
            step.id === "preferences"
              ? `/trips/${tripId}/questionnaire`
              : step.id === "profile"
                ? `/trips/${tripId}?view=voyage&section=profile`
                : null;
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
                  "relative shrink-0 flex items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105 z-10",
                  isDone && "size-10 sm:size-11 bg-sage/20 border-2 border-secondary text-primary shadow-2xs",
                  isNextAction && "size-13 sm:size-15 bg-primary text-primary-foreground border-2 border-background ring-4 ring-primary/20 shadow-md",
                  isAvailable && "size-10 sm:size-11 bg-background border-2 border-primary/40 text-primary shadow-2xs",
                  isUpcoming && "size-8 sm:size-9 bg-background border border-border text-muted-foreground/55",
                )}
              >
                <KrewIcon
                  name={step.iconName}
                  size="sm"
                  tone={isNextAction ? "cream" : isDone || isAvailable ? "plum" : "muted"}
                  className={isNextAction ? "size-6 sm:size-7" : "size-5"}
                />
                {isDone ? (
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-secondary text-white text-[9px] font-bold shadow-2xs">
                    ✓
                  </span>
                ) : null}
              </div>

              <div className={cn("relative min-w-0 max-w-[170px] sm:max-w-[240px]", isNextAction && "max-w-[200px] sm:max-w-[270px]") }>
                {isNextAction ? (
                  <div className={cn("absolute -top-9 z-20 pointer-events-none", placeTextRight ? "left-0" : "right-0")}>
                    <KrewNote variant="label" tone="cream" rotation={placeTextRight ? -2 : 2} className="whitespace-nowrap px-3 py-1 text-xs sm:text-sm">
                      Prochaine étape
                    </KrewNote>
                  </div>
                ) : null}
                <h3
                  className={cn(
                    "font-display leading-tight transition-colors",
                    isNextAction ? "text-xl sm:text-2xl font-medium text-foreground" : "text-base sm:text-lg font-normal",
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
              {directHref ? (
                <a href={directHref} className="block no-underline">
                  {content}
                </a>
              ) : parsed && !isUpcoming ? (
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
