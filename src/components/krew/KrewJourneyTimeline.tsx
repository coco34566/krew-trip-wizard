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

/*
 * Deliberately irregular: the journey should read like a route traced by hand,
 * not a perfectly alternating corporate timeline.
 */
const PATH_POINTS = [
  { x: 31, y: 5 },
  { x: 62, y: 12 },
  { x: 43, y: 20 },
  { x: 69, y: 29 },
  { x: 36, y: 38 },
  { x: 58, y: 46 },
  { x: 32, y: 55 },
  { x: 66, y: 63 },
  { x: 47, y: 72 },
  { x: 70, y: 80 },
  { x: 39, y: 88 },
  { x: 59, y: 94 },
  { x: 47, y: 98 },
];

export function KrewJourneyTimeline({ tripId, tripName, steps, annotationText }: Props) {
  const nextActionIdx = steps.findIndex((step) => step.status === "next_action");
  const lastDoneIdx = steps.reduce(
    (acc, step, idx) => (step.status === "done" || step.status === "next_action" ? idx : acc),
    0,
  );
  const activeProgressIdx = nextActionIdx >= 0 ? nextActionIdx : lastDoneIdx;
  const progress = steps.length > 1 ? Math.max(0, activeProgressIdx) / (steps.length - 1) : 1;

  const pathD =
    "M31 5 C42 7 69 7 62 12 C56 17 35 16 43 20 C53 24 78 23 69 29 C61 34 27 32 36 38 C44 43 67 41 58 46 C49 51 25 50 32 55 C43 60 76 57 66 63 C58 68 39 67 47 72 C56 77 80 74 70 80 C61 85 30 83 39 88 C47 92 68 90 59 94 C55 96 50 97 47 98";

  return (
    <div className="w-full max-w-[820px] mx-auto px-1 py-1 font-sans">
      <header className="relative mb-4 sm:mb-6 pr-20 sm:pr-28">
        <div className="relative inline-block">
          <h1 className="font-display text-[30px] sm:text-[38px] font-normal leading-[1.02] text-foreground">
            Le parcours de {tripName}
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-2 w-[150px] pointer-events-none opacity-85"
          />
        </div>
        <p className="pt-3 text-xs sm:text-sm text-muted-foreground max-w-[430px]">
          Toutes les étapes du voyage, au même endroit. On avance à votre rythme.
        </p>
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          className="absolute -right-1 -top-3 w-[78px] sm:w-[108px] h-auto object-contain pointer-events-none select-none"
        />
      </header>

      <div className="relative pt-4 pb-3 sm:pt-6 sm:pb-5 overflow-visible h-[930px] sm:h-[1030px] lg:h-[1080px]">
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
            strokeWidth="1.15"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="opacity-30"
          />
          <path
            d={pathD}
            pathLength="100"
            stroke="var(--secondary)"
            strokeWidth="2.1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress * 100 }}
          />
        </svg>

        <div className="absolute left-[8%] top-[28%] hidden sm:block pointer-events-none">
          <KrewNote variant="label" tone="cream" rotation={-4} className="px-3 py-1.5 text-xs">
            Ça prend forme
          </KrewNote>
        </div>

        <div className="absolute right-[7%] top-[68%] hidden sm:block pointer-events-none">
          <KrewMark type="underline-wave" tone="plum" size="sm" className="w-16 rotate-[-12deg] opacity-60" />
        </div>

        {steps.map((step, index) => {
          const fallbackY = steps.length > 1 ? 5 + (92 * index) / (steps.length - 1) : 50;
          const point = PATH_POINTS[index] ?? {
            x: index % 3 === 0 ? 38 : index % 3 === 1 ? 62 : 49,
            y: fallbackY,
          };
          const isDone = step.status === "done";
          const isNextAction = step.status === "next_action";
          const isAvailable = step.status === "available";
          const isUpcoming = step.status === "upcoming";
          const directHref =
            step.id === "preferences"
              ? `/trips/${tripId}/questionnaire`
              : step.id === "profile"
                ? `/trips/${tripId}?view=voyage&section=profile`
                : null;
          const parsed = step.href ? parseStepHref(step.href) : null;

          const content = isNextAction ? (
            <div className="group relative w-[240px] sm:w-[300px] rounded-[22px] border border-primary/25 bg-primary/5 px-4 py-4 sm:px-5 sm:py-5 shadow-sm transition-transform duration-150 hover:-translate-y-0.5">
              <div className="absolute -top-3 left-4 z-20 pointer-events-none">
                <KrewNote variant="label" tone="cream" rotation={-2} className="whitespace-nowrap px-3 py-1 text-xs sm:text-sm">
                  Prochaine étape
                </KrewNote>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <div className="relative shrink-0 flex size-12 sm:size-14 items-center justify-center rounded-2xl border border-primary/20 bg-background text-primary shadow-2xs">
                  <KrewIcon name={step.iconName} size="sm" tone="plum" className="size-6 sm:size-7" />
                  <KrewMark
                    type="underline-wave"
                    tone="plum"
                    size="sm"
                    className="absolute -right-4 -top-3 w-9 rotate-[-35deg] opacity-55 pointer-events-none"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[22px] sm:text-[27px] font-normal leading-tight text-foreground">
                    {step.title}
                  </h3>
                  {step.subtitle ? (
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-snug">{step.subtitle}</p>
                  ) : null}
                  <span className="mt-3 inline-flex min-h-[38px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground">
                    Continuer
                  </span>
                </div>
              </div>

              {annotationText ? (
                <div className="mt-3 pl-1">
                  <KrewNote variant="label" tone="cream" rotation={2} className="inline-block max-w-[210px] px-3 py-1.5 text-xs">
                    {annotationText}
                  </KrewNote>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              className={cn(
                "group relative flex w-[160px] sm:w-[220px] items-center gap-2.5 rounded-[18px] px-3 py-2.5 sm:px-3.5 sm:py-3 transition-all duration-150",
                isDone && "border border-secondary/25 bg-background shadow-2xs hover:-translate-y-0.5",
                isAvailable && "border border-primary/30 bg-background shadow-2xs hover:-translate-y-0.5",
                isUpcoming && "border border-border/55 bg-background/82 shadow-none",
              )}
            >
              <div
                className={cn(
                  "relative shrink-0 flex items-center justify-center rounded-xl",
                  isDone && "size-9 sm:size-10 bg-sage/18 text-primary",
                  isAvailable && "size-9 sm:size-10 bg-primary/8 text-primary",
                  isUpcoming && "size-8 sm:size-9 bg-primary/5 text-muted-foreground/65",
                )}
              >
                <KrewIcon
                  name={step.iconName}
                  size="sm"
                  tone={isDone || isAvailable ? "plum" : "muted"}
                  className={isUpcoming ? "size-4.5" : "size-5"}
                />
                {isDone ? (
                  <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-secondary text-white text-[9px] font-bold shadow-2xs">
                    ✓
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  className={cn(
                    "font-display text-[16px] sm:text-[18px] font-normal leading-tight",
                    isDone && "text-foreground/90",
                    isAvailable && "text-foreground group-hover:text-primary",
                    isUpcoming && "text-muted-foreground/70",
                  )}
                >
                  {step.title}
                </h3>
                {isDone ? (
                  <span className="mt-0.5 block text-[10px] sm:text-[11px] font-medium text-secondary">Terminé</span>
                ) : isAvailable ? (
                  <span className="mt-0.5 block text-[10px] sm:text-[11px] font-medium text-primary/75">Disponible</span>
                ) : (
                  <span className="mt-0.5 block text-[10px] sm:text-[11px] text-muted-foreground/55">À venir</span>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={step.id}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2",
                isNextAction && "z-20",
              )}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
