import { useEffect, useMemo, useState } from "react";
import { CheckSquare, ExternalLink, Plus, Square } from "lucide-react";
import {
  buildTripPreparation,
  type PackingItem,
  type PackingListInput,
} from "@/lib/krew/packing-list";
import { resolveShoppingLink, type ShoppingLink } from "@/lib/krew/shopping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <ul className="divide-y divide-border/40 text-sm">
      {items.map((item) => {
        const link =
          item.purchasable && !state.owned[item.id]
            ? resolveShoppingLink(item.id, shoppingLinks)
            : null;
        const participant = participants.find((p) => p.id === state.assigned[item.id]);
        return (
          <li key={item.id} className="py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label={`Cocher ${item.label}`}
                onClick={() => toggle(item.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {state.checked[item.id] ? (
                  <CheckSquare className="size-4 text-sage" />
                ) : (
                  <Square className="size-4" />
                )}
              </button>
              <span
                className={
                  state.checked[item.id] ? "text-muted-foreground/60 font-normal" : "font-medium text-foreground"
                }
              >
                {item.label}
              </span>
            </div>
            {group ? (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <select
                  aria-label={`Assigner ${item.label}`}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
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
                    className="h-8 text-xs"
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
                  <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-item={item.id}
                      data-merchant={link.merchant}
                    >
                      Voir des options <ExternalLink className="size-3" />
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
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-normal text-foreground">Préparer le voyage</h2>
        <p className="text-xs text-muted-foreground">
          Retrouve ici ce qu’il faut prévoir pour le voyage.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-sans font-semibold text-base text-foreground border-b border-border/50 pb-2">Mes affaires</h3>
          {renderItems(result.personal)}
        </div>
        <div className="space-y-3">
          <h3 className="font-sans font-semibold text-base text-foreground border-b border-border/50 pb-2">Pour le groupe</h3>
          {renderItems(result.group, true)}
        </div>
        <div className="space-y-3">
          <h3 className="font-sans font-semibold text-base text-foreground border-b border-border/50 pb-2">Courses</h3>
          <ul className="divide-y divide-border/40 text-sm">
            {result.groceries.map((g) => (
              <li key={g.id} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {g.label}
                  {g.optional ? " (facultatif)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-sans font-semibold text-base text-foreground border-b border-border/50 pb-2">À faire</h3>
          <ul className="divide-y divide-border/40 text-sm">
            {result.tasks.map((t) => (
              <li key={t.id} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-foreground">{t.label}</span>
                <span className="text-xs text-muted-foreground">
                  À attribuer
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
        <Input
          value={manualLabel}
          onChange={(e) => setManualLabel(e.target.value)}
          placeholder="Ajouter un élément"
          className="max-w-xs"
        />
        <select
          aria-label="Type de l'élément"
          value={manualMode}
          onChange={(e) => setManualMode(e.target.value as "personal" | "group")}
          className="rounded-md border bg-background px-2 text-sm"
        >
          <option value="personal">Mes affaires</option>
          <option value="group">Pour le groupe</option>
        </select>
        <Button type="button" variant="outline" onClick={addManual}>
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </section>
  );
}
