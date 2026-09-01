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

const CATEGORY_MARK: Record<StepCategory, "connector-curve" | "route" | "arrow-loop" | "heart"> = {
  questionnaire: "connector-curve",
  prepare: "route",
  organisation: "arrow-loop",
  souvenirs: "heart",
};

const STEP_HELPER_COPY: Record<string, string> = {
  availability: "Chacun indique les dates où il peut partir.",
  preferences: "La Krew partage ses envies, son budget et ses priorités.",
  dates: "La Krew confirme les dates qui fonctionnent pour le groupe.",
  profile: "Les réponses du groupe dessinent le style du voyage.",
  destination: "La Krew choisit où partir ensemble.",
  accommodation: "La Krew choisit où poser ses valises.",
  transport: "Chacun organise son trajet pour rejoindre le groupe.",
  planning: "Le programme du séjour se construit jour après jour.",
  packing: "La Krew prépare ce qu’il faut emporter avant le départ.",
  memories: "Les photos et moments forts du voyage seront réunis ici.",
};

const STEP_UNLOCK_COPY: Record<string, string> = {
  preferences: "Se débloque quand les disponibilités du groupe sont prêtes.",
  dates: "Se débloque quand les disponibilités permettent de fixer les dates.",
  profile: "Se débloque quand les préférences du groupe sont renseignées.",
  destination: "Se débloque quand le Profil du voyage est validé.",
  accommodation: "Se débloque une fois la destination choisie.",
  transport: "Se débloque une fois la destination et les dates validées.",
  planning: "Se débloque quand les éléments principaux du voyage sont validés.",
  tasks: "Se débloque quand l’organisation du voyage commence à prendre forme.",
  packing: "Se débloque quand le départ approche et que l’organisation est avancée.",
  memories: "Se débloque au moment du voyage.",
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

function stepSupportingCopy(step: TimelineStep, historical: boolean) {
  if (!historical && step.status === "upcoming") {
    return STEP_UNLOCK_COPY[step.id] ?? "Se débloque une fois l’étape précédente terminée.";
  }
  if (step.id === "tasks" && step.subtitle) return step.subtitle;
  return STEP_HELPER_COPY[step.id] ?? step.subtitle;
}

function StepStatus({ step, historical }: { step: TimelineStep; historical: boolean }) {
  if (step.status === "done") {
    return <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sage">Fait</span>;
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
        isDone && "border-2 border-sage/80",
        isAvailable && "border-2 border-primary/35",
        isCurrent && "border-[3px] border-primary bg-sage/20 shadow-[0_0_0_4px_hsl(var(--background))]",
        isUpcoming && "border border-border/80",
      )}
    >
      <KrewIcon
        name={step.iconName}
        size="sm"
        tone={isDone || isAvailable || isCurrent ? "plum" : "muted"}
        className={cn("size-5", isUpcoming && "size-[18px] opacity-55", isCurrent && "size-[23px]")}
      />
      {isDone ? (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-sage" aria-hidden="true" />
      ) : null}
    </div>
  );
}

function CurrentPositionNote() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-10 h-11 w-[104px] sm:w-[116px]" aria-hidden="true">
      <div className="absolute right-0 top-0 rotate-[12deg]">
        <KrewNote
          variant="sticky"
          tone="sage"
          rotation={0}
          size="xs"
          className="min-w-[5.6rem] px-2 py-1.5 text-[10px] font-semibold shadow-sm sm:min-w-[6rem] sm:text-[11px]"
        >
          On en est ici
        </KrewNote>
      </div>
      <KrewMark
        type="arrow-curved-left"
        tone="plum"
        size="sm"
        className="absolute left-0 top-[25px] h-6 w-9 -rotate-6 opacity-95 sm:top-[27px] sm:h-7 sm:w-10"
      />
    </div>
  );
}

function StepRow({ step, tripId, historical }: { step: TimelineStep; tripId: string; historical: boolean }) {
  const isCurrent = !historical && step.status === "next_action";
  const isUpcoming = !historical && step.status === "upcoming";
  const visibleSubtitle = stepSupportingCopy(step, historical);

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
        !isCurrent && "border-b border-border/40 last:border-b-0",
        isCurrent && "my-2 py-4 sm:my-3 sm:py-5",
        canNavigate && "cursor-pointer",
      )}
    >
      <div className="relative flex justify-center">
        <StepNode step={step} historical={historical} />
        {!isCurrent ? <span className="absolute bottom-[-17px] top-12 w-px bg-border/45 last:hidden" aria-hidden="true" /> : null}
      </div>

      <div className="min-w-0 pt-0.5">
        <div className={cn("relative flex min-h-11 items-center sm:min-h-12", isCurrent && "pr-[102px] sm:pr-[116px]")}> 
          <div className="relative inline-block max-w-full">
            {isCurrent ? (
              <KrewMark
                type="highlight"
                tone="sage"
                size="lg"
                className="pointer-events-none absolute -bottom-1 -left-1 z-0 h-[34px] w-[calc(100%+10px)] min-w-[88px] opacity-85 sm:h-[38px]"
                aria-hidden="true"
              />
            ) : null}
            <h3
              className={cn(
                "relative z-10 font-display font-normal leading-[1.03] text-foreground transition-colors",
                isCurrent ? "text-[28px] text-primary sm:text-[31px]" : "text-[19px] sm:text-[22px]",
                isUpcoming && "text-muted-foreground/65",
                canNavigate && "group-hover:text-primary",
              )}
            >
              {step.title}
            </h3>
          </div>
          {isCurrent ? <CurrentPositionNote /> : <div className="ml-auto pl-4"><StepStatus step={step} historical={historical} /></div>}
        </div>

        {visibleSubtitle ? (
          <p
            className={cn(
              "mt-1 max-w-[540px] text-[13px] leading-relaxed sm:text-[14px]",
              isUpcoming ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
          >
            {visibleSubtitle}
          </p>
        ) : null}

        {isCurrent && !historical ? (
          <div className="mt-2.5">
            <span className="inline-flex min-h-9 items-center gap-2 text-[13px] font-semibold text-primary">
              {stepActionLabel(step)}
              <KrewMark
                type="arrow-right"
                tone="plum"
                size="sm"
                className="h-3.5 w-6 translate-y-px transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (directHref) {
    return (
      <Link to={directHref} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2">
        {content}
      </Link>
    );
  }

  if (parsed) {
    return (
      <Link
        to={parsed.to}
        search={parsed.search as any}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function ChapterIntro({ category, chapterIndex, current, historical }: { category: StepCategory; chapterIndex: number; current: boolean; historical: boolean }) {
  const label = (historical ? HISTORICAL_CATEGORY_LABELS : CATEGORY_LABELS)[category];

  return (
    <div className="relative min-w-0 pr-1 md:pr-6">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/55">
          {String(chapterIndex + 1).padStart(2, "0")}
        </span>
        {current && !historical ? (
          <span className="rounded-full bg-sage/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-sage">En cours</span>
        ) : null}
      </div>

      <div className="mt-2 flex items-start gap-2">
        <h2
          className={cn(
            "max-w-[270px] font-display text-[29px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground sm:text-[33px] lg:text-[37px]",
            current && "text-primary",
          )}
        >
          {label}
        </h2>
        <KrewMark
          type={CATEGORY_MARK[category]}
          tone={category === "souvenirs" ? "plum" : "sage"}
          size="sm"
          className={cn(
            "mt-0.5 shrink-0 opacity-85",
            category === "prepare"
              ? "h-7 w-10"
              : category === "organisation"
                ? "h-7 w-10"
                : category === "souvenirs"
                  ? "h-6 w-7"
                  : "h-6 w-8",
          )}
          aria-hidden="true"
        />
      </div>

      <p className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">{CATEGORY_COPY[category]}</p>
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

  const mobileTitleSize =
    `Parcours de ${tripName}`.length > 32
      ? "text-[20px]"
      : `Parcours de ${tripName}`.length > 27
        ? "text-[22px]"
        : `Parcours de ${tripName}`.length > 22
          ? "text-[25px]"
          : "text-[29px]";

  return (
    <div className="mx-auto w-full max-w-[1040px] px-1 py-1 font-sans">
      <header className="relative border-b border-border/55 pb-6 sm:pb-9">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-end md:gap-10">
          <div>
            <div className="relative max-w-full pb-2">
              <h1
                className={cn(
                  "whitespace-nowrap font-display font-normal leading-[.98] tracking-[-0.025em] text-foreground sm:text-[44px] lg:text-[48px]",
                  mobileTitleSize,
                )}
              >
                Parcours de {tripName}
              </h1>
              <KrewMark type="underline-wave" tone="sage" size="lg" className="pointer-events-none absolute -bottom-2 left-1 w-[140px] opacity-75 sm:w-[220px]" />
            </div>
            <p className="mt-3 max-w-[590px] text-[13px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-[15px]">
              {historical
                ? "Les étapes du voyage restent accessibles comme historique, sans action de préparation à relancer."
                : "De la première idée aux souvenirs : vois ce que la Krew a déjà construit, où elle en est et ce qui vient ensuite."}
            </p>
          </div>

          <div className="relative rounded-[18px] border border-border/50 px-3 py-3 md:justify-self-end md:self-center md:py-3.5">
            <div className="flex items-center gap-3">
              <img
                src="/brand/otter-states/trip-progress.png"
                alt=""
                className="pointer-events-none w-[92px] shrink-0 object-contain sm:w-[104px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Progression</span>
                  <span className="font-display text-[23px] leading-none text-primary sm:text-[25px]">{Math.round(progress)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/55" aria-hidden="true">
                  <div className="h-full rounded-full bg-sage transition-[width] duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{completedCount}/{journeySteps.length} étapes terminées</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="pb-1 pt-5 sm:pt-6">
        <KrewNote variant="margin" rotation={-2} className="text-[21px] font-semibold text-sage sm:text-[23px]">
          {historical ? "Historique du voyage" : "Notre feuille de route"}
        </KrewNote>
      </div>

      <ol className="divide-y divide-border/50">
        {grouped.map(({ category, steps: chapterSteps }, chapterIndex) => {
          const chapterCurrent = !historical && currentCategory === category;

          return (
            <li key={category} className="relative py-6 sm:py-8 lg:py-10">
              <div className="grid gap-4 md:grid-cols-[minmax(210px,0.72fr)_minmax(0,1.45fr)] md:gap-10 lg:grid-cols-[minmax(240px,0.74fr)_minmax(0,1.5fr)] lg:gap-14">
                <ChapterIntro category={category} chapterIndex={chapterIndex} current={chapterCurrent} historical={historical} />

                <div className="relative min-w-0">
                  <div className="px-0 sm:px-2">
                    {chapterSteps.map((step) => (
                      <StepRow key={step.id} step={step} tripId={tripId} historical={historical} />
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {!historical ? (
        <div className="relative -mt-5 pb-3 pt-0 text-right sm:-mt-6" aria-hidden="true">
          <img
            src="/brand/otter-states/completed.png"
            alt=""
            className="pointer-events-none absolute bottom-0 left-0 w-[76px] object-contain opacity-95 sm:w-[88px]"
          />
          <span className="inline-block whitespace-nowrap font-mono font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground/75 text-[clamp(12px,3.8vw,16px)] sm:text-[18px]">
            La suite s’écrit avec la Krew
          </span>
        </div>
      ) : null}
    </div>
  );
}
