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
    <section className={cn("space-y-6", className)}>
      {/* ZONE 2 — PROCHAINE ACTION (NAPPE SAUGE) */}
      <div className="relative overflow-hidden bg-sage/18 p-6 rounded-3xl">
        <div className="flex flex-col gap-2 max-w-[calc(100%-80px)] pr-2">
          {/* Label */}
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/70">
            Prochaine action
          </p>

          {/* Titre */}
          <h2 className="font-display text-[32px] sm:text-[36px] font-normal leading-[0.98] tracking-tight text-primary">
            {primary.title}
          </h2>

          {/* Description */}
          {primary.description ? (
            <p className="text-sm leading-relaxed text-foreground/80 font-sans mt-1">
              {primary.description}
            </p>
          ) : null}

          {/* CTA */}
          {primary.href ? (
            <div className="pt-3">
              <PrimaryTag
                href={primary.href}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 sm:px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]"
              >
                <span>Continuer</span>
                <KrewMark type="arrow-right" tone="plum" size="sm" className="w-5 h-3 text-white shrink-0" />
              </PrimaryTag>
            </div>
          ) : null}
        </div>

        {/* F3. LOUTRE NEXT-ACTION + F4. KREWMARK ARROW */}
        <div className="absolute bottom-3 right-2.5 z-20 flex items-end gap-1 pointer-events-none">
          <KrewMark type="arrow-down-right" tone="plum" size="sm" className="w-[30px] h-[20px] text-primary opacity-85 mb-2" />
          <img
            src="/brand/otter-states/next-action.png"
            alt=""
            className="w-[64px] h-auto object-contain filter drop-shadow-2xs"
            loading="lazy"
          />
        </div>
      </div>

      {/* ZONE 3 — ÉTAT DU GROUPE (DISPONIBILITÉS / PRÉFÉRENCES) */}
      {progress.length > 0 ? (
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Disponibilités (GAUCHE) */}
            {progress[0] ? (
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1.5">
                  <KrewIcon name="availability" tone="plum" size="sm" className="size-4 shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/75 font-medium">
                    {progress[0].label}
                  </span>
                </div>
                <KrewProgressRing value={progress[0].value} tone={progress[0].tone ?? "sage"} size={64} />
              </div>
            ) : null}

            {/* Préférences (DROITE) */}
            {progress[1] ? (
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-1.5">
                  <KrewIcon name="preferences" tone="plum" size="sm" className="size-4 shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/75 font-medium">
                    {progress[1].label}
                  </span>
                </div>
                <KrewProgressRing value={progress[1].value} tone={progress[1].tone ?? "plum"} size={64} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ZONE 4 — LES 3 ACTIONS SUIVANTES */}
      {secondary.slice(0, 3).length > 0 ? (
        <div className="relative pt-2 space-y-1">
          {/* Connector curve qui passe derrière les icônes si applicable */}
          <KrewMark type="connector-curve" tone="sage" size="sm" className="absolute left-[12px] top-[16px] h-[120px] w-[20px] z-0 opacity-40 pointer-events-none" />

          {secondary.slice(0, 3).map((action, index) => {
            const Tag = action.href ? "a" : "div";
            const iconName = action.iconName || (action.key === "avail" ? "availability" : action.key === "prefs" ? "preferences" : action.key === "star" ? "favorite" : action.key === "hotel" || action.key === "search-hotels" ? "accommodation" : action.key === "transport" || action.key === "search-transport" ? "transport" : action.key === "lock-dates" ? "calendar" : action.key === "choose-profile" ? "profile" : action.key === "gen" || action.key === "pick-dest" ? "destination" : action.key === "plan" ? "planning" : action.key === "refine" ? "tasks" : "group");

            return (
              <Tag
                key={action.key}
                {...(action.href ? { href: action.href } : {})}
                className={cn(
                  "grid grid-cols-[40px_1fr_24px] items-center min-h-[68px] border-b border-primary/10 py-2.5 transition-colors group",
                  index === 1 && "ml-[8px]",
                  index === 2 && "ml-[4px]",
                  action.href && "cursor-pointer",
                )}
              >
                {/* COLONNE 1 : KrewIcon 20px directement sur fond (pas de cercle) */}
                <div className="relative z-10 flex items-center justify-center">
                  <KrewIcon name={iconName} tone="plum" size="sm" className="size-[20px]" />
                </div>

                {/* COLONNE 2 : Titre + Description */}
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-semibold leading-tight text-foreground/90 group-hover:text-primary transition-colors">
                    {action.title}
                  </p>
                  {action.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground font-sans">
                      {action.description}
                    </p>
                  ) : null}
                </div>

                {/* COLONNE 3 : Arrow-right */}
                <div className="flex items-center justify-end">
                  {action.href ? (
                    <KrewMark
                      type="arrow-right"
                      tone="plum"
                      size="sm"
                      className="w-[20px] h-[12px] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
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
