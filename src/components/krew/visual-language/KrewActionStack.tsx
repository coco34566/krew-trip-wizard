import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { KrewMark } from "./KrewMark";
import { KrewProgressRing } from "./KrewProgressRing";

export type KrewActionItem = {
  key: string;
  title: string;
  description?: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
};

type Progress = {
  label: string;
  value: number;
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
    <section className={cn("space-y-3", className)}>
      <div className="relative overflow-hidden rounded-[2.25rem] bg-sage/22 px-5 py-6 sm:px-7 sm:py-7">
        <KrewMark type="sparkle" tone="plum" size="sm" className="absolute left-4 top-5 opacity-90" />
        <div className={cn("grid gap-5", progress.length > 0 && "sm:grid-cols-[minmax(0,1fr)_auto]")}>
          <div className="min-w-0 pl-7 sm:pl-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/70">Prochaine action</p>
            <h2 className="mt-1 max-w-xl font-display text-[2rem] font-normal leading-[0.98] tracking-tight text-primary sm:text-[2.5rem]">
              {primary.title}
            </h2>
            {primary.description ? (
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-foreground/75">{primary.description}</p>
            ) : null}
            {primary.href ? (
              <PrimaryTag
                href={primary.href}
                className="mt-5 inline-flex min-h-11 items-center gap-3 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Continuer
                <ArrowRight className="size-4" />
              </PrimaryTag>
            ) : null}
          </div>

          {progress.length > 0 ? (
            <div className="flex items-center gap-4 border-t border-primary/15 pt-4 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              {progress.slice(0, 2).map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/65">{item.label}</span>
                  <KrewProgressRing value={item.value} size={62} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {secondary.slice(0, 3).length > 0 ? (
        <div className="relative ml-2 space-y-0 sm:ml-5">
          <KrewMark type="connector" tone="sage" size="sm" className="absolute -left-4 -top-4 h-10 w-8 opacity-70" />
          {secondary.slice(0, 3).map((action, index) => {
            const Tag = action.href ? "a" : "div";
            const Icon = action.icon;
            return (
              <Tag
                key={action.key}
                {...(action.href ? { href: action.href } : {})}
                className={cn(
                  "group flex min-h-[76px] items-center gap-3 border-b border-primary/10 px-2 py-3 last:border-b-0 sm:px-3",
                  index === 1 && "sm:ml-3",
                  index === 2 && "sm:ml-1",
                  action.href && "cursor-pointer",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sage/14 text-primary/75">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight text-foreground/90 transition group-hover:text-primary">{action.title}</p>
                  {action.description ? <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{action.description}</p> : null}
                </div>
                {action.href ? <ArrowRight className="size-4 shrink-0 text-primary/65 transition-transform group-hover:translate-x-0.5" /> : null}
              </Tag>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
