import { useState, useMemo } from "react";
import { ClipboardCheck, CheckSquare, Square, ShieldAlert } from "lucide-react";
import { buildPackingList, type PackingItem } from "@/lib/krew/packing-list";

type PackingListCardProps = {
  avgTemp?: number | null;
  activities?: string[];
  durationDays?: number;
  eventType?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  documents: "📄 Documents",
  vetements: "👕 Vêtements",
  sante: "🏥 Santé",
  divers: "🎒 Divers & Équipement",
};

export function PackingListCard({
  avgTemp,
  activities = [],
  durationDays = 2,
  eventType,
}: PackingListCardProps) {
  const packingItems = useMemo(() => {
    return buildPackingList({
      avgTemp,
      activities,
      durationDays,
      eventType,
    });
  }, [avgTemp, activities, durationDays, eventType]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleItem = (label: string) => {
    setChecked((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const grouped = useMemo(() => {
    const groups: Record<string, PackingItem[]> = {
      documents: [],
      vetements: [],
      sante: [],
      divers: [],
    };
    for (const item of packingItems) {
      if (groups[item.category]) {
        groups[item.category].push(item);
      } else {
        groups.divers.push(item);
      }
    }
    return groups;
  }, [packingItems]);

  const totalItems = packingItems.length;
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          <h2 className="font-display text-xl font-semibold tracking-tight">Liste de valise intelligente</h2>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
          {checkedCount} / {totalItems} complété
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">
        Générée automatiquement selon la durée ({durationDays} jours) et les activités prévues. Cochez les cases au fur et à mesure.
      </p>

      <div className="grid gap-6 md:grid-cols-2 mt-4">
        {Object.entries(grouped).map(([catKey, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={catKey} className="space-y-2.5">
              <h3 className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[catKey] || catKey}
              </h3>
              <ul className="space-y-1.5">
                {list.map((item) => {
                  const isChecked = Boolean(checked[item.label]);
                  return (
                    <li
                      key={item.label}
                      onClick={() => toggleItem(item.label)}
                      className="flex items-start gap-2.5 cursor-pointer select-none group py-1 rounded-md hover:bg-surface/30 px-1.5 transition"
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-muted-foreground group-hover:text-primary transition shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="size-4.5 text-primary fill-primary/10" />
                        ) : (
                          <Square className="size-4.5" />
                        )}
                      </button>
                      <span
                        className={`text-sm leading-tight transition ${
                          isChecked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                      >
                        {item.label}
                        {item.essential && !isChecked && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] bg-red-500/10 text-red-500 dark:text-red-400 px-1.5 py-0 rounded-full font-medium">
                            Requis
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
