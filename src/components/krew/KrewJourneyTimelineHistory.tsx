import { Link } from "@tanstack/react-router";

import { KrewIcon, KrewMark, type KrewIconName } from "@/components/krew/visual-language";

export type HistoricalJourneyStep = {
  id: string;
  title: string;
  subtitle?: string | null | undefined;
  iconName: KrewIconName;
  href?: string | null | undefined;
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

function historicalHref(step: HistoricalJourneyStep, tripId: string) {
  if (step.id === "preferences") return { direct: `/trips/${tripId}/questionnaire` };
  if (step.id === "profile") return { direct: `/trips/${tripId}?view=voyage&section=profile` };
  if (step.id === "memories") return { direct: `/trips/${tripId}/memories` };
  if (step.href) return { parsed: parseStepHref(step.href) };
  return {};
}

export function KrewJourneyTimelineHistory({
  tripId,
  tripName,
  steps,
}: {
  tripId: string;
  tripName: string;
  steps: HistoricalJourneyStep[];
}) {
  return (
    <div className="mx-auto w-full max-w-[940px] px-1 py-1 font-sans" data-completed-trip="true">
      <header className="mb-7 border-b border-border/50 pb-5 sm:mb-9">
        <div className="relative inline-block max-w-full pb-2 pr-2">
          <h1 className="font-display text-[34px] font-normal leading-[.96] tracking-[-0.02em] text-foreground sm:text-[44px]">
            Histoire de {tripName}
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="lg"
            className="pointer-events-none absolute -bottom-2 left-1 w-[170px] opacity-75 sm:w-[210px]"
          />
        </div>
        <p className="mt-4 max-w-[620px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          Les étapes du voyage restent consultables comme historique. Les états de préparation et les urgences ne sont plus affichés.
        </p>
      </header>

      <ol className="divide-y divide-border/45 border-y border-border/45">
        {steps.map((step) => {
          const target = historicalHref(step, tripId);
          const content = (
            <div className="flex min-h-[72px] items-center gap-3 py-3 sm:gap-4 sm:py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sage/45 bg-sage/10">
                <KrewIcon name={step.iconName} tone="plum" size="sm" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl font-normal text-foreground sm:text-[22px]">{step.title}</h2>
                {step.subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{step.subtitle}</p> : null}
              </div>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-sage">Historique</span>
            </div>
          );

          return (
            <li key={step.id}>
              {target.direct ? (
                <a href={target.direct} className="group block no-underline hover:bg-surface/30">
                  {content}
                </a>
              ) : target.parsed ? (
                <Link to={target.parsed.to as any} search={target.parsed.search as any} className="group block no-underline hover:bg-surface/30">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
