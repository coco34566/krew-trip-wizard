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

const CATEGORY_ORDER: StepCategory[] = ["questionnaire", "prepare", "organisation", "souvenirs"];

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

const CATEGORY_COPY: Record<StepCategory, string> = {
  questionnaire: "Le groupe se forme, partage ses disponibilités et pose ses envies.",
  prepare: "Les réponses de la Krew deviennent peu à peu un vrai voyage.",
  organisation: "Les grandes décisions sont prises : place aux derniers préparatifs.",
  souvenirs: "Une fois le voyage vécu, KREW garde une place pour les moments partagés.",
};

const CATEGORY_MARK: Record<StepCategory, "connector-curve" | "route" | "arrow-curved-right" | "heart"> = {
  questionnaire: "connector-curve",
  prepare: "route",
  organisation: "arrow-curved-right",
  souvenirs: "heart",
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

function StepStatus({ step, historical }: { step: TimelineStep; historical: boolean }) {
  if (step.status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sage">
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
    return <span className="text-[12px] font-medium text-muted-foreground/60">À venir</span>;
  }
  return null;
}

function StepNode({ step, historical }: { step: TimelineStep; historical: boolean }) {
  const isDone = step.status === "done";
  const isCurrent = !historical && step.status === "next_action";
  const isAvailable = step.status === "available";
  const isUpcoming = !historical && step.status === "upcoming";

  return (
    <div
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center rounded-full bg-background transition-transform sm:size-12",
        isDone && "border-2 border-sage",
        isAvailable && "border-2 border-primary/35",
        isCurrent && "border-[3px] border-primary shadow-[0_0_0_4px_hsl(var(--background))]",
        isUpcoming && "border border-border/80",
      )}
    >
      <KrewIcon
        name={step.iconName}
        size="sm"
        tone={isDone || isAvailable || isCurrent ? "plum" : "muted"}
        className={cn("size-5", isUpcoming && "size-[18px] opacity-55", isCurrent && "size-[22px]")}
      />
      {isDone ? (
        <span className="absolute -bottom-1 -right-1 flex size-[18px] items-center justify-center rounded-full bg-sage text-white">
          <KrewMark type="check" tone="ink" size="sm" className="h-2.5 w-2.5" />
        </span>
      ) : null}
      {isCurrent ? (
        <KrewMark
          type="scribble"
          tone="sage"
          size="lg"
          className="pointer-events-none absolute h-[62px] w-[68px] opacity-45"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function CurrentPositionNote() {
  return (
    <div className="pointer-events-none flex items-center gap-2 pb-2 sm:pb-3" aria-hidden="true">
      <KrewNote
        variant="sticky"
        tone="sage"
        rotation={-1}
        size="xs"
        className="min-w-[7rem] px-3 py-2 text-[12px] font-semibold sm:text-[13px]"
      >
        On en est ici
      </KrewNote>
      <KrewMark type="arrow-curved-down" tone="plum" size="sm" rotation={6} className="h-8 w-8 opacity-75" />
    </div>
  );
}

function StepRow({
  step,
  tripId,
  historical,
}: {
  step: TimelineStep;
  tripId: string;
  historical: boolean;
}) {
  const isCurrent = !historical && step.status === "next_action";
  const isUpcoming = !historical && step.status === "upcoming";
  const visibleSubtitle =
    !historical && step.id === "memories" && step.status === "upcoming"
      ? "Les souvenirs se débloqueront au moment du voyage."
      : step.subtitle;

  const directHref =
    step.id === "preferences"
      ? `/trips/${tripId}/questionnaire`
      : step.id === "profile"
        ? `/trips/${tripId}?view=voyage&section=profile`
        : step.id === "memories" && !isUpcoming
          ? `/trips/${tripId}/memories`
          : null;
  const parsed = step.href ? parseStepHref(step.href) : null;
  const canNavigate = Boolean(directHref || parsed) && !isUpcoming;

  const content = (
    <div
      className={cn(
        "group relative grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-4 sm:py-4",
        isCurrent && "rounded-[22px] border border-primary/15 bg-primary/[0.035] px-3 py-4 sm:px-4 sm:py-5",
        !isCurrent && "border-b border-border/45 last:border-b-0",
        canNavigate && "cursor-pointer",
      )}
    >
      <div className="relative flex justify-center">
        <StepNode step={step} historical={historical} />
        {!isCurrent ? (
          <span className="absolute bottom-[-17px] top-12 w-px bg-border/50 last:hidden" aria-hidden="true" />
        ) : null}
      </div>

      <div className="min-w-0">
        {isCurrent ? <CurrentPositionNote /> : null}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h3
            className={cn(
              "font-display font-normal leading-[1.03] text-foreground transition-colors",
              isCurrent ? "text-[25px] sm:text-[29px]" : "text-[19px] sm:text-[22px]",
              isUpcoming && "text-muted-foreground/65",
              canNavigate && "group-hover:text-primary",
            )}
          >
            {step.title}
          </h3>
          {!isCurrent ? <StepStatus step={step} historical={historical} /> : null}
        </div>

        {visibleSubtitle ? (
          <p className={cn("mt-1 max-w-[540px] text-[13px] leading-relaxed sm:text-[14px]", isUpcoming ? "text-muted-foreground/55" : "text-muted-foreground")}>{visibleSubtitle}</p>
        ) : null}

        {isCurrent && !historical ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-10 items-center gap-2 text-[13px] font-semibold text-primary">
              {stepActionLabel(step)}
              <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-6 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (directHref) {
    return (
      <Link to={directHref} className="block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2">
        {content}
      </Link>
    );
  }

  if (parsed) {
    return (
      <Link
        to={parsed.to}
        search={parsed.search as any}
        className="block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function ChapterIntro({
  category,
  chapterIndex,
  current,
  historical,
}: {
  category: StepCategory;
  chapterIndex: number;
  current: boolean;
  historical: boolean;
}) {
  const label = (historical ? HISTORICAL_CATEGORY_LABELS : CATEGORY_LABELS)[category];

  return (
    <div className="relative min-w-0 pr-2 md:pr-6">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/55">
          {String(chapterIndex + 1).padStart(2, "0")}
        </span>
        <span className="h-px w-8 bg-sage/55" aria-hidden="true" />
      </div>

      <h2 className={cn("mt-3 max-w-[270px] font-display text-[29px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground sm:text-[33px] lg:text-[37px]", current && "text-primary")}>{label}</h2>
      <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">{CATEGORY_COPY[category]}</p>

      <div className="mt-4 flex min-h-10 items-center gap-2" aria-hidden="true">
        <KrewMark type={CATEGORY_MARK[category]} tone={category === "souvenirs" ? "plum" : "sage"} size="lg" className="h-9 w-20 opacity-55" />
        {current && !historical ? <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/65">Chapitre en cours</span> : null}
      </div>
    </div>
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
        supabase.from("trips").select("owner_id, co_organizer_id").eq("id", tripId).maybeSingle(),
        supabase.from("trip_tasks" as any).select("status").eq("trip_id", tripId),
      ]);

      if (tripResult.error) throw tripResult.error;
      if (tasksResult.error) throw tasksResult.error;
      const trip = tripResult.data as any;
      return {
        isAdmin: Boolean(userId && trip && (trip.owner_id === userId || trip.co_organizer_id === userId)),
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
        subtitle: historical ? "Étape conservée pour mémoire" : "Étape gérée par l’organisateur·rice",
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
              (last, step, index) => (step.status === "done" || step.status === "available" ? index : last),
              0,
            ),
      );
  const progress = journeySteps.length > 1 ? (currentIndex / (journeySteps.length - 1)) * 100 : 100;
  const completedCount = journeySteps.filter((step) => step.status === "done").length;
  const currentStep = journeySteps[currentIndex];
  const currentCategory = currentStep?.category ?? null;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    steps: journeySteps.filter((step) => step.category === category),
  })).filter((group) => group.steps.length > 0);

  const uncategorized = journeySteps.filter((step) => !step.category);
  if (uncategorized.length > 0) {
    const firstGroup = grouped[0];
    if (firstGroup) firstGroup.steps = [...uncategorized, ...firstGroup.steps];
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] px-1 py-1 font-sans">
      <header className="relative border-b border-border/55 pb-7 sm:pb-9">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-end md:gap-10">
          <div>
            <KrewNote variant="margin" rotation={-1} className="mb-3 text-[14px] text-sage sm:text-[15px]">
              {historical ? "Historique du voyage" : "Notre feuille de route"}
            </KrewNote>
            <div className="relative inline-block max-w-full pb-2 pr-2">
              <h1 className="font-display text-[34px] font-normal leading-[.96] tracking-[-0.02em] text-foreground sm:text-[44px] lg:text-[48px]">
                Parcours de {tripName}
              </h1>
              <KrewMark type="underline-wave" tone="sage" size="lg" className="pointer-events-none absolute -bottom-2 left-1 w-[170px] opacity-75 sm:w-[220px]" />
            </div>
            <p className="mt-4 max-w-[590px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
              {historical
                ? "Les étapes du voyage restent accessibles comme historique, sans action de préparation à relancer."
                : "De la première idée aux souvenirs : vois ce que la Krew a déjà construit, où elle en est et ce qui vient ensuite."}
            </p>
          </div>

          <div className="relative rounded-[20px] border border-border/55 px-4 py-4 md:justify-self-end md:self-center">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Progression</span>
              <span className="font-display text-[25px] leading-none text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border/55" aria-hidden="true">
              <div className="h-full rounded-full bg-sage transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{completedCount}/{journeySteps.length} étapes terminées</p>
            <KrewMark type="sparkle" tone="sage" size="sm" className="pointer-events-none absolute -right-2 -top-2 h-5 w-5 opacity-55" aria-hidden="true" />
          </div>
        </div>
      </header>

      <ol className="divide-y divide-border/55">
        {grouped.map(({ category, steps: chapterSteps }, chapterIndex) => {
          const chapterCurrent = !historical && currentCategory === category;
          const isMemories = category === "souvenirs";

          return (
            <li key={category} className="relative py-8 sm:py-10 lg:py-12">
              <div className="grid gap-6 md:grid-cols-[minmax(210px,0.72fr)_minmax(0,1.45fr)] md:gap-10 lg:grid-cols-[minmax(240px,0.74fr)_minmax(0,1.5fr)] lg:gap-14">
                <ChapterIntro category={category} chapterIndex={chapterIndex} current={chapterCurrent} historical={historical} />

                <div className="relative min-w-0">
                  <div className="rounded-[24px] bg-sage/[0.025] px-1 sm:px-3">
                    {chapterSteps.map((step) => (
                      <StepRow key={step.id} step={step} tripId={tripId} historical={historical} />
                    ))}
                  </div>

                  {chapterCurrent ? (
                    <img
                      src="/brand/otter-states/trip-progress.png"
                      alt=""
                      className="pointer-events-none absolute -bottom-5 right-0 hidden w-[74px] object-contain opacity-95 sm:block lg:right-3 lg:w-[84px]"
                    />
                  ) : null}

                  {isMemories ? (
                    <img
                      src="/brand/otter-states/completed.png"
                      alt=""
                      className="pointer-events-none absolute -bottom-7 right-1 hidden w-[88px] object-contain opacity-90 md:block lg:right-5 lg:w-[104px]"
                    />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!historical ? (
        <div className="relative mt-2 flex items-center justify-end gap-2 pb-3 pr-1 text-right" aria-hidden="true">
          <KrewMark type="route" tone="sage" size="lg" className="h-8 w-24 opacity-35" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">La suite s’écrit avec la Krew</span>
        </div>
      ) : null}
    </div>
  );
}
