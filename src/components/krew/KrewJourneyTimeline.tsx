import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  KrewIcon,
  KrewMark,
  KrewNote,
  KrewOrganicBlob,
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

/* Hand-composed positions: deliberately neither alternating nor evenly spaced.
 * The route should feel drawn in a travel notebook, while every label remains readable. */
const DESKTOP_POINTS = [
  { x: 18, y: 7, side: "right" },
  { x: 47, y: 13, side: "right" },
  { x: 73, y: 21, side: "left" },
  { x: 57, y: 30, side: "left" },
  { x: 25, y: 37, side: "right" },
  { x: 36, y: 47, side: "right" },
  { x: 69, y: 53, side: "left" },
  { x: 77, y: 63, side: "left" },
  { x: 49, y: 70, side: "right" },
  { x: 22, y: 77, side: "right" },
  { x: 31, y: 87, side: "right" },
  { x: 62, y: 91, side: "left" },
  { x: 79, y: 97, side: "left" },
] as const;

const MOBILE_POINTS = [
  { x: 22, y: 6, side: "right" },
  { x: 60, y: 13, side: "left" },
  { x: 72, y: 21, side: "left" },
  { x: 42, y: 29, side: "right" },
  { x: 20, y: 37, side: "right" },
  { x: 37, y: 46, side: "right" },
  { x: 72, y: 53, side: "left" },
  { x: 68, y: 62, side: "left" },
  { x: 38, y: 70, side: "right" },
  { x: 19, y: 78, side: "right" },
  { x: 38, y: 87, side: "right" },
  { x: 70, y: 92, side: "left" },
  { x: 57, y: 98, side: "left" },
] as const;

const desktopPath =
  "M18 7 C27 5 39 9 47 13 C58 18 75 14 73 21 C71 27 61 25 57 30 C49 37 32 31 25 37 C18 43 28 47 36 47 C48 47 60 49 69 53 C79 57 83 60 77 63 C69 67 57 66 49 70 C38 75 28 72 22 77 C16 83 24 88 31 87 C43 85 53 89 62 91 C70 93 76 95 79 97";

const mobilePath =
  "M22 6 C35 6 51 9 60 13 C72 17 79 17 72 21 C64 26 49 24 42 29 C33 35 22 31 20 37 C18 43 29 45 37 46 C50 47 64 48 72 53 C80 58 76 62 68 62 C55 62 45 66 38 70 C29 75 18 73 19 78 C20 84 31 86 38 87 C49 88 61 89 70 92 C74 94 65 97 57 98";

function StepLabel({
  step,
  side,
}: {
  step: TimelineStep;
  side: "left" | "right";
}) {
  const isDone = step.status === "done";
  const isAvailable = step.status === "available";
  const isUpcoming = step.status === "upcoming";

  return (
    <div
      className={cn(
        "absolute top-1/2 flex -translate-y-1/2 items-center gap-2.5",
        side === "right" ? "left-[calc(100%+9px)]" : "right-[calc(100%+9px)] flex-row-reverse text-right",
      )}
    >
      <div className="min-w-0 w-[116px] sm:w-[150px]">
        <div
          className={cn(
            "font-display text-[15px] sm:text-[18px] leading-[1.05] transition-colors",
            isDone && "text-foreground/85",
            isAvailable && "text-primary",
            isUpcoming && "text-muted-foreground/60",
          )}
        >
          {step.title}
        </div>
        {step.category === "souvenirs" && step.subtitle ? (
          <span className="mt-1 block max-w-[116px] sm:max-w-[150px] text-[10px] sm:text-[11px] leading-snug text-muted-foreground/75">{step.subtitle}</span>
        ) : null}
        {isDone ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-sage">
            Terminé
          </span>
        ) : isAvailable ? (
          <span className="mt-1 block text-[9px] sm:text-[10px] font-medium text-primary/65">Disponible</span>
        ) : null}
      </div>
    </div>
  );
}

export function KrewJourneyTimeline({ tripId, tripName, steps }: Props) {
  return (
    <div className="w-full max-w-[900px] mx-auto px-1 py-1 font-sans">
      <header className="relative mb-2 sm:mb-3 min-h-[105px] sm:min-h-[130px] pr-[92px] sm:pr-[150px]">
        <KrewNote variant="margin" rotation={-2} className="mb-1 text-sage">
          notre feuille de route
        </KrewNote>
        <div className="relative inline-block max-w-full">
          <h1 className="font-display text-[31px] sm:text-[42px] font-normal leading-[.98] text-foreground">
            Le parcours de {tripName}
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="lg"
            className="absolute -bottom-5 left-1 w-[170px] sm:w-[210px] opacity-75 pointer-events-none"
          />
        </div>
        <p className="pt-5 max-w-[460px] text-xs sm:text-sm leading-relaxed text-muted-foreground">
          De la première idée aux souvenirs : le chemin se construit avec toute la KREW.
        </p>
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          className="absolute right-0 top-0 w-[88px] sm:w-[132px] h-auto object-contain pointer-events-none select-none"
        />
      </header>

      <div className="relative mx-auto h-[1080px] sm:h-[1160px] w-full overflow-visible">
        <KrewOrganicBlob
          tone="sage"
          variant="soft"
          className="absolute left-[4%] top-[15%] h-[145px] w-[210px] sm:h-[190px] sm:w-[310px] opacity-35"
        />
        <KrewOrganicBlob
          tone="plum"
          variant="soft"
          className="absolute right-[2%] top-[55%] h-[120px] w-[180px] sm:h-[170px] sm:w-[260px] opacity-[.035]"
        />

        <svg
          aria-hidden="true"
          className="absolute inset-0 hidden h-full w-full sm:block pointer-events-none overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d={desktopPath}
            stroke="var(--sage)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity=".7"
          />
        </svg>
        <svg
          aria-hidden="true"
          className="absolute inset-0 block h-full w-full sm:hidden pointer-events-none overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d={mobilePath}
            stroke="var(--sage)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity=".7"
          />
        </svg>

        <div className="absolute left-[6%] top-[24%] hidden sm:block pointer-events-none">
          <KrewNote variant="torn" tone="cream" rotation={-4} className="px-3 py-2 shadow-sm">
            on avance ensemble
          </KrewNote>
        </div>
        <KrewMark
          type="arrow-curved-right"
          tone="sage"
          size="lg"
          rotation={-2}
          className="absolute left-[18%] top-[28%] hidden w-20 sm:block opacity-55 pointer-events-none"
        />
        <div className="absolute right-[5%] top-[74%] hidden sm:block pointer-events-none">
          <KrewNote variant="margin" rotation={2}>la suite se dessine ici</KrewNote>
        </div>
        <KrewMark
          type="sparkle"
          tone="plum"
          size="sm"
          rotation={4}
          className="absolute right-[14%] top-[84%] hidden sm:block opacity-45 pointer-events-none"
        />

        {steps.map((step, index) => {
          const desktopPoint = DESKTOP_POINTS[index] ?? DESKTOP_POINTS[DESKTOP_POINTS.length - 1];
          const mobilePoint = MOBILE_POINTS[index] ?? MOBILE_POINTS[MOBILE_POINTS.length - 1];
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

          const node = (
            <div
              className={cn(
                "relative flex items-center justify-center rounded-full bg-background transition-transform duration-150",
                isDone && "size-10 sm:size-11 border-[2px] border-sage text-primary shadow-[0_2px_10px_rgba(60,35,50,.06)]",
                isAvailable && "size-10 sm:size-11 border-[2px] border-primary/55 text-primary shadow-[0_2px_10px_rgba(60,35,50,.06)]",
                isUpcoming && "size-8 sm:size-9 border border-border text-muted-foreground/45",
              )}
            >
              <KrewIcon
                name={step.iconName}
                size="sm"
                tone={isDone || isAvailable ? "plum" : "muted"}
                className={isUpcoming ? "size-4" : "size-5"}
              />
              {isDone ? (
                <span className="absolute -bottom-1 -right-1 flex size-[17px] items-center justify-center rounded-full bg-sage text-white text-[9px] font-bold">
                  ✓
                </span>
              ) : null}
            </div>
          );

          const regularContent = (
            <div className="group relative hover:-translate-y-0.5 transition-transform duration-150">
              {node}
              <div className="hidden sm:block">
                <StepLabel step={step} side={desktopPoint.side} />
              </div>
              <div className="block sm:hidden">
                <StepLabel step={step} side={mobilePoint.side} />
              </div>
            </div>
          );

          const memoriesContent = (
            <div className="relative w-[190px] sm:w-[238px] -translate-x-1/2 -translate-y-1/2 rotate-[-1deg] bg-background px-3 pb-4 pt-3 shadow-[0_10px_28px_rgba(60,35,50,.08)] ring-1 ring-border/45 sm:px-4 sm:pb-5">
              <div className="mb-3 flex h-[68px] items-center justify-center bg-sage/10 sm:h-[82px]">
                <KrewIcon name="camera" tone="plum" size="lg" className="size-8 opacity-65" />
              </div>
              <h3 className="font-display text-[20px] sm:text-[24px] leading-[1.02] text-foreground">
                {step.title}
              </h3>
              {step.subtitle ? (
                <p className="mt-1.5 text-[11px] sm:text-xs leading-snug text-muted-foreground">
                  {step.subtitle}
                </p>
              ) : null}
              <KrewNote
                variant="margin"
                rotation={2}
                className="absolute -bottom-5 right-1 text-[15px] text-sage"
              >
                À vivre bientôt
              </KrewNote>
            </div>
          );

          const nextContent = (
            <div className="relative w-[174px] sm:w-[228px] -translate-x-1/2 -translate-y-1/2">
              <KrewNote
                variant="label"
                tone="plum"
                rotation={-2}
                className="relative z-10 mb-2 text-[.76rem] sm:text-[.88rem]"
              >
                Prochaine étape
              </KrewNote>
              <KrewMark
                type="arrow-curved-right"
                tone="sage"
                size="sm"
                className="absolute left-8 top-7 z-20 h-7 w-10 rotate-[18deg] pointer-events-none"
              />
              <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 rounded-[46%_54%_48%_52%/54%_46%_56%_44%] bg-background/95 px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-[0_4px_16px_rgba(60,35,50,.05)]">
                <div className="flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/10">
                  <KrewIcon name={step.iconName} size="sm" tone="cream" className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-[20px] sm:text-[25px] leading-[1] text-foreground">{step.title}</h3>
                  {step.subtitle ? (
                    <p className="mt-1 text-[10px] sm:text-[11px] leading-snug text-muted-foreground">{step.subtitle}</p>
                  ) : null}
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-primary">
                    Continuer
                    <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-6" />
                  </span>
                </div>
              </div>
            </div>
          );

          const content =
            step.category === "souvenirs"
              ? memoriesContent
              : isNextAction
                ? nextContent
                : regularContent;
          const wrapper = (child: React.ReactNode) =>
            directHref ? (
              <a href={directHref} className="block no-underline">{child}</a>
            ) : parsed && !isUpcoming ? (
              <Link to={parsed.to as any} search={parsed.search as any} className="block no-underline">{child}</Link>
            ) : (
              child
            );

          return (
            <div key={step.id}>
              <div
                className={cn("absolute z-10 hidden sm:block", isNextAction ? "z-30" : "-translate-x-1/2 -translate-y-1/2")}
                style={{ left: `${desktopPoint.x}%`, top: `${desktopPoint.y}%` }}
              >
                {wrapper(content)}
              </div>
              <div
                className={cn("absolute z-10 block sm:hidden", isNextAction ? "z-30" : "-translate-x-1/2 -translate-y-1/2")}
                style={{ left: `${mobilePoint.x}%`, top: `${mobilePoint.y}%` }}
              >
                {wrapper(content)}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
