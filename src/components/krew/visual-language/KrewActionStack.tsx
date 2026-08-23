import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { KrewIcon, type KrewIconName } from "./KrewIcon";
import { KrewMark } from "./KrewMark";
import { KrewOrganicBlob } from "./KrewOrganicBlob";
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
      {/* ZONE 3 — ÉTAT DU GROUPE (DISPONIBILITÉS / PRÉFÉRENCES) : AVANT LA PROCHAINE ACTION */}
      {progress.length > 0 ? (
        <div className="pt-1 pb-2">
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
                <KrewProgressRing value={progress[0].value} tone={progress[0].tone ?? "sage"} size={72} />
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
                <KrewProgressRing value={progress[1].value} tone={progress[1].tone ?? "plum"} size={72} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ZONE 2 — PROCHAINE ACTION (VRAIE SURFACE ORGANIQUE KREWORGANICBLOB) */}
      <div className="relative p-6 sm:p-7 overflow-visible">
        <KrewOrganicBlob
          tone="sage"
          variant="soft"
          className="absolute inset-0 w-full h-full z-0 opacity-85 pointer-events-none"
        />

        <div className="relative z-10 flex min-w-0 flex-col gap-2 pr-[68px] sm:pr-[76px]">
          {/* Label */}
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/70">
            Prochaine action
          </p>

          {/* Titre */}
          <h2 className="font-display text-[32px] sm:text-[36px] font-normal leading-[0.98] tracking-tight text-primary break-words">
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
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]"
              >
                Continuer
              </PrimaryTag>
            </div>
          ) : null}
        </div>

        {/* LOUTRE NEXT-ACTION (SANS FLÈCHE KREWMARK) */}
        <div className="absolute bottom-3 right-2.5 z-20 flex items-end pointer-events-none">
          <img
            src="/brand/otter-states/next-action.png"
            alt=""
            className="w-[64px] h-auto object-contain filter drop-shadow-2xs"
            loading="lazy"
          />
        </div>
      </div>

      {/* ZONE 4 — LES 3 ACTIONS SUIVANTES : STRICTEMENT ALIGNÉES SANS DÉCALAGES MARGE */}
      {secondary.slice(0, 3).length > 0 ? (
        <div className="relative pt-2 space-y-1">
          {secondary.slice(0, 3).map((action, index) => {
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
                  "grid grid-cols-[40px_1fr] items-center min-h-[68px] border-b border-primary/10 py-2.5 transition-colors group",
                  action.href && "cursor-pointer",
                )}
              >
                {/* COLONNE 1 : KrewIcon 20px directement sur fond (pas de cercle) */}
                <div className="relative z-10 flex items-center justify-center">
                  {iconName ? (
                    <KrewIcon name={iconName} tone="plum" size="sm" className="size-[20px]" />
                  ) : null}
                </div>

                {/* COLONNE 2 : Titre avec flèche KrewMark en continuation directe + Description */}
                <div className="min-w-0 pr-1">
                  <p className="text-sm font-semibold leading-tight text-foreground/90 group-hover:text-primary transition-colors inline-flex flex-wrap items-center gap-1.5">
                    <span>{action.title}</span>
                    {action.href ? (
                      <KrewMark
                        type="arrow-right"
                        tone="plum"
                        size="sm"
                        className="w-[18px] h-[11px] shrink-0 opacity-70 transition-transform group-hover:translate-x-1 group-hover:opacity-100"
                      />
                    ) : null}
                  </p>
                  {action.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs leading-snug text-muted-foreground font-sans">
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
