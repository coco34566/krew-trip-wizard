import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  buildTripPreparation,
  type PackingItem,
  type PackingListInput,
} from "@/lib/krew/packing-list";
import { resolveShoppingLink, type ShoppingLink } from "@/lib/krew/shopping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";

type Props = PackingListInput & {
  tripId?: string;
  participants?: { id: string; display_name?: string | null; email?: string | null }[];
  shoppingLinks?: Record<string, ShoppingLink | undefined>;
};

export function getAssignablePackingParticipants<T extends { id: string }>(participants: T[]): T[] {
  return participants.filter((participant) => participant.id !== "star-virtual-id");
}

export function PackingListCard({
  tripId = "preview",
  participants = [],
  shoppingLinks = {},
  ...input
}: Props) {
  const assignableParticipants = useMemo(
    () => getAssignablePackingParticipants(participants),
    [participants],
  );
  const storageKey = `krew:packing:${tripId}`;
  const [state, setState] = useState<{
    checked: Record<string, boolean>;
    manual: PackingItem[];
    assigned: Record<string, string>;
    owned: Record<string, boolean>;
  }>({ checked: {}, manual: [], assigned: {}, owned: {} });
  const [manualLabel, setManualLabel] = useState("");
  const [manualMode, setManualMode] = useState<"personal" | "group">("personal");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setState(JSON.parse(saved));
    } catch {
      /* stockage indisponible */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* stockage indisponible */
    }
  }, [state, storageKey]);

  const result = useMemo(
    () => buildTripPreparation({ ...input, manualItems: state.manual }),
    [
      input.avgTemp,
      input.rainProb,
      input.isNautical,
      input.isCold,
      input.durationDays,
      input.eventType,
      input.accommodation,
      JSON.stringify(input.activities),
      JSON.stringify(input.accommodationAmenities),
      JSON.stringify(state.manual),
    ],
  );

  const toggle = (id: string) =>
    setState((s) => ({ ...s, checked: { ...s.checked, [id]: !s.checked[id] } }));

  const addManual = () => {
    const label = manualLabel.trim();
    if (!label) return;
    const id = `manual_${Date.now()}`;
    const item: PackingItem = {
      id,
      label,
      category: "divers",
      essential: false,
      mode: manualMode,
      quantity: { type: manualMode === "personal" ? "per_person" : "one_for_group" },
      sources: ["manual"],
      reasons: ["Ajout manuel"],
      manual: true,
    };
    setState((s) => ({ ...s, manual: [...s.manual, item] }));
    setManualLabel("");
  };

  const renderItems = (items: PackingItem[], group = false) => (
    <ul className="divide-y divide-border/40 text-sm sm:text-base">
      {items.map((item) => {
        const link =
          item.purchasable && !state.owned[item.id]
            ? resolveShoppingLink(item.id, shoppingLinks)
            : null;
        const participant = participants.find((p) => p.id === state.assigned[item.id]);
        return (
          <li key={item.id} className="py-3 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                aria-label={`Cocher ${item.label}`}
                onClick={() => toggle(item.id)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-6 min-w-6 inline-flex items-center justify-center"
              >
                {state.checked[item.id] ? (
                  <KrewIcon name="check" tone="sage" size="sm" className="size-4" />
                ) : (
                  <span className="size-4 rounded border border-border inline-block" />
                )}
              </button>
              <span
                className={
                  state.checked[item.id]
                    ? "line-through text-muted-foreground font-normal"
                    : "font-medium text-foreground"
                }
              >
                {item.label}
              </span>
            </div>
            {group ? (
              <div className="flex flex-wrap items-center gap-2 pl-8">
                <select
                  aria-label={`Assigner ${item.label}`}
                  className="min-h-9 rounded-lg border border-border bg-background px-2.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  value={state.assigned[item.id] || ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      assigned: { ...s.assigned, [item.id]: e.target.value },
                    }))
                  }
                >
                  <option value="">Qui s'en charge ?</option>
                  {assignableParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.email?.split("@")[0] || "Participant"}
                    </option>
                  ))}
                </select>
                {item.purchasable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9 h-auto text-sm"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        owned: { ...s.owned, [item.id]: !s.owned[item.id] },
                      }))
                    }
                  >
                    {state.owned[item.id]
                      ? `${participant?.display_name || "Quelqu'un"} l'apporte`
                      : "Je m’en charge"}
                  </Button>
                ) : null}
                {link ? (
                  <Button asChild size="sm" variant="ghost" className="min-h-9 h-auto text-sm">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-item={item.id}
                      data-merchant={link.merchant}
                    >
                      Voir des options <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 pointer-events-none">
        <img
          src="/brand/otter-states/trip-preparation.png"
          alt=""
          className="w-[60px] sm:w-[72px] h-auto object-contain filter drop-shadow-2xs opacity-85"
          loading="lazy"
        />
      </div>

      <div className="pr-16 sm:pr-20 relative">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl sm:text-3xl font-normal text-foreground flex items-center gap-2">
            <KrewIcon name="packing" tone="plum" size="sm" className="size-5" />
            À emporter
          </h2>
          <KrewNote variant="tape" tone="sage" rotation={-2} className="hidden sm:inline-block text-sm py-1 px-2.5">
            Adaptée au séjour
          </KrewNote>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground font-sans mt-1 leading-relaxed">
          Une liste adaptée au séjour et aux activités, à compléter avec le groupe.
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="font-sans font-semibold text-base sm:text-lg text-foreground">Mes affaires</h3>
          {renderItems(result.personal)}
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="font-sans font-semibold text-base sm:text-lg text-foreground">Pour le groupe</h3>
          {renderItems(result.group, true)}
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="font-sans font-semibold text-base sm:text-lg text-foreground">Courses</h3>
          <ul className="divide-y divide-border/40 text-sm sm:text-base">
            {result.groceries.map((g) => (
              <li key={g.id} className="py-3 flex items-start justify-between gap-3">
                <span className="font-medium text-foreground">
                  {g.label}
                  {g.optional ? " (facultatif)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="font-sans font-semibold text-base sm:text-lg text-foreground">À faire</h3>
          <ul className="divide-y divide-border/40 text-sm sm:text-base">
            {result.tasks.map((t) => (
              <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                <span className="font-medium text-foreground">{t.label}</span>
                <span className="text-sm text-muted-foreground">À répartir dans les tâches</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 border-t border-border/50 pt-4 items-stretch sm:items-center">
        <Input
          value={manualLabel}
          onChange={(e) => setManualLabel(e.target.value)}
          placeholder="Ajouter un élément"
          className="w-full sm:max-w-xs rounded-xl text-base h-11"
        />
        <select
          aria-label="Type de l'élément"
          value={manualMode}
          onChange={(e) => setManualMode(e.target.value as "personal" | "group")}
          className="rounded-xl border border-border bg-background px-3 text-sm h-11 font-medium"
        >
          <option value="personal">Mes affaires</option>
          <option value="group">Pour le groupe</option>
        </select>
        <Button type="button" variant="outline" size="sm" className="h-11 rounded-xl text-sm font-medium" onClick={addManual}>
          <KrewIcon name="plus" size="sm" className="size-3.5 shrink-0" /> Ajouter
        </Button>
      </div>
    </section>
  );
}
