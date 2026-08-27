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
    const [key, value] = pair.split("=");
    if (key) search[key] = decodeURIComponent(value || "");
  }
  return { to: path, search };
}

const offsets = ["md:-translate-x-5", "md:translate-x-7", "md:-translate-x-1", "md:translate-x-11", "md:-translate-x-8"];

function StepConnector({ index, muted }: { index: number; muted: boolean }) {
  const bendsRight = index % 4 === 0 || index % 4 === 3;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 116"
      preserveAspectRatio="none"
      className={cn(
        "absolute left-[18px] top-9 h-[calc(100%+2px)] w-8 overflow-visible md:left-1/2 md:w-16 md:-translate-x-1/2",
        muted ? "opacity-30" : "opacity-70",
      )}
    >
      <path
        d={bendsRight ? "M25 0 C57 28 8 72 35 116" : "M35 0 C7 30 57 72 25 116"}
        fill="none"
        stroke="var(--sage)"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function JourneyNode({ step }: { step: TimelineStep }) {
  const isCurrent = step.status === "next_action";
  const isDone = step.status === "done";
  const isAvailable = step.status === "available";

  return (
    <span
      className={cn(
        "relative z-20 flex shrink-0 items-center justify-center rounded-full bg-background transition duration-200 motion-reduce:transition-none",
        isCurrent && "size-12 border-2 border-primary bg-primary text-primary-foreground shadow-[0_0_0_7px_color-mix(in_oklch,var(--sage)_22%,transparent)] md:size-14",
        isDone && "size-9 border-2 border-sage text-primary md:size-10",
        isAvailable && "size-10 border-2 border-primary/45 text-primary hover:border-primary",
        step.status === "upcoming" && "size-8 border border-border/70 text-muted-foreground/50",
      )}
    >
      <KrewIcon
        name={step.iconName}
        size="sm"
        tone={isCurrent ? "cream" : isDone || isAvailable ? "plum" : "muted"}
        className={cn(isCurrent ? "size-6" : step.status === "upcoming" ? "size-4" : "size-5")}
      />
      {isDone ? (
        <span className="absolute -bottom-1.5 -right-1.5 flex size-[19px] items-center justify-center rounded-full bg-sage text-[11px] font-bold text-white shadow-sm" aria-label="Terminé">
          ✓
        </span>
      ) : null}
    </span>
  );
}

function StepCopy({ step }: { step: TimelineStep }) {
  const isCurrent = step.status === "next_action";
  const isDone = step.status === "done";
  return (
    <div className={cn("min-w-0", step.status === "upcoming" && "opacity-55")}>
      <h2 className={cn("font-display font-normal leading-[1.02] text-foreground", isCurrent ? "text-[27px] md:text-[34px]" : "text-[21px] md:text-[25px]")}>
        {step.title}
      </h2>
      {step.subtitle ? (
        <p className={cn("mt-1.5 max-w-[32rem] text-[13px] leading-snug text-muted-foreground md:text-sm", isCurrent && "text-foreground/70")}>
          {step.subtitle}
        </p>
      ) : null}
      {isDone ? (
        <span className="mt-2 inline-flex items-center gap-1.5 font-hand text-[15px] leading-none text-sage">
          C’est fait
          <KrewMark type="check" tone="sage" size="sm" className="h-4 w-5" />
        </span>
      ) : step.status === "available" ? (
        <span className="mt-2 block text-xs font-medium text-primary/70">Accessible maintenant</span>
      ) : step.status === "upcoming" && step.category !== "souvenirs" ? (
        <span className="mt-2 block text-xs text-muted-foreground">La suite du parcours</span>
      ) : null}
    </div>
  );
}

export function KrewJourneyTimeline({ tripId, tripName, steps, annotationText = "Prochaine étape" }: Props) {
  const currentIndex = steps.findIndex((step) => step.status === "next_action");

  return (
    <section className="relative mx-auto w-full max-w-[980px] overflow-hidden px-4 pb-12 pt-2 sm:px-6 md:overflow-visible md:px-8">
      <header className="relative min-h-[185px] pr-0 md:min-h-[220px] md:pr-[190px]">
        <div className="relative z-10 max-w-[660px]">
          <h1 className="font-display text-[32px] font-normal leading-[.98] text-foreground sm:text-[38px] md:text-[44px]">
            Parcours de {tripName}
          </h1>
          <KrewMark type="underline-wave" tone="sage" size="lg" className="mt-1 h-5 w-[170px] opacity-75 sm:w-[210px]" />
          <p className="mt-3 max-w-[510px] text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            De la première idée aux souvenirs, voici où en est votre voyage.
          </p>
        </div>

        <div className="absolute right-1 top-[112px] z-20 sm:right-4 md:right-[126px] md:top-[106px]">
          <KrewNote variant="torn" tone="cream" rotation={-2} className="px-3 py-2 font-hand text-[16px] shadow-sm">
            Notre feuille de route
          </KrewNote>
          <KrewMark type="arrow-curved-right" tone="sage" size="sm" className="absolute -bottom-7 left-2 h-8 w-12 rotate-[18deg] opacity-70" />
        </div>
        <img
          src="/brand/otter-states/trip-progress.png"
          alt=""
          className="absolute right-0 top-0 hidden h-auto w-[122px] object-contain md:block lg:w-[145px]"
        />
      </header>

      <div className="relative mt-2 md:mt-0">
        <KrewOrganicBlob tone="sage" variant="soft" className="absolute -left-20 top-[22%] h-52 w-72 opacity-25" />
        <KrewOrganicBlob tone="plum" variant="soft" className="absolute -right-16 top-[60%] hidden h-48 w-64 opacity-[.035] md:block" />

        {steps.map((step, index) => {
          const isCurrent = step.status === "next_action";
          const isMemories = step.category === "souvenirs";
          const isLast = index === steps.length - 1;
          const parsed = step.href ? parseStepHref(step.href) : null;
          const directHref = step.id === "preferences"
            ? `/trips/${tripId}/questionnaire`
            : step.id === "profile"
              ? `/trips/${tripId}?view=voyage&section=profile`
              : null;

          const row = (
            <div
              className={cn(
                "group relative grid min-h-[116px] grid-cols-[48px_minmax(0,1fr)] items-start gap-3 py-4 md:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] md:items-center md:gap-6 md:py-5",
                offsets[index % offsets.length],
                isCurrent && "min-h-[190px] py-7 md:min-h-[220px] md:py-8",
                isMemories && "mt-4 min-h-[180px] py-8 md:mt-8 md:min-h-[210px]",
              )}
            >
              {!isLast ? <StepConnector index={index} muted={index >= currentIndex && currentIndex >= 0} /> : null}

              <div className="col-start-1 row-start-1 flex justify-center pt-0.5 md:col-start-2 md:items-center md:pt-0">
                <JourneyNode step={step} />
              </div>

              <div
                className={cn(
                  "col-start-2 row-start-1 min-w-0 pt-0.5 md:pt-0",
                  index % 2 === 0 ? "md:col-start-3 md:text-left" : "md:col-start-1 md:text-right",
                  isCurrent && "relative",
                )}
              >
                {isCurrent ? (
                  <div className="relative max-w-[500px] py-2 md:inline-block md:min-w-[330px] md:py-5 md:text-left">
                    <KrewOrganicBlob tone="sage" variant="soft" className="absolute -inset-x-8 -inset-y-5 -z-10 opacity-55 md:-inset-x-12" />
                    <KrewNote variant="label" tone="plum" rotation={-2} className="mb-3 inline-flex px-3 py-1.5 font-hand text-[16px]">
                      {annotationText}
                    </KrewNote>
                    <KrewMark type={index % 2 === 0 ? "arrow-curved-left" : "arrow-curved-right"} tone="sage" size="sm" className="absolute -left-10 top-4 hidden h-10 w-12 opacity-70 md:block" />
                    <StepCopy step={step} />
                    <span className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md group-active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
                      Continuer
                      <KrewMark type="arrow-right" tone="cream" size="sm" className="h-4 w-7" />
                    </span>
                    <img src="/brand/otter-states/trip-progress.png" alt="" className="absolute -right-[118px] bottom-0 hidden w-[105px] object-contain lg:block" />
                  </div>
                ) : isMemories ? (
                  <div className="relative inline-block max-w-[360px] rotate-[-1deg] bg-background px-4 pb-5 pt-4 shadow-[0_10px_28px_rgba(60,35,50,.08)] ring-1 ring-border/45 md:px-5 md:pb-6">
                    <div className="mb-4 flex h-20 items-center justify-center bg-sage/10 md:h-24">
                      <KrewIcon name="camera" tone="plum" size="lg" className="size-9 opacity-65" />
                    </div>
                    <StepCopy step={step} />
                    <KrewNote variant="margin" rotation={2} className="absolute -bottom-5 right-2 text-[15px] text-sage">
                      À vivre bientôt
                    </KrewNote>
                  </div>
                ) : (
                  <div className="inline-block max-w-[390px] transition duration-150 group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
                    <StepCopy step={step} />
                  </div>
                )}
              </div>
            </div>
          );

          if (directHref && step.status !== "upcoming") {
            return <a key={step.id} href={directHref} className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">{row}</a>;
          }
          if (parsed && step.status !== "upcoming") {
            return (
              <Link key={step.id} to={parsed.to as any} search={parsed.search as any} className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
                {row}
              </Link>
            );
          }
          return <div key={step.id}>{row}</div>;
        })}

        <KrewMark type="arrow-down" tone="sage" size="sm" className="ml-[7px] mt-1 h-9 w-10 rotate-[-8deg] opacity-65 md:mx-auto" />
      </div>
    </section>
  );
}
