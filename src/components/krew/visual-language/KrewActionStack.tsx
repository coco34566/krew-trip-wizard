import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { KrewIcon, type KrewIconName } from "./KrewIcon";
import { KrewMark } from "./KrewMark";
import { KrewProgressRing } from "./KrewProgressRing";

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
  tone?: "sage" | "plum";
};

type Props = {
  primary: KrewActionItem;
  secondary?: KrewActionItem[];
  progress?: Progress[];
  className?: string;
};

export function KrewActionStack({ primary, secondary = [], progress = [], className }: Props) {
  const PrimaryTag = primary.href ? "a" : "div";

  return (
    <section className={cn("space-y-4", className)}>
      {/* Action principale dans une grande nappe sauge organique */}
      <div className="relative overflow-hidden rounded-[2.25rem] bg-sage/18 p-5 sm:p-7 shadow-2xs border border-sage/30">
        <KrewMark type="sparkle" tone="plum" size="sm" className="absolute left-3 top-4 opacity-80" />

        <div className={cn("grid gap-5", progress.length > 0 && "sm:grid-cols-[minmax(0,1fr)_auto]")}>
          <div className="min-w-0 pl-6 sm:pl-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/70">
              Prochaine action
            </p>
            <h2 className="mt-1 max-w-xl font-display text-[2rem] sm:text-[2.5rem] font-normal leading-[0.98] tracking-tight text-primary">
              {primary.title}
            </h2>
            {primary.description ? (
              <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-foreground/80 font-sans">
                {primary.description}
              </p>
            ) : null}
            {primary.href ? (
              <PrimaryTag
                href={primary.href}
                className="mt-5 inline-flex min-h-11 items-center gap-2.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] shadow-xs"
              >
                <span>Continuer</span>
                <KrewMark type="arrow-right" tone="plum" size="sm" className="w-5 h-3 text-white" />
              </PrimaryTag>
            ) : null}
          </div>

          {progress.length > 0 ? (
            <div className="flex items-center justify-around gap-4 border-t border-primary/12 pt-4 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              {progress.slice(0, 2).map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/70">
                    {item.label}
                  </span>
                  <KrewProgressRing value={item.value} tone={item.tone ?? "sage"} size={60} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Séquence des actions suivantes */}
      {secondary.slice(0, 3).length > 0 ? (
        <div className="relative ml-2 space-y-1 sm:ml-5 pt-1">
          <KrewMark type="connector-curve" tone="sage" size="sm" className="absolute -left-3 -top-2 h-8 w-6 opacity-60 pointer-events-none" />
          {secondary.slice(0, 3).map((action, index) => {
            const Tag = action.href ? "a" : "div";
            const Icon = action.icon;
            return (
              <Tag
                key={action.key}
                {...(action.href ? { href: action.href } : {})}
                className={cn(
                  "group flex min-h-[68px] items-center gap-3.5 border-b border-primary/10 px-3 py-2.5 transition-all rounded-xl hover:bg-muted/30",
                  index === 1 && "ml-2.5 sm:ml-3",
                  index === 2 && "ml-1 sm:ml-1.5",
                  action.href && "cursor-pointer",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage/16 text-primary">
                  {action.iconName ? (
                    <KrewIcon name={action.iconName} tone="plum" size="sm" className="size-5" />
                  ) : Icon ? (
                    <Icon className="size-4" />
                  ) : null}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-foreground/90 transition group-hover:text-primary">
                    {action.title}
                  </p>
                  {action.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground font-sans">
                      {action.description}
                    </p>
                  ) : null}
                </div>

                {action.href ? (
                  <KrewMark
                    type="arrow-right"
                    tone="plum"
                    size="sm"
                    className="w-5 h-3 opacity-60 transition-transform group-hover:translate-x-1 group-hover:opacity-100 shrink-0"
                  />
                ) : null}
              </Tag>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
