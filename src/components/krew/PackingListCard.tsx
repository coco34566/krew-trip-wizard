import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  buildTripPreparation,
  type PackingItem,
  type PackingListInput,
} from "@/lib/krew/packing-list";
import {
  buildMusicContext,
  recommendSpotifyPlaylists,
  type MusicContextInput,
} from "@/lib/krew/spotify-playlists";
import { resolveShoppingLink, type ShoppingLink } from "@/lib/krew/shopping";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { supabase } from "@/integrations/supabase/client";

type Props = PackingListInput & {
  tripId?: string;
  participants?: { id: string; user_id?: string | null; display_name?: string | null; email?: string | null }[];
  shoppingLinks?: Record<string, ShoppingLink | undefined>;
  musicContext?: MusicContextInput;
};

export function getAssignablePackingParticipants<T extends { id: string }>(participants: T[]): T[] {
  return participants.filter((participant) => participant.id !== "star-virtual-id");
}

export function PackingListCard({
  tripId = "preview",
  participants = [],
  shoppingLinks = {},
  musicContext,
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [manualLabel, setManualLabel] = useState("");
  const [manualMode, setManualMode] = useState<"personal" | "group">("personal");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)).catch(() => setCurrentUserId(null));
  }, []);

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

  const musicRecommendations = useMemo(() => {
    const context = buildMusicContext({
      ...musicContext,
      selectedActivities: [
        ...(musicContext?.selectedActivities ?? []),
        ...(input.activities ?? []),
      ],
      accommodationType: musicContext?.accommodationType ?? input.accommodation ?? null,
      requiredAmenities:
        musicContext?.requiredAmenities ?? input.accommodationAmenities ?? [],
      eventType: musicContext?.eventType ?? input.eventType ?? null,
    });
    return recommendSpotifyPlaylists(context);
  }, [
    input.eventType,
    input.accommodation,
    JSON.stringify(input.activities),
    JSON.stringify(input.accommodationAmenities),
    JSON.stringify(musicContext),
  ]);

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
        return (
          <li key={item.id} className="py-3 flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                aria-label={`Cocher ${item.label}`}
                onClick={() => toggle(item.id)}
                className="-ml-1 -mt-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
              >
                {state.checked[item.id] ? (
                  <KrewIcon name="check" tone="sage" size="sm" className="size-5" />
                ) : (
                  <span className="size-5 rounded border border-border inline-block" />
                )}
              </button>
              <span
                className={
                  state.checked[item.id]
                    ? "pt-1.5 line-through text-muted-foreground font-normal"
                    : "pt-1.5 font-medium text-foreground"
                }
              >
                {item.label}
              </span>
            </div>
            {group ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 pl-0 sm:pl-10">
                <select
                  aria-label={`Assigner ${item.label}`}
                  className="min-h-10 rounded-[10px] border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  value={state.owned[item.id] ? "__me__" : state.assigned[item.id] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setState((s) => ({
                      ...s,
                      assigned: { ...s.assigned, [item.id]: value === "__me__" ? "" : value },
                      owned: { ...s.owned, [item.id]: value === "__me__" },
                    }));
                  }}
                >
                  <option value="">Qui s'en charge ?</option>
                  {item.purchasable ? <option value="__me__">Je m’en charge</option> : null}
                  {assignableParticipants.filter((p) => !currentUserId || p.user_id !== currentUserId).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.email?.split("@")[0] || "Participant"}
                    </option>
                  ))}
                </select>
                {link ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-item={item.id}
                    data-merchant={link.merchant}
                    className="inline-flex items-center gap-1.5 self-start py-1 text-sm font-medium text-primary underline-offset-4 hover:underline sm:self-auto"
                  >
                    Voir des options <ExternalLink className="size-3.5" />
                  </a>
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
          className="w-[72px] sm:w-[88px] h-auto object-contain filter drop-shadow-2xs opacity-90"
          loading="lazy"
        />
      </div>

      <div className="pr-20 sm:pr-24 relative">
        <div className="flex items-center gap-3">
          <div className="relative inline-block">
            <h2 className="font-display text-[28px] sm:text-[32px] font-normal text-foreground flex items-center gap-2">
              <KrewIcon name="packing" tone="plum" size="sm" className="size-5" />
              À emporter
            </h2>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="sm"
              className="absolute left-7 -bottom-1.5 w-[110px] pointer-events-none"
            />
          </div>
          <KrewNote variant="tape" tone="sage" rotation={-2} className="hidden sm:inline-block text-sm py-1 px-2.5">
            Adaptée au séjour
          </KrewNote>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground font-sans mt-2 leading-relaxed">
          Une liste adaptée au séjour et aux activités, à compléter avec le groupe.
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="flex items-center gap-2 font-sans font-semibold text-base sm:text-lg text-foreground">
            <KrewIcon name="packing" tone="plum" size="sm" className="size-4.5 shrink-0" />
            Mes affaires
          </h3>
          {renderItems(result.personal)}
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="flex items-center gap-2 font-sans font-semibold text-base sm:text-lg text-foreground">
            <KrewIcon name="group" tone="sage" size="sm" className="size-4.5 shrink-0" />
            Pour le groupe
          </h3>
          {renderItems(result.group, true)}
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4">
          <h3 className="flex items-center gap-2 font-sans font-semibold text-base sm:text-lg text-foreground">
            <KrewIcon name="food" tone="plum" size="sm" className="size-4.5 shrink-0" />
            Courses
          </h3>
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
          <h3 className="flex items-center gap-2 font-sans font-semibold text-base sm:text-lg text-foreground">
            <KrewIcon name="tasks" tone="sage" size="sm" className="size-4.5 shrink-0" />
            À faire
          </h3>
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
          className="rounded-[10px] border border-border bg-background px-3 text-sm h-10 font-medium"
        >
          <option value="personal">Mes affaires</option>
          <option value="group">Pour le groupe</option>
        </select>
        <Button type="button" variant="outline" size="sm" className="text-sm font-medium" onClick={addManual}>
          <KrewIcon name="plus" size="sm" className="size-3.5 shrink-0" /> Ajouter
        </Button>
      </div>

      {musicRecommendations.length > 0 ? (
        <section className="border-t border-border/50 pt-5 sm:pt-6 space-y-3">
          <div className="relative inline-block pr-4">
            <h3 className="font-display text-[24px] sm:text-[28px] font-normal text-foreground">
              La bande-son du Krew
            </h3>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="sm"
              className="absolute left-0 -bottom-1.5 w-[118px] pointer-events-none"
            />
          </div>
          <p className="text-sm text-muted-foreground font-sans">
            Trois ambiances pour accompagner le voyage.
          </p>
          <div className="divide-y divide-border/40 border-y border-border/40">
            {musicRecommendations.map((recommendation) => (
              <div
                key={recommendation.id}
                className="py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold uppercase tracking-wide text-primary">
                    {recommendation.slotLabel}
                  </p>
                  <p className="mt-0.5 font-sans text-sm sm:text-base font-semibold text-foreground break-words">
                    {recommendation.name}
                  </p>
                </div>
                <a
                  href={recommendation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-xl px-0 text-sm font-semibold text-primary underline-offset-4 hover:underline sm:self-auto"
                >
                  Écouter sur Spotify <ExternalLink className="size-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
