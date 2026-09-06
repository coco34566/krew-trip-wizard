import type { ReactNode } from "react";

import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { cn } from "@/lib/utils";

type KrewJourneyStatusPanelProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: "check" | "availability" | "lock" | "info";
  tone?: "complete" | "locked" | "info";
  className?: string;
  role?: "status" | "alert";
};

const toneClasses = {
  complete: "border-sage/35 bg-sage/10",
  locked: "border-primary/20 bg-primary/5",
  info: "border-border/60 bg-surface/35",
} as const;

export function KrewJourneyStatusPanel({
  title,
  children,
  action,
  icon = "check",
  tone = "complete",
  className,
  role = "status",
}: KrewJourneyStatusPanelProps) {
  return (
    <section
      data-krew-journey-status
      data-krew-journey-status-tone={tone}
      role={role}
      className={cn(
        "rounded-[18px] border px-4 py-4 sm:px-5 sm:py-4.5",
        toneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-background/75 text-primary">
          <KrewIcon name={icon} tone="sage" size="sm" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[14px] font-semibold leading-[1.35] text-foreground sm:text-[15px]">
            {title}
          </p>
          <div className="mt-1.5 max-w-[42rem] text-[13px] leading-[1.5] text-muted-foreground sm:text-[14px]">
            {children}
          </div>
          {action ? <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
