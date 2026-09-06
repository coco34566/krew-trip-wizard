import type { ReactNode } from "react";

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

export function KrewJourneyPageHeader({
  tripName,
  title,
  otterSrc,
  children,
  titleLeading,
  titleTrailing,
  annotation,
  className,
  waveClassName,
}: KrewJourneyPageHeaderProps) {
  const hasTitleDecor = Boolean(titleLeading || titleTrailing);
  const titleBlock = (
    <div className="relative inline-block max-w-full pb-3">
      <h1
        className={cn(
          "font-display text-[34px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground sm:text-[40px]",
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
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 w-[140px] max-w-[80%] opacity-78",
          waveClassName,
        )}
      />
    </div>
  );

  return (
    <header data-krew-journey-header className={cn("relative space-y-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_76px] items-start gap-4 sm:grid-cols-[minmax(0,1fr)_88px] sm:gap-6">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <p className="text-[13px] font-semibold leading-[1.35] text-muted-foreground">
              {tripName}
            </p>
            <KrewMark type="sparkle" tone="sage" size="sm" className="h-4 w-5 opacity-70" />
          </div>
          {annotation ? (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              {titleBlock}
              <div className="shrink-0 pt-0.5">{annotation}</div>
            </div>
          ) : (
            titleBlock
          )}
        </div>

        <div className="flex h-[76px] w-[76px] items-start justify-end justify-self-end sm:h-[88px] sm:w-[88px]">
          <img
            src={otterSrc}
            alt=""
            className="pointer-events-none max-h-full max-w-full object-contain"
          />
        </div>
      </div>

      {children ? (
        <div
          data-krew-journey-intro
          className="max-w-[42rem] space-y-2 pt-1 font-sans text-[14px] leading-[1.55] text-muted-foreground sm:text-[15px] [&_p]:text-[14px] [&_p]:leading-[1.55] [&_p]:text-muted-foreground sm:[&_p]:text-[15px]"
        >
          {children}
        </div>
      ) : null}
    </header>
  );
}
