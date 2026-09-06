import { createContext, useContext, type ReactNode } from "react";

import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { cn } from "@/lib/utils";

type KrewJourneyPageHeaderProps = {
  tripName: string;
  title: string;
  otterSrc: string;
  children?: ReactNode;
  titleLeading?: ReactNode;
  titleTrailing?: ReactNode;
  annotation?: ReactNode;
  className?: string;
  waveClassName?: string;
};

const KrewJourneyAfterHeaderContext = createContext<ReactNode>(null);

export function KrewJourneyAfterHeaderProvider({
  afterHeader,
  children,
}: {
  afterHeader: ReactNode;
  children: ReactNode;
}) {
  return (
    <KrewJourneyAfterHeaderContext.Provider value={afterHeader}>
      {children}
    </KrewJourneyAfterHeaderContext.Provider>
  );
}

export function KrewJourneyPageHeader({
  tripName,
  title,
  otterSrc,
  children,
  titleLeading,
  titleTrailing,
  annotation,
  className,
}: KrewJourneyPageHeaderProps) {
  const afterHeader = useContext(KrewJourneyAfterHeaderContext);
  const hasTitleDecor = Boolean(titleLeading || titleTrailing);
  const titleBlock = (
    <div data-krew-journey-title-block className="relative inline-block max-w-full pb-3">
      <h1
        data-krew-journey-title
        className={cn(
          "font-display text-[length:var(--krew-journey-page-title)] font-normal leading-[var(--krew-journey-title-leading)] tracking-[var(--krew-journey-title-tracking)] text-foreground",
          hasTitleDecor && "flex items-center gap-2",
        )}
      >
        {hasTitleDecor ? (
          <>
            {titleLeading}
            <span>{title}</span>
            {titleTrailing}
          </>
        ) : (
          title
        )}
      </h1>
      <KrewMark
        type="underline-wave"
        tone="sage"
        size="md"
        className="pointer-events-none absolute bottom-0 left-0 w-[var(--krew-journey-wave-width)] max-w-[80%] opacity-78"
      />
    </div>
  );

  return (
    <>
      <header data-krew-journey-header className={cn("relative space-y-[var(--krew-journey-header-stack-gap)]", className)}>
        <div className="grid grid-cols-[minmax(0,1fr)_var(--krew-journey-otter-slot-width)] items-start gap-[var(--krew-journey-header-column-gap)]">
          <div className="min-w-0">
            <div data-krew-journey-trip-context className="mb-1 flex items-center gap-1.5">
              <p className="text-[13px] font-semibold leading-[1.35] text-muted-foreground">
                {tripName}
              </p>
              <KrewMark type="sparkle" tone="sage" size="sm" className="h-4 w-5 opacity-70" />
            </div>
            {annotation ? (
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                {titleBlock}
                <div data-krew-journey-annotation className="shrink-0 pt-0.5">{annotation}</div>
              </div>
            ) : (
              titleBlock
            )}
          </div>

          <div
            data-krew-journey-otter-slot
            className="flex h-[var(--krew-journey-otter-height)] w-[var(--krew-journey-otter-slot-width)] items-start justify-end justify-self-end"
          >
            <img
              src={otterSrc}
              alt=""
              className="pointer-events-none h-full w-auto max-w-full object-contain object-top"
            />
          </div>
        </div>

        {children ? (
          <div
            data-krew-journey-intro
            className="max-w-[var(--krew-journey-intro-width)] space-y-2 pt-1 font-sans text-[length:var(--krew-journey-subtitle)] leading-[var(--krew-journey-intro-leading)] text-muted-foreground [&_p]:text-[length:var(--krew-journey-subtitle)] [&_p]:leading-[var(--krew-journey-intro-leading)] [&_p]:text-muted-foreground"
          >
            {children}
          </div>
        ) : null}
      </header>
      {afterHeader}
    </>
  );
}
