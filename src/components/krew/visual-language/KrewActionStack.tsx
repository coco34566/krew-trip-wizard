import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KrewIcon, type KrewIconName } from "./KrewIcon";
import { KrewMark } from "./KrewMark";
import { KrewOrganicBlob } from "./KrewOrganicBlob";

export type KrewActionItem = {
  key: string;
  title: string;
  description?: string;
  href?: string;
  iconName?: KrewIconName;
  icon?: ComponentType<{ className?: string }>;
};

type Progress = {
  label: string;
  value: number;
  current?: number;
  total?: number;
  tone?: "sage" | "plum";
};

type Props = {
  primary: KrewActionItem;
  secondary?: KrewActionItem[];
  progress?: Progress[];
  className?: string;
};

const progressIcon = (label: string): KrewIconName =>
  label.toLowerCase().includes("dispo") ? "availability" : "preferences";

export function KrewActionStack({ primary, secondary = [], progress = [], className }: Props) {
  return (
    <section className={cn("space-y-6", className)}>
      {progress.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
          {progress.slice(0, 2).map((item) => {
            const value = Math.max(0, Math.min(100, item.value));
            const fillClass = item.tone === "plum" ? "bg-primary/70" : "bg-sage";
            return (
              <div key={item.label} className="min-w-0 space-y-2 border-t border-border/50 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <KrewIcon name={progressIcon(item.label)} tone="plum" size="sm" className="size-4 shrink-0" />
                    <span className="truncate text-[13px] font-medium text-foreground/80">
                      {item.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[12px] font-semibold text-foreground/70">
                    {item.current != null && item.total != null ? `${item.current}/${item.total}` : `${value}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/70" aria-hidden="true">
                  <div className={cn("h-full rounded-full transition-[width]", fillClass)} style={{ width: `${value}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="relative overflow-visible p-6 sm:p-7">
        <KrewOrganicBlob tone="sage" variant="soft" className="absolute inset-0 z-0 h-full w-full opacity-85 pointer-events-none" />

        <div className="relative z-10 flex min-w-0 flex-col gap-2 pr-[68px] sm:pr-[76px]">
          <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-foreground/70">Prochaine action</p>
          <h2 className="break-words font-display text-[32px] font-normal leading-[0.98] tracking-tight text-primary sm:text-[36px]">
            {primary.title}
          </h2>
          {primary.description ? (
            <p className="mt-1 text-sm leading-relaxed text-foreground/80 font-sans">{primary.description}</p>
          ) : null}

          {primary.href ? (
            <div className="pt-3">
              <Button asChild>
                <a href={primary.href}>Continuer</a>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="absolute bottom-3 right-2.5 z-20 flex items-end pointer-events-none">
          <img
            src="/brand/otter-states/next-action.png"
            alt=""
            className="h-auto w-[64px] object-contain filter drop-shadow-2xs"
            loading="lazy"
          />
        </div>
      </div>

      {secondary.slice(0, 3).length > 0 ? (
        <div className="relative space-y-1 pt-2">
          {secondary.slice(0, 3).map((action) => {
            const Tag = action.href ? "a" : "div";
            const knownIcons: Record<string, KrewIconName> = {
              avail: "availability",
              prefs: "preferences",
              star: "favorite",
              hotel: "accommodation",
              "search-hotels": "accommodation",
              transport: "transport",
              "search-transport": "transport",
              "lock-dates": "calendar",
              "choose-profile": "profile",
              gen: "destination",
              "pick-dest": "destination",
              plan: "planning",
              refine: "tasks",
              nudge: "group",
            };
            const iconName = action.iconName || knownIcons[action.key] || null;

            return (
              <Tag
                key={action.key}
                {...(action.href ? { href: action.href } : {})}
                className={cn(
                  "group grid min-h-[68px] grid-cols-[40px_1fr] items-center border-b border-primary/10 py-2.5 transition-colors",
                  action.href && "cursor-pointer",
                )}
              >
                <div className="relative z-10 flex items-center justify-center">
                  {iconName ? <KrewIcon name={iconName} tone="plum" size="sm" className="size-[20px]" /> : null}
                </div>
                <div className="min-w-0 pr-1">
                  <p className="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-tight text-foreground/90 transition-colors group-hover:text-primary">
                    <span>{action.title}</span>
                    {action.href ? (
                      <KrewMark
                        type="arrow-right"
                        tone="plum"
                        size="sm"
                        className="h-[11px] w-[18px] shrink-0 opacity-70 transition-all group-hover:translate-x-1 group-hover:opacity-100"
                      />
                    ) : null}
                  </p>
                  {action.description ? (
                    <p className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-muted-foreground font-sans">
                      {action.description}
                    </p>
                  ) : null}
                </div>
              </Tag>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
