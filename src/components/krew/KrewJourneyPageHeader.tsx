import type { ReactNode } from "react";

import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { cn } from "@/lib/utils";

type KrewJourneyPageHeaderProps = {
  tripName: string;
  title: string;
  otterSrc: string;
  children?: ReactNode;
  className?: string;
  waveClassName?: string;
};

export function KrewJourneyPageHeader({
  tripName,
  title,
  otterSrc,
  children,
  className,
  waveClassName,
}: KrewJourneyPageHeaderProps) {
  return (
    <header className={cn("relative space-y-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_72px] items-start gap-4 sm:grid-cols-[minmax(0,1fr)_96px] sm:gap-6">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <p className="text-[13px] font-semibold leading-[1.35] text-muted-foreground">
              {tripName}
            </p>
            <KrewMark type="sparkle" tone="sage" size="sm" className="h-4 w-5 opacity-70" />
          </div>
          <div className="relative inline-block max-w-full pb-2">
            <h1 className="font-display text-[34px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground sm:text-[40px]">
              {title}
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className={cn(
                "pointer-events-none absolute -bottom-1 left-0 w-[140px] max-w-[80%] opacity-78",
                waveClassName,
              )}
            />
          </div>
        </div>

        <div className="relative justify-self-end">
          <KrewMark
            type="connector-curve"
            tone="sage"
            size="sm"
            rotation={-2}
            className="pointer-events-none absolute -left-8 top-5 hidden h-6 w-10 opacity-55 sm:block"
          />
          <img
            src={otterSrc}
            alt=""
            className="pointer-events-none h-auto w-full max-w-[72px] object-contain sm:max-w-[96px]"
          />
        </div>
      </div>

      {children ? <div className="pt-1">{children}</div> : null}
    </header>
  );
}
