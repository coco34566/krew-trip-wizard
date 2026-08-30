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

type StepCategory = NonNullable<TimelineStep["category"]>;

const CATEGORY_LABELS: Record<StepCategory, string> = {
  questionnaire: "La Krew se rassemble",
  prepare: "Le voyage prend forme",
  organisation: "On prépare le départ",
  souvenirs: "Et après le voyage…",
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

function stepActionLabel(step: TimelineStep) {
  const labels: Record<string, string> = {
    availability: "Voir les disponibilités",
    preferences: "Voir les préférences",
    star: `Voir ${step.title.toLocaleLowerCase("fr-FR")}`,
    dates: "Voir les dates du groupe",
    profile: "Voir le Profil du voyage",
    destination: "Voir la destination",
    accommodation: "Voir l’hébergement",
    transport: "Voir le transport",
    planning: "Voir le planning",
    tasks: "Voir les tâches",
    packing: "Voir À emporter",
    memories: "Voir les souvenirs",
  };
  return labels[step.id] ?? `Voir ${step.title.toLocaleLowerCase("fr-FR")}`;
}

function StepMeta({ step }: { step: TimelineStep }) {
  if (step.status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-sage">
        <KrewMark type="stamp-circle" tone="sage" size="sm" className="h-4 w-5" />
        Terminé
      </span>
    );
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
  const visibleSubtitle =
    step.id === "memories" && step.status === "upcoming"
      ? "Les souvenirs se débloqueront au moment du voyage."
      : step.subtitle;

  return (
    <div className={cn("min-w-0", next ? "space-y-2" : "space-y-1")}>
      {next ? (
        <div className="mb-1 flex min-h-[50px] items-center gap-2.5 sm:gap-3">
          <img
            src="/brand/otter-states/trip-progress.png"
            alt=""
            className="pointer-events-none w-[46px] shrink-0 object-contain sm:w-[54px]"
          />
          <div className="min-w-0">
            <KrewNote
              variant="tape"
              tone="sage"
              rotation={-1}
              size="sm"
              className="w-fit text-[12px] sm:text-[13px]"
            >
              On en est ici
            </KrewNote>
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground/75">
              Prochaine étape de la Krew
            </span>
          </div>
        </div>
      ) : null}
      <h3
        className={cn(
          "font-display font-normal leading-[1.02] text-foreground transition-colors",
          next ? "text-[26px] sm:text-[30px]" : "text-[19px] sm:text-[22px]",
          step.status === "upcoming" && "text-muted-foreground/65",
          step.status !== "upcoming" && "group-hover:text-primary",
        )}
      >
        {step.title}
      </h3>
      {visibleSubtitle ? (
        <p
          className={cn(
            "max-w-[320px] text-[13px] leading-relaxed",
            next ? "text-muted-foreground" : "text-muted-foreground/80",
            step.status === "upcoming" && "text-muted-foreground/55",
          )}
        >
          {visibleSubtitle}
        </p>
      ) : null}
      {next ? (
        <span className="inline-flex min-h-10 items-center gap-2 text-[13px] font-semibold text-primary">
          {stepActionLabel(step)}
          <KrewMark
            type="arrow-right"
            tone="plum"
            size="sm"
            className="h-3.5 w-6 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      ) : (
        <StepMeta step={step} />
      )}
    </div>
  );
}

function ChapterMarker({ category, index }: { category: StepCategory; index: number }) {
  return (
    <div
      className="pointer-events-none relative z-20 grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 py-1.5 sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] sm:gap-5 sm:py-2"
      aria-hidden="true"
    >
      <div className="col-start-2 flex min-w-0 items-center gap-2 sm:col-span-2 sm:col-start-2">
        <KrewNote
          variant="label"
          tone={category === "souvenirs" ? "plum" : "sage"}
          rotation={index % 2 === 0 ? -1 : 1}
          size="xs"
          className="shrink-0 whitespace-nowrap text-[12px] sm:text-[13px]"
        >
          {CATEGORY_LABELS[category]}
        </KrewNote>
        <KrewMark
          type={category === "souvenirs" ? "sparkle" : "connector-curve"}
          tone={category === "souvenirs" ? "plum" : "sage"}
          size="sm"
          rotation={index % 2 === 0 ? -2 : 2}
          className="hidden h-5 w-12 opacity-40 min-[360px]:block sm:h-6 sm:w-14"
        />
      </div>
    </div>
  );
}

export function KrewJourneyTimeline({ tripId, tripName, steps }: Props) {
  const nextActionIndex = steps.findIndex((step) => step.status === "next_action");
  const currentIndex = Math.max(
    0,
    nextActionIndex >= 0
      ? nextActionIndex
      : steps.reduce(
          (last, step, index) => (step.status === "done" || step.status === "available" ? index : last),
          0,
        ),
  );
  const progress = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <div className="mx-auto w-full max-w-[940px] px-1 py-1 font-sans">
      <header className="relative mb-7 sm:mb-9">
        <KrewNote variant="margin" rotation={-1} className="mb-1 text-sage">
          Notre feuille de route
        </KrewNote>
        <div className="relative inline-block max-w-full pb-2 pr-2">
          <h1 className="font-display text-[34px] font-normal leading-[.96] tracking-[-0.02em] text-foreground sm:text-[44px]">
            Parcours de {tripName}
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="lg"
            className="pointer-events-none absolute -bottom-2 left-1 w-[170px] opacity-75 sm:w-[210px]"
          />
        </div>
        <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          De la première idée aux souvenirs : chaque étape raconte un bout du voyage et débloque naturellement la suivante.
        </p>
        <KrewMark
          type="route"
          tone="plum"
          size="lg"
          rotation={-2}
          className="pointer-events-none absolute right-3 top-1 hidden h-12 w-28 opacity-[0.16] sm:block lg:right-8"
        />
      </header>

      <div className="relative">
        <div
          className="absolute bottom-6 left-[21px] top-6 w-px bg-border/65 sm:left-1/2 sm:-translate-x-1/2"
          aria-hidden="true"
        >
          <div className="relative w-full bg-sage transition-[height] duration-300" style={{ height: `${progress}%` }}>
            {progress > 0 ? (
              <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-background bg-sage" />
            ) : null}
          </div>
        </div>

        <ol className="space-y-1 sm:space-y-0">
          {steps.map((step, index) => {
            const isDone = step.status === "done";
            const isNextAction = step.status === "next_action";
            const isAvailable = step.status === "available";
            const isUpcoming = step.status === "upcoming";
            const startsCategory = Boolean(
              step.category && (index === 0 || step.category !== steps[index - 1]?.category),
            );
            const directHref =
              step.id === "preferences"
                ? `/trips/${tripId}/questionnaire`
                : step.id === "profile"
                  ? `/trips/${tripId}?view=voyage&section=profile`
                  : step.id === "memories" && !isUpcoming
                    ? `/trips/${tripId}/memories`
                    : null;
            const parsed = step.href ? parseStepHref(step.href) : null;

            const node = (
              <div className="relative z-10 flex shrink-0 items-center justify-center bg-background">
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full bg-background transition-transform",
                    isDone && "size-[42px] border-2 border-sage text-primary",
                    isAvailable && "size-[42px] border-2 border-primary/50 text-primary",
                    isNextAction &&
                      "size-[46px] border-[3px] border-primary bg-background text-primary shadow-[0_0_0_5px_hsl(var(--background))]",
                    isUpcoming && "size-[34px] border border-border/80 text-muted-foreground/45",
                  )}
                >
                  <KrewIcon
                    name={step.iconName}
                    size="sm"
                    tone={isDone || isAvailable || isNextAction ? "plum" : "muted"}
                    className={cn(isUpcoming ? "size-4" : "size-5", isNextAction && "size-[22px]")}
                  />
                  {isDone ? (
                    <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full bg-sage text-white">
                      <KrewMark type="check" tone="ink" size="sm" className="h-2.5 w-3.5 text-white" />
                    </span>
                  ) : null}
                  {isNextAction ? (
                    <KrewMark
                      type="scribble"
                      tone="sage"
                      size="sm"
                      rotation={-2}
                      className="pointer-events-none absolute -inset-x-4 -bottom-5 h-4 w-[74px] opacity-55"
                    />
                  ) : null}
                </div>
              </div>
            );

            const copy = (
              <div
                className={cn(
                  "min-w-0 px-2 py-3 sm:px-4 sm:py-4",
                  isNextAction && "py-4 sm:py-5",
                  isUpcoming && "select-none",
                )}
              >
                <TimelineCopy step={step} next={isNextAction} />
              </div>
            );

            const content = (
              <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] sm:gap-5">
                <div className={cn("hidden sm:block", index % 2 === 0 ? "text-right" : "order-3")}>
                  {index % 2 === 0 ? copy : null}
                </div>
                <div className="flex justify-center sm:col-start-2">{node}</div>
                <div
                  className={cn(
                    "min-w-0",
                    index % 2 === 0 ? "sm:col-start-3" : "sm:col-start-1 sm:row-start-1 sm:text-right",
                  )}
                >
                  {index % 2 === 0 ? <div className="sm:hidden">{copy}</div> : copy}
                </div>
              </div>
            );

            const interactionClassName = cn(
              "group block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isUpcoming && "pointer-events-none",
            );

            const wrapped = directHref ? (
              <a href={directHref} className={interactionClassName}>
                {content}
              </a>
            ) : parsed && !isUpcoming ? (
              <Link to={parsed.to as any} search={parsed.search as any} className={interactionClassName}>
                {content}
              </Link>
            ) : (
              <div className="group">{content}</div>
            );

            return (
              <li key={step.id} className={cn("relative py-1 sm:py-2", isNextAction && "py-2 sm:py-3")}>
                {startsCategory && step.category ? <ChapterMarker category={step.category} index={index} /> : null}
                {wrapped}
              </li>
            );
          })}
        </ol>

        <div
          className="pointer-events-none ml-[8px] mt-1 flex items-center gap-2 pl-[44px] sm:ml-0 sm:justify-center sm:pl-0"
          aria-hidden="true"
        >
          <KrewMark type="arrow-down" tone="sage" size="sm" className="h-7 w-5 opacity-55" />
          <span className="text-[11px] font-medium text-muted-foreground/55">La suite s’écrit avec la Krew</span>
        </div>
      </div>
    </div>
  );
}
