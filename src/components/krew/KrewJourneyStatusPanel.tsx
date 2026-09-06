import { createContext, useContext, type ReactNode } from "react";

import { KrewIcon, type KrewIconName } from "@/components/krew/visual-language/KrewIcon";
import { cn } from "@/lib/utils";

type JourneyStatusIcon = Extract<KrewIconName, "check" | "availability" | "attention" | "calendar">;
type JourneyStatusTone = "complete" | "locked" | "info";

type KrewJourneyStatusPanelProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: JourneyStatusIcon;
  tone?: JourneyStatusTone;
  className?: string;
  role?: "status" | "alert";
};

type KrewJourneyStatusOverride = {
  title?: string;
  content?: ReactNode;
  action?: ReactNode;
  icon?: JourneyStatusIcon;
  tone?: JourneyStatusTone;
  role?: "status" | "alert";
};

const KrewJourneyStatusOverrideContext = createContext<KrewJourneyStatusOverride | null>(null);

export function KrewJourneyStatusOverrideProvider({
  override,
  children,
}: {
  override: KrewJourneyStatusOverride;
  children: ReactNode;
}) {
  return (
    <KrewJourneyStatusOverrideContext.Provider value={override}>
      {children}
    </KrewJourneyStatusOverrideContext.Provider>
  );
}

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
  const override = useContext(KrewJourneyStatusOverrideContext);
  const resolvedTitle = override?.title ?? title;
  const resolvedContent = override?.content ?? children;
  const resolvedAction = override?.action ?? action;
  const resolvedIcon = override?.icon ?? icon;
  const resolvedTone = override?.tone ?? tone;
  const resolvedRole = override?.role ?? role;

  return (
    <section
      data-krew-journey-status
      data-krew-journey-status-tone={resolvedTone}
      role={resolvedRole}
      className={cn(
        "rounded-[18px] border px-4 py-4 sm:px-5 sm:py-4.5",
        toneClasses[resolvedTone],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-background/75 text-primary">
          <KrewIcon name={resolvedIcon} tone="sage" size="sm" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[14px] font-semibold leading-[1.35] text-foreground sm:text-[15px]">
            {resolvedTitle}
          </p>
          <div className="mt-1.5 max-w-[42rem] text-[13px] leading-[1.5] text-muted-foreground sm:text-[14px]">
            {resolvedContent}
          </div>
          {resolvedAction ? <div className="mt-3 flex flex-wrap items-center gap-2">{resolvedAction}</div> : null}
        </div>
      </div>
    </section>
  );
}
