import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityAutocomplete } from "@/components/krew/CityAutocomplete";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon } from "@/components/krew/visual-language";
import { getStarPreferences, submitStarPreferences } from "@/lib/star-preferences.functions";
import { finalizeInvitationStep } from "@/lib/trips.functions";
import { AMBIANCES, STAR_DEAL_BREAKERS, STAR_WANTED_ACTIVITIES } from "@/lib/krew/constants";
import { cn } from "@/lib/utils";

type DayMode = "available" | "blocked" | null;

const STAR_WANTED_ACTIVITIES_EMOJIS: Record<string, string> = {
  sport: "⚽",
  plage: "🌊",
  randonnée: "🥾",
  spa: "🧖",
  bateau: "⛵",
  ski: "🎿",
  karting: "🏎️",
  soirée: "🌙",
  gastronomie: "🍽️",
  musée: "🏛️",
  shopping: "🛍️",
  nature: "🌳",
};

const STAR_DEAL_BREAKERS_EMOJIS: Record<string, string> = {
  déguisement: "🎭",
  "strip-tease": "🔞",
  "activités extrêmes": "🪂",
  musée: "🏛️",
  camping: "⛺",
  foule: "👥",
  "sport intense": "🏋️",
  "long trajet": "🚗",
};

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function SelectableOption({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-[14px] border p-4 text-left text-sm font-medium transition-colors select-none sm:text-base",
        active
          ? "border-primary/40 bg-primary/5 text-foreground"
          : "border-border/50 bg-background text-foreground/80 hover:border-primary/25 hover:bg-primary/[0.02]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, hint, bgClass, children }: { title: string; hint?: string; bgClass?: string; children: React.ReactNode }) {
  return (
    <section className={cn("mb-6 space-y-4 pb-6", bgClass ? `${bgClass} rounded-[20px] p-5 sm:p-6` : "border-b border-border/50")}>
      <div>
        <h2 className="font-display text-2xl font-normal text-foreground sm:text-3xl">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MonthGrid({ month, selection, onToggle }: { month: Date; selection: Map<string, DayMode>; onToggle: (iso: string) => void }) {
  const first = startOfMonth(month);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayISO = toISO(new Date());
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));

  return (
    <div className="rounded-[16px] border border-border/45 bg-background p-3.5">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{monthLabel(month)}</p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[12px] font-medium uppercase text-muted-foreground" aria-hidden="true">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`e-${i}`} aria-hidden="true" />;
          const iso = toISO(date);
          const mode = selection.get(iso) ?? null;
          const isPast = iso < todayISO;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onToggle(iso)}
              className={cn(
                "flex aspect-square min-h-10 items-center justify-center rounded-[10px] border text-[13px] font-mono font-medium transition-colors",
                isPast && "cursor-default border-transparent opacity-30",
                !isPast && !mode && "border-border/40 bg-background hover:border-primary/25 hover:bg-primary/[0.05] hover:text-primary",
                mode === "available" && "border-sage/45 bg-sage/25 font-bold text-foreground",
                mode === "blocked" && "border-destructive/60 bg-destructive/90 font-bold text-destructive-foreground",
                iso === todayISO && !mode && "ring-1 ring-primary/50",
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggle(list: string[], set: (v: string[]) => void, value: string) {
  set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
}

export const Route = createFileRoute("/_authenticated/trips/$tripId/star")({
  head: () => ({ meta: [{ title: "Préférences de la Star — KREW" }] }),
  component: StarQuestionnaire,
});

function StarQuestionnaire() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchStar = useServerFn(getStarPreferences);
  const submit = useServerFn(submitStarPreferences);
  const saveStarSetup = useServerFn(finalizeInvitationStep);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
  });

  const [starMode, setStarMode] = useState<"secret" | "participant">("secret");
  const [starPaysShare, setStarPaysShare] = useState(true);
  const [wanted, setWanted] = useState<string[]>([]);
  const [breakers, setBreakers] = useState<string[]>([]);
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [departureCity, setDepartureCity] = useState("");
  const [departureAirportOrStation, setDepartureAirportOrStation] = useState("");
  const [desiredDestination, setDesiredDestination] = useState("");
  const [excludedDestinations, setExcludedDestinations] = useState("");
  const [wantedEnvTypes, setWantedEnvTypes] = useState<string[]>([]);
  const [weatherPreference, setWeatherPreference] = useState<number>(1);
  const [localMobility, setLocalMobility] = useState<"walk_transit" | "car_if_worth_it" | "car_ok" | null>(null);
  const [accommodationRole, setAccommodationRole] = useState<"base_only" | "part_of_stay" | "centerpiece" | null>(null);
  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [paintMode, setPaintMode] = useState<"available" | "blocked">("available");
  const [monthOffset, setMonthOffset] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data) {
      setStarMode((data as any).starMode === "participant" ? "participant" : "secret");
      setStarPaysShare((data as any).starPaysShare !== false);
    }
  }, [data]);

  useEffect(() => {
    if (!data || hydrated) return;
    if (data.preferences) {
      setWanted(data.preferences.wantedActivities);
      setBreakers(data.preferences.dealBreakers);
      setAmbiances(data.preferences.ambiances);
      setNotes(data.preferences.notes ?? "");
      setDepartureCity(data.preferences.departureCity ?? "");
      setDepartureAirportOrStation(data.preferences.departureAirportOrStation ?? "");
      setDesiredDestination(data.preferences.desiredDestination ?? "");
      setExcludedDestinations((data.preferences.excludedDestinations ?? []).join(", "));
      setWantedEnvTypes((data.preferences as any).wantedEnvType ? (data.preferences as any).wantedEnvType.split(", ") : []);
      setWeatherPreference((data.preferences as any).weatherPreference ?? 1);
      setLocalMobility((data.preferences as any).localMobility ?? null);
      setAccommodationRole((data.preferences as any).accommodationRole ?? null);
      const m = new Map<string, DayMode>();
      for (const d of data.preferences.availableDates ?? []) m.set(d.slice(0, 10), "available");
      for (const d of data.preferences.blockedDates ?? []) m.set(d.slice(0, 10), "blocked");
      setSelection(m);
    }
    setHydrated(true);
  }, [data, hydrated]);

  const availableDates = useMemo(() => [...selection.entries()].filter(([, v]) => v === "available").map(([k]) => k).sort(), [selection]);
  const blockedDates = useMemo(() => [...selection.entries()].filter(([, v]) => v === "blocked").map(([k]) => k).sort(), [selection]);
  const baseMonth = startOfMonth(new Date());
  const months = [0, 1].map((i) => addMonths(baseMonth, monthOffset + i));

  function toggleDay(iso: string) {
    setSelection((prev) => {
      const next = new Map(prev);
      const cur = next.get(iso) ?? null;
      if (paintMode === "available") {
        if (cur === "available") next.delete(iso);
        else next.set(iso, "available");
      } else if (cur === "blocked") next.delete(iso);
      else next.set(iso, "blocked");
      return next;
    });
  }

  function selectWeekendsInView() {
    setSelection((prev) => {
      const next = new Map(prev);
      for (const month of months) {
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= days; d++) {
          const date = new Date(month.getFullYear(), month.getMonth(), d);
          const iso = toISO(date);
          if (iso < toISO(new Date())) continue;
          const wd = date.getDay();
          if (wd === 0 || wd === 6) next.set(iso, paintMode);
        }
      }
      return next;
    });
  }

  const setupMutation = useMutation({
    mutationFn: () => saveStarSetup({ data: { tripId, starMode, starPaysShare } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      console.error("Impossible d'enregistrer les choix de la Star:", e);
      toast.error("Impossible d’enregistrer ces choix pour le moment.");
    },
  });

  const mutation = useMutation({
    mutationFn: () => submit({
      data: {
        tripId,
        wantedActivities: wanted,
        dealBreakers: breakers,
        ambiances,
        notes: notes.trim() || undefined,
        departureCity: departureCity.trim() || undefined,
        departureAirportOrStation: departureAirportOrStation.trim() || undefined,
        desiredDestination: desiredDestination.trim() || undefined,
        excludedDestinations: excludedDestinations.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
        availableDates,
        blockedDates,
        wantedEnvType: wantedEnvTypes.join(", ") || undefined,
        weatherPreference,
        localMobility,
        accommodationRole,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => {
      console.error("Impossible d'enregistrer les préférences de la Star:", e);
      toast.error("Impossible d’enregistrer les préférences de la Star pour le moment.");
    },
  });

  if (isLoading) return <main className="mx-auto max-w-[820px] px-5 py-8 sm:px-7 sm:py-10"><KrewThinkingState context="generic" customMessage="Chargement des préférences de la Star…" delayMs={0} /></main>;

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-[820px] space-y-6 px-5 py-8 sm:px-7 sm:py-10">
        <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Retour au voyage</Link>
        <section className="rounded-3xl border border-border/60 bg-card p-6 text-center sm:p-8" role="alert">
          <h1 className="font-display text-[28px] font-normal text-foreground sm:text-[32px]">Impossible de charger les préférences de la Star</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Les informations de la Star ne sont pas disponibles pour le moment.</p>
          <Button type="button" className="mt-5" onClick={() => void refetch()} disabled={isFetching} aria-busy={isFetching}>{isFetching ? "Chargement…" : "Réessayer"}</Button>
        </section>
      </main>
    );
  }

  if (!data.trip.hasStar) {
    return <main className="mx-auto max-w-[820px] space-y-4 px-5 py-8 text-center sm:px-7 sm:py-10"><p className="text-muted-foreground">Ce voyage n’a pas de Star.</p><Button asChild variant="outline" className="rounded-xl"><Link to="/trips/$tripId" params={{ tripId }}>Retour au voyage</Link></Button></main>;
  }

  const starName = data.trip.celebratedPerson || "la Star";
  const disabledSetup = !data.trip.isOwner;

  return (
    <main className="mx-auto max-w-[820px] space-y-8 px-5 py-8 sm:px-7 sm:py-10">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Retour au voyage</Link>

      <KrewJourneyPageHeader tripName={data.trip.name ?? "Voyage"} title={`Préférences de ${starName}`} otterSrc="/brand/otter-states/preferences.png" waveClassName="w-[clamp(96px,38vw,160px)]">
        <p className="text-sm text-muted-foreground sm:text-base">Complète les réponses au nom de <strong>{starName}</strong>. Toutes les options ci-dessous décrivent ce qui lui ferait envie, à lui ou à elle.</p>
      </KrewJourneyPageHeader>

      <div className="pt-2">
        <Section title="Pour commencer" hint="Ces deux choix restent modifiables si l’organisation évolue.">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-base font-semibold text-foreground">Comment {starName} participe à l’organisation ?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectableOption active={starMode === "secret"} onClick={() => !disabledSetup && setStarMode("secret")} className={disabledSetup ? "pointer-events-none opacity-60" : undefined}>Mode secret · tu renseignes ses réponses</SelectableOption>
                <SelectableOption active={starMode === "participant"} onClick={() => !disabledSetup && setStarMode("participant")} className={disabledSetup ? "pointer-events-none opacity-60" : undefined}>Mode participant · la Star répond elle-même</SelectableOption>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-base font-semibold text-foreground">La Star participe-t-elle aux frais ?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectableOption active={starPaysShare} onClick={() => !disabledSetup && setStarPaysShare(true)} className={disabledSetup ? "pointer-events-none opacity-60" : undefined}>Oui, sa part reste incluse</SelectableOption>
                <SelectableOption active={!starPaysShare} onClick={() => !disabledSetup && setStarPaysShare(false)} className={disabledSetup ? "pointer-events-none opacity-60" : undefined}>Non, sa part est répartie</SelectableOption>
              </div>
            </div>
            {data.trip.isOwner ? <KrewStatefulButton variant="outline" className="w-full sm:w-auto" idleLabel="Enregistrer ces choix" loadingLabel="Enregistrement…" successLabel="Choix enregistrés" errorLabel="Réessayer" onAction={() => setupMutation.mutateAsync()} /> : null}
          </div>
        </Section>

        <Section title="Envies et ambiance" hint={`Choisis ce qui ferait réellement plaisir à ${starName}.`}>
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Quelles activités lui plairaient ?</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STAR_WANTED_ACTIVITIES.map((a) => <SelectableOption key={a} active={wanted.includes(a)} onClick={() => toggle(wanted, setWanted, a)}><span className="mr-1.5">{STAR_WANTED_ACTIVITIES_EMOJIS[a] || "✨"}</span>{capitalizeFirst(a)}</SelectableOption>)}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Quelle ambiance lui conviendrait le mieux ?</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {AMBIANCES.map((a) => <SelectableOption key={a.value} active={ambiances.includes(a.value)} onClick={() => toggle(ambiances, setAmbiances, a.value)}><span className="mr-1.5">{a.emoji}</span>{capitalizeFirst(a.label)}</SelectableOption>)}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Qu’est-ce qu’il ou elle voudrait absolument éviter ?</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STAR_DEAL_BREAKERS.map((a) => <SelectableOption key={a} active={breakers.includes(a)} onClick={() => toggle(breakers, setBreakers, a)}><span className="mr-1.5">{STAR_DEAL_BREAKERS_EMOJIS[a] || "🚫"}</span>{capitalizeFirst(a)}</SelectableOption>)}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Destination et cadre">
          <div className="space-y-5">
            <div className="space-y-2"><Label htmlFor="destination" className="block text-base font-semibold text-foreground">Quelle serait sa destination rêvée ? (optionnel)</Label><Input id="destination" value={desiredDestination} onChange={(e) => setDesiredDestination(e.target.value)} placeholder="Ex. Lisbonne, Barcelone…" className="h-12 rounded-xl border-border text-base focus-visible:ring-primary" /></div>
            <div className="space-y-2"><Label htmlFor="excluded" className="block text-base font-semibold text-foreground">Quelles destinations voudrait-il ou elle éviter ? (optionnel)</Label><Input id="excluded" value={excludedDestinations} onChange={(e) => setExcludedDestinations(e.target.value)} placeholder="Ex. Ibiza, Marrakech (séparées par des virgules)" className="h-12 rounded-xl border-border text-base focus-visible:ring-primary" /></div>
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Quel type de lieu lui plairait le plus ?</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { v: "Centre-ville / urbain", label: "🏢 Centre-ville / urbain" },
                  { v: "Quartier animé", label: "🍻 Quartier animé" },
                  { v: "Bord de mer", label: "🌊 Bord de mer" },
                  { v: "Nature / pleine nature", label: "🌳 Nature / pleine nature" },
                  { v: "Village de charme", label: "🏡 Village de charme" },
                  { v: "Montagne", label: "🏔️ Montagne" },
                  { v: "Lac / rivière", label: "🚣 Lac / rivière" },
                ].map((env) => <SelectableOption key={env.v} active={wantedEnvTypes.includes(env.v)} onClick={() => toggle(wantedEnvTypes, setWantedEnvTypes, env.v)}>{env.label}</SelectableOption>)}
              </div>
            </div>
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Quelle importance la météo aurait-elle pour lui ou elle ?</Label>
              <div className="grid gap-3">
                {[
                  { v: 2, label: "☀️ Le beau temps compte beaucoup pour lui ou elle" },
                  { v: 1, label: "🌤️ C’est un plus pour lui ou elle, sans être déterminant" },
                  { v: 0, label: "🌍 La météo n’est pas un critère important pour lui ou elle" },
                ].map((opt) => <SelectableOption key={opt.v} active={weatherPreference === opt.v} onClick={() => setWeatherPreference(opt.v)}>{opt.label}</SelectableOption>)}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Hébergement" bgClass="bg-surface/50">
          <div className="space-y-3">
            <Label className="block text-base font-semibold text-foreground">Pour lui ou elle, l’hébergement serait plutôt…</Label>
            <div className="grid gap-3">
              {[
                ["base_only", "Un point de chute"],
                ["part_of_stay", "Un lieu où le groupe aime aussi passer du temps"],
                ["centerpiece", "Une vraie partie du voyage"],
              ].map(([value, label]) => <SelectableOption key={value} active={accommodationRole === value} onClick={() => setAccommodationRole(value as typeof accommodationRole)}>{label}</SelectableOption>)}
            </div>
          </div>
        </Section>

        <Section title="Transport">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="departure" className="block text-base font-semibold text-foreground">D’où partirait {starName} ? (ville ou code postal)</Label>
              <CityAutocomplete id="departure" value={departureCity} onChange={setDepartureCity} onSelect={(sel) => { setDepartureCity(sel.city); setDepartureAirportOrStation(sel.airportIata || ""); }} placeholder="Ex. Lyon, 69001, Paris…" />
            </div>
            <div className="space-y-3">
              <Label className="block text-base font-semibold text-foreground">Sur place, qu’est-ce qui lui conviendrait le mieux ?</Label>
              <div className="grid gap-3">
                {[
                  ["walk_transit", "Tout faire à pied / en transports"],
                  ["car_if_worth_it", "Prendre une voiture si ça vaut vraiment le coup"],
                  ["car_ok", "Se déplacer en voiture ne lui pose aucun problème"],
                ].map(([value, label]) => <SelectableOption key={value} active={localMobility === value} onClick={() => setLocalMobility(value as typeof localMobility)}><span className="flex items-center gap-2"><KrewIcon name={value === "walk_transit" ? "walk" : "car"} tone={localMobility === value ? "plum" : "muted"} size="sm" className="size-4 shrink-0" />{label}</span></SelectableOption>)}
              </div>
            </div>
          </div>
        </Section>

        <Section title={`Disponibilités de ${starName}`} hint={`Indique les dates où ${starName} serait disponible ou indisponible.`}>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPaintMode("available")} aria-pressed={paintMode === "available"} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium", paintMode === "available" ? "border-sage/40 bg-sage/20 font-semibold text-primary" : "border-border bg-background text-muted-foreground")}><span className="size-2.5 rounded-full bg-current" /> Disponible</button>
              <button type="button" onClick={() => setPaintMode("blocked")} aria-pressed={paintMode === "blocked"} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium", paintMode === "blocked" ? "border-destructive bg-destructive font-semibold text-white" : "border-border bg-background text-muted-foreground")}><span className="size-2.5 rounded-full bg-current" /> Impossible</button>
            </div>
            <div className="flex items-center justify-between"><Button type="button" variant="ghost" size="icon" aria-label="Mois précédents" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset <= 0}><ChevronLeft className="size-4" /></Button><p className="text-[13px] text-muted-foreground">Fais défiler les mois →</p><Button type="button" variant="ghost" size="icon" aria-label="Mois suivants" onClick={() => setMonthOffset((o) => o + 1)}><ChevronRight className="size-4" /></Button></div>
            <div className="grid gap-3 sm:grid-cols-2">{months.map((m) => <MonthGrid key={toISO(m)} month={m} selection={selection} onToggle={toggleDay} />)}</div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1"><button type="button" onClick={selectWeekendsInView} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">Sélectionner tous les week-ends affichés</button><button type="button" onClick={() => setSelection(new Map())} className="inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Tout effacer</button></div>
          </div>
        </Section>

        <section className="mb-6 space-y-2 pb-6">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground"><KrewIcon name="message" tone="plum" size="sm" className="size-4 shrink-0" />Autres précisions utiles sur ses préférences</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Précisions utiles pour le groupe…" className="min-h-[120px] rounded-xl border-border text-base focus-visible:ring-primary" />
        </section>

        <div className="pb-12 pt-2">
          <KrewStatefulButton className="max-w-full" idleLabel={starMode !== "secret" ? "La Star répond elle-même en mode participant" : data.preferences ? "Enregistrer les modifications" : "Enregistrer les préférences de la Star"} loadingLabel="Enregistrement…" successLabel="Préférences enregistrées" errorLabel="Réessayer" disabled={starMode !== "secret"} onAction={() => mutation.mutateAsync()} />
        </div>
      </div>
    </main>
  );
}