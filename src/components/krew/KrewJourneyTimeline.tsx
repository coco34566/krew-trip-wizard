import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTripLifecycleState } from "@/lib/krew/trip-lifecycle-context";
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

const HISTORICAL_CATEGORY_LABELS: Record<StepCategory, string> = {
  questionnaire: "Les choix du groupe",
  prepare: "Le voyage préparé",
  organisation: "Organisation du voyage",
  souvenirs: "Souvenirs du voyage",
};

const CATEGORY_NUMBERS: Record<StepCategory, string> = {
  questionnaire: "01",
  prepare: "02",
  organisation: "03",
  souvenirs: "04",
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

function StepMeta({ step, historical }: { step: TimelineStep; historical: boolean }) {
  if (step.status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sage sm:text-[12px]">
        <KrewMark type="stamp-circle" tone="sage" size="sm" className="h-4 w-5" />
        Terminé
      </span>
    );
  }
  if (historical) {
    return <span className="text-[12px] font-medium text-muted-foreground">Consultation</span>;
  }
  if (step.status === "available") {
    return <span className="text-[12px] font-medium text-primary/75">Disponible</span>;
  }
  if (step.status === "upcoming") {
    return <span className="text-[12px] font-medium text-muted-foreground/65">À venir</span>;
  }
  return null;
}

function TimelineCopy({
  step,
  next = false,
  historical = false,
}: {
  step: TimelineStep;
  next?: boolean;
  historical?: boolean;
}) {
  const visibleSubtitle =
    !historical && step.id === "memories" && step.status === "upcoming"
      ? "Les souvenirs se débloqueront au moment du voyage."
      : step.subtitle;

  return (
    <div className={cn("min-w-0", next ? "space-y-2.5" : "space-y-1.5")}>
      <h3
        className={cn(
          "font-display font-normal leading-[1.02] text-foreground transition-colors",
          next ? "text-[27px] sm:text-[31px]" : "text-[20px] sm:text-[23px]",
          !historical && step.status === "upcoming" && "text-muted-foreground/60",
          (historical || step.status !== "upcoming") && "group-hover:text-primary",
        )}
      >
        {step.title}
      </h3>

      {visibleSubtitle ? (
        <p
          className={cn(
            "max-w-[340px] text-[13px] leading-relaxed sm:text-[13.5px]",
            next ? "text-muted-foreground" : "text-muted-foreground/80",
            !historical && step.status === "upcoming" && "text-muted-foreground/50",
          )}
        >
          {visibleSubtitle}
        </p>
      ) : null}

      {next && !historical ? (
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
        <StepMeta step={step} historical={historical} />
      )}
    </div>
  );
}

function CurrentPositionCallout() {
  return (
    <div
      className="pointer-events-none relative flex min-h-[72px] items-end gap-1 sm:min-h-0 sm:items-center"
      aria-hidden="true"
    >
      <KrewNote
        variant="sticky"
        tone="sage"
        rotation={-1}
        size="xs"
        className="min-w-[7rem] px-3 py-2 text-[13px] sm:min-w-[7.5rem] sm:text-[13px]"
      >
        On en est ici
      </KrewNote>
      <KrewMark
        type="arrow-curved-down"
        tone="plum"
        size="sm"
        rotation={2}
        className="mb-[-8px] h-9 w-9 opacity-75 sm:mb-0 sm:h-8 sm:w-10 sm:-rotate-90"
      />
    </div>
  );
}

function StepNode({
  step,
  historical,
}: {
  step: TimelineStep;
  historical: boolean;
}) {
  const isDone = step.status === "done";
  const isNextAction = !historical && step.status === "next_action";
  const isAvailable = step.status === "available";
  const isUpcoming = !historical && step.status === "upcoming";

  return (
    <div
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full bg-background",
        isDone && "size-[42px] border-2 border-sage text-primary",
        isAvailable && "size-[42px] border-2 border-primary/45 text-primary",
        isNextAction &&
          "size-[48px] border-[3px] border-primary bg-background text-primary shadow-[0_0_0_6px_hsl(var(--background))]",
        isUpcoming && "size-[34px] border border-border/80 text-muted-foreground/45",
      )}
      aria-hidden="true"
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
        <>
          <KrewMark
            type="circle-loose"
            tone="sage"
            size="md"
            rotation={-2}
            className="pointer-events-none absolute -inset-[14px] h-[76px] w-[76px] opacity-60"
          />
          <KrewMark
            type="scribble"
            tone="sage"
            size="sm"
            rotation={2}
            className="pointer-events-none absolute -bottom-6 left-1/2 h-4 w-[78px] -translate-x-1/2 opacity-45"
          />
        </>
      ) : null}
    </div>
  );
}

function JourneyStep({
  step,
  historical,
  tripId,
  layout = "left",
  className,
}: {
  step: TimelineStep;
  historical: boolean;
  tripId: string;
  layout?: "left" | "right";
  className?: string;
}) {
  const isNextAction = !historical && step.status === "next_action";
  const isUpcoming = !historical && step.status === "upcoming";

  const directHref =
    step.id === "preferences"
      ? `/trips/${tripId}/questionnaire`
      : step.id === "profile"
        ? `/trips/${tripId}?view=voyage&section=profile`
        : step.id === "memories" && !isUpcoming
          ? `/trips/${tripId}/memories`
          : null;

  const parsed = step.href ? parseStepHref(step.href) : null;

  const content = (
    <div
      className={cn(
        "relative grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-4",
        layout === "right" && "sm:grid-cols-[minmax(0,1fr)_56px]",
      )}
    >
      {layout === "right" ? (
        <>
          <div className="hidden min-w-0 sm:block sm:text-right">
            <TimelineCopy step={step} next={isNextAction} historical={historical} />
          </div>
          <div className="flex justify-center sm:col-start-2">
            <StepNode step={step} historical={historical} />
          </div>
          <div className="min-w-0 sm:hidden">
            <TimelineCopy step={step} next={isNextAction} historical={historical} />
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <StepNode step={step} historical={historical} />
          </div>
          <div className="min-w-0">
            <TimelineCopy step={step} next={isNextAction} historical={historical} />
          </div>
        </>
      )}
    </div>
  );

  const interactionClassName = cn(
    "group block rounded-md no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
    <li className={cn("relative min-w-0", className)}>
      {isNextAction ? (
        <div className="mb-1 ml-[54px] sm:absolute sm:right-[calc(100%+20px)] sm:top-1/2 sm:mb-0 sm:ml-0 sm:-translate-y-1/2">
          <CurrentPositionCallout />
        </div>
      ) : null}
      {wrapped}
    </li>
  );
}

function ChapterHeading({
  category,
  historical,
  align = "left",
  className,
}: {
  category: StepCategory;
  historical: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const label = (historical ? HISTORICAL_CATEGORY_LABELS : CATEGORY_LABELS)[category];

  return (
    <div
      className={cn(
        "pointer-events-none relative isolate min-h-[96px] sm:min-h-[128px]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "absolute top-[-22px] -z-10 select-none font-display text-[96px] leading-none tracking-[-0.08em] text-primary/[0.055] sm:top-[-36px] sm:text-[154px] lg:text-[180px]",
          align === "left" && "-left-2 sm:-left-6",
          align === "right" && "-right-2 sm:-right-7",
          align === "center" && "left-1/2 -translate-x-1/2",
        )}
      >
        {CATEGORY_NUMBERS[category]}
      </span>

      <h2
        className={cn(
          "relative max-w-[11ch] font-display text-[31px] font-normal leading-[0.92] tracking-[-0.025em] text-foreground sm:text-[43px] lg:text-[50px]",
          align === "right" && "ml-auto",
          align === "center" && "mx-auto",
        )}
      >
        {label}
      </h2>
    </div>
  );
}

function SceneConnector({
  type = "connector-curve",
  className,
  rotation = 0,
  tone = "sage",
}: {
  type?: "connector" | "connector-curve" | "connector-dotted" | "route" | "pin-line" | "arrow-curved-right";
  className?: string;
  rotation?: -4 | -2 | 0 | 2 | 4;
  tone?: "plum" | "sage";
}) {
  return (
    <KrewMark
      type={type}
      tone={tone}
      size="lg"
      rotation={rotation}
      className={cn("pointer-events-none absolute opacity-30", className)}
    />
  );
}

export function KrewJourneyTimeline({ tripId, tripName, steps }: Props) {
  const lifecycle = useTripLifecycleState();
  const historical = lifecycle === "completed";

  const roleAndTasksQuery = useQuery({
    queryKey: ["journey-role-tasks", tripId],
    queryFn: async () => {
      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id ?? null;
      const [tripResult, tasksResult] = await Promise.all([
        supabase
          .from("trips")
          .select("owner_id, co_organizer_id")
          .eq("id", tripId)
          .maybeSingle(),
        supabase.from("trip_tasks" as any).select("status").eq("trip_id", tripId),
      ]);

      if (tripResult.error) throw tripResult.error;
      if (tasksResult.error) throw tasksResult.error;
      const trip = tripResult.data as any;

      return {
        isAdmin: Boolean(
          userId && trip && (trip.owner_id === userId || trip.co_organizer_id === userId),
        ),
        taskStatuses: ((tasksResult.data ?? []) as any[]).map((task) => String(task.status)),
      };
    },
    retry: false,
    staleTime: 30_000,
  });

  const effectiveSteps = steps.map((step) => {
    if (step.id === "star" && roleAndTasksQuery.data?.isAdmin !== true) {
      if (step.status === "done") return { ...step, href: null };
      return {
        ...step,
        href: null,
        status: "upcoming" as const,
        subtitle: historical
          ? "Étape conservée pour mémoire"
          : "Étape gérée par l’organisateur·rice",
      };
    }

    if (step.id === "tasks") {
      const statuses = roleAndTasksQuery.data?.taskStatuses ?? [];
      if (statuses.length > 0) {
        const completed = statuses.filter((status) => status === "done").length;
        const allDone = completed === statuses.length;
        return {
          ...step,
          subtitle: historical
            ? `Dernier état enregistré : ${completed}/${statuses.length} terminée${statuses.length > 1 ? "s" : ""}`
            : `${completed}/${statuses.length} terminée${statuses.length > 1 ? "s" : ""}`,
          status: allDone
            ? ("done" as const)
            : step.status === "next_action"
              ? ("next_action" as const)
              : ("available" as const),
        };
      }
    }

    return step;
  });

  const journeySteps = historical
    ? effectiveSteps.map((step) => ({
        ...step,
        status: step.status === "done" ? ("done" as const) : ("available" as const),
      }))
    : effectiveSteps;

  const nextActionIndex = journeySteps.findIndex((step) => step.status === "next_action");
  const currentIndex = historical
    ? Math.max(0, journeySteps.length - 1)
    : Math.max(
        0,
        nextActionIndex >= 0
          ? nextActionIndex
          : journeySteps.reduce(
              (last, step, index) =>
                step.status === "done" || step.status === "available" ? index : last,
              0,
            ),
      );

  const progress =
    journeySteps.length > 1 ? (currentIndex / (journeySteps.length - 1)) * 100 : 100;

  const grouped = {
    questionnaire: journeySteps.filter((step) => step.category === "questionnaire"),
    prepare: journeySteps.filter((step) => step.category === "prepare"),
    organisation: journeySteps.filter((step) => step.category === "organisation"),
    souvenirs: journeySteps.filter((step) => step.category === "souvenirs"),
  } satisfies Record<StepCategory, TimelineStep[]>;

  return (
    <div className="mx-auto w-full max-w-[1080px] overflow-hidden px-1 py-1 font-sans">
      <header className="relative mb-10 sm:mb-14">
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
          {historical
            ? "Les étapes du voyage restent accessibles comme historique, sans action de préparation à relancer."
            : "De la première idée aux souvenirs : chaque étape raconte un bout du voyage et débloque naturellement la suivante."}
        </p>

        <KrewNote
          variant="margin"
          rotation={-1}
          className="mt-3 text-[17px] leading-tight text-sage sm:text-[18px]"
        >
          {historical ? "Historique du voyage" : "Notre feuille de route"}
        </KrewNote>

        <KrewMark
          type="route"
          tone="plum"
          size="lg"
          rotation={-2}
          className="pointer-events-none absolute right-3 top-1 hidden h-12 w-28 opacity-[0.14] sm:block lg:right-8"
        />
      </header>

      <div
        className="sr-only"
        aria-label={`Progression du parcours : ${Math.round(progress)} %`}
      />

      <ol className="relative space-y-16 sm:space-y-24 lg:space-y-28">
        <li className="list-none">
          <section className="relative isolate px-1 sm:px-5 lg:px-10">
            <ChapterHeading category="questionnaire" historical={historical} align="left" />
            <SceneConnector
              type="connector-curve"
              className="left-[46%] top-[76px] hidden h-16 w-32 sm:block lg:left-[40%] lg:w-44"
              rotation={-2}
            />
            <SceneConnector
              type="connector-dotted"
              className="right-[6%] top-[26px] hidden h-14 w-28 opacity-20 lg:block"
              rotation={2}
              tone="plum"
            />

            <div className="relative mt-2 max-w-[680px] space-y-2 sm:ml-[10%] sm:mt-4 sm:space-y-3 lg:ml-[13%]">
              {grouped.questionnaire.map((step, index) => (
                <JourneyStep
                  key={step.id}
                  step={step}
                  historical={historical}
                  tripId={tripId}
                  layout={index % 3 === 2 ? "right" : "left"}
                  className={cn(
                    "max-w-[520px]",
                    index === 1 && "sm:ml-16",
                    index === 2 && "sm:ml-24",
                    index >= 3 && "sm:ml-10",
                  )}
                />
              ))}
            </div>
          </section>
        </li>

        <li className="list-none">
          <section className="relative isolate min-h-[460px] px-1 sm:px-5 lg:px-10">
            <ChapterHeading
              category="prepare"
              historical={historical}
              align="right"
              className="sm:pr-[5%] lg:pr-[9%]"
            />

            <SceneConnector
              type="route"
              className="left-[12%] top-[82px] hidden h-24 w-[44%] sm:block"
              rotation={2}
              tone="plum"
            />
            <SceneConnector
              type="connector-curve"
              className="right-[18%] top-[210px] hidden h-20 w-40 sm:block lg:right-[24%]"
              rotation={-2}
            />

            {!historical ? (
              <img
                src="/brand/otter-states/trip-preparation.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute right-[-14px] top-[138px] hidden w-[120px] object-contain opacity-95 sm:block lg:right-[3%] lg:w-[150px]"
              />
            ) : null}

            <div className="relative mt-2 grid gap-y-3 sm:mt-6 sm:grid-cols-2 sm:gap-x-16 sm:gap-y-7 lg:gap-x-24">
              {grouped.prepare.map((step, index) => (
                <JourneyStep
                  key={step.id}
                  step={step}
                  historical={historical}
                  tripId={tripId}
                  layout={index % 2 === 0 ? "left" : "right"}
                  className={cn(
                    "max-w-[480px]",
                    index % 2 === 1 && "sm:mt-14",
                    index === 2 && "sm:ml-8 lg:ml-16",
                  )}
                />
              ))}
            </div>
          </section>
        </li>

        <li className="list-none">
          <section className="relative isolate px-1 sm:px-5 lg:px-10">
            <ChapterHeading
              category="organisation"
              historical={historical}
              align="left"
              className="sm:pl-[4%]"
            />
            <SceneConnector
              type="arrow-curved-right"
              className="left-[45%] top-[76px] hidden h-20 w-36 sm:block lg:left-[42%] lg:w-44"
              rotation={2}
              tone="plum"
            />
            <SceneConnector
              type="connector-dotted"
              className="right-[8%] top-[160px] hidden h-16 w-32 opacity-20 lg:block"
              rotation={-2}
            />

            <div className="relative mt-1 grid gap-3 sm:mt-5 sm:grid-cols-[1fr_0.9fr] sm:gap-x-14 sm:gap-y-5 lg:grid-cols-[1fr_1fr_0.85fr] lg:gap-x-12">
              {grouped.organisation.map((step, index) => (
                <JourneyStep
                  key={step.id}
                  step={step}
                  historical={historical}
                  tripId={tripId}
                  layout={index === 1 ? "right" : "left"}
                  className={cn(
                    "max-w-[470px]",
                    index === 1 && "sm:mt-16 lg:mt-24",
                    index === 2 && "sm:col-span-2 sm:ml-[18%] lg:col-span-1 lg:ml-0 lg:mt-10",
                  )}
                />
              ))}
            </div>
          </section>
        </li>

        <li className="list-none">
          <section className="relative isolate min-h-[330px] px-1 pb-8 sm:px-5 sm:pb-12 lg:px-10">
            <ChapterHeading
              category="souvenirs"
              historical={historical}
              align="right"
              className="sm:pr-[8%]"
            />

            <SceneConnector
              type="pin-line"
              className="left-[18%] top-[122px] hidden h-16 w-40 sm:block"
              rotation={-2}
            />

            <img
              src="/brand/otter-states/completed.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-[-8px] hidden w-[112px] object-contain opacity-90 sm:block lg:right-[7%] lg:w-[138px]"
            />

            <div className="relative mt-2 max-w-[560px] sm:ml-[12%] sm:mt-6 lg:ml-[19%]">
              {grouped.souvenirs.map((step) => (
                <JourneyStep
                  key={step.id}
                  step={step}
                  historical={historical}
                  tripId={tripId}
                  layout="left"
                  className="max-w-[520px]"
                />
              ))}
            </div>

            {!historical ? (
              <div
                className="pointer-events-none mt-7 flex items-center gap-2 pl-[54px] sm:mt-10 sm:pl-[12%]"
                aria-hidden="true"
              >
                <KrewMark
                  type="arrow-down"
                  tone="sage"
                  size="sm"
                  className="h-7 w-5 opacity-55"
                />
                <span className="text-[11px] font-medium text-muted-foreground/55">
                  La suite s’écrit avec la Krew
                </span>
              </div>
            ) : null}
          </section>
        </li>
      </ol>
    </div>
  );
}
