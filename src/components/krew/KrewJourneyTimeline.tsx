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

function StepMeta({ step }: { step: TimelineStep }) {
  if (step.status === "done") {
    return <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">Terminé</span>;
  }
  if (step.status === "available") {
    return <span className="text-[12px] font-medium text-primary/75">Disponible</span>;
  }
  if (step.status === "upcoming") {
    return <span className="text-[12px] font-medium text-muted-foreground/65">À venir</span>;
  }
  return null;
}

function TimelineCopy({ step, next = false }: { step: TimelineStep; next?: boolean }) {
  return (
    <div className={cn("min-w-0", next ? "space-y-1.5" : "space-y-1")}> 
      {next ? (
        <KrewNote variant="tape" tone="sage" rotation={-1} size="sm" className="w-fit text-[13px]">
          Prochaine étape
        </KrewNote>
      ) : null}
      <h3
        className={cn(
          "font-display font-normal leading-[1.02] text-foreground",
          next ? "text-[25px] sm:text-[29px]" : "text-[19px] sm:text-[22px]",
          step.status === "upcoming" && "text-muted-foreground/70",
        )}
      >
        {step.title}
      </h3>
      {step.subtitle ? (
        <p className={cn("max-w-[310px] text-[13px] leading-relaxed", next ? "text-muted-foreground" : "text-muted-foreground/80")}>
          {step.subtitle}
        </p>
      ) : null}
      {next ? (
        <span className="inline-flex min-h-10 items-center gap-2 text-[13px] font-semibold text-primary">
          Continuer
          <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-6" />
        </span>
      ) : (
        <StepMeta step={step} />
      )}
    </div>
  );
}

export function KrewJourneyTimeline({ tripId, tripName, steps }: Props) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.status === "next_action") >= 0
      ? steps.findIndex((step) => step.status === "next_action")
      : steps.reduce((last, step, index) => (step.status === "done" || step.status === "available" ? index : last), 0),
  );
  const progress = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <div className="mx-auto w-full max-w-[940px] px-1 py-1 font-sans">
      <header className="relative mb-8 grid grid-cols-[minmax(0,1fr)_76px] items-start gap-4 sm:mb-10 sm:grid-cols-[minmax(0,1fr)_104px] sm:gap-8">
        <div className="min-w-0">
          <KrewNote variant="margin" rotation={-1} className="mb-1 text-sage">
            Notre feuille de route
          </KrewNote>
          <div className="relative inline-block max-w-full pb-2">
            <h1 className="font-display text-[34px] font-normal leading-[.96] tracking-[-0.02em] text-foreground sm:text-[44px]">
              Le parcours de {tripName}
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="lg"
              className="pointer-events-none absolute -bottom-2 left-1 w-[170px] opacity-75 sm:w-[210px]"
            />
          </div>
          <p className="mt-4 max-w-[540px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
            De la première idée aux souvenirs : chaque étape débloque naturellement la suivante.
          </p>
        </div>
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          className="pointer-events-none h-auto w-full max-w-[76px] justify-self-end object-contain sm:max-w-[104px]"
        />
      </header>

      <div className="relative">
        <div className="absolute bottom-6 left-[21px] top-6 w-px bg-border/70 sm:left-1/2 sm:-translate-x-1/2" aria-hidden="true">
          <div className="w-full bg-sage transition-[height] duration-300" style={{ height: `${progress}%` }} />
        </div>

        <ol className="space-y-3 sm:space-y-1">
          {steps.map((step, index) => {
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
                  "relative z-10 flex shrink-0 items-center justify-center rounded-full bg-background",
                  isDone && "size-[42px] border-2 border-sage text-primary",
                  isAvailable && "size-[42px] border-2 border-primary/55 text-primary",
                  isNextAction && "size-[46px] border-[3px] border-primary bg-primary text-primary-foreground ring-4 ring-primary/10",
                  isUpcoming && "size-[34px] border border-border text-muted-foreground/50",
                )}
              >
                <KrewIcon
                  name={step.iconName}
                  size="sm"
                  tone={isNextAction ? "cream" : isDone || isAvailable ? "plum" : "muted"}
                  className={isUpcoming ? "size-4" : "size-5"}
                />
                {isDone ? (
                  <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full bg-sage text-[11px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
              </div>
            );

            const copy = (
              <div
                className={cn(
                  "min-w-0 rounded-[18px] px-3 py-3 transition-colors sm:px-4 sm:py-4",
                  isNextAction && "border border-primary/15 bg-primary/[0.035] shadow-[0_5px_18px_rgba(60,35,50,.05)]",
                  !isNextAction && !isUpcoming && "hover:bg-sage/[0.035]",
                )}
              >
                <TimelineCopy step={step} next={isNextAction} />
              </div>
            );

            const content = (
              <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] sm:gap-5">
                <div className={cn("hidden sm:block", index % 2 === 0 ? "text-right" : "order-3")}>{index % 2 === 0 ? copy : null}</div>
                <div className="flex justify-center sm:col-start-2">{node}</div>
                <div className={cn("min-w-0", index % 2 === 0 ? "sm:col-start-3" : "sm:col-start-1 sm:row-start-1 sm:text-right")}>
                  {index % 2 === 0 ? <div className="sm:hidden">{copy}</div> : copy}
                </div>
              </div>
            );

            const wrapped = directHref ? (
              <a href={directHref} className="block rounded-[18px] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {content}
              </a>
            ) : parsed && !isUpcoming ? (
              <Link
                to={parsed.to as any}
                search={parsed.search as any}
                className="block rounded-[18px] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {content}
              </Link>
            ) : (
              content
            );

            return (
              <li key={step.id} className={cn("relative py-1 sm:py-2", isNextAction && "py-3 sm:py-4")}>
                {wrapped}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
