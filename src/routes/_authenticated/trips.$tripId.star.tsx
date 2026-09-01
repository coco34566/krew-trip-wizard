import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { getStarPreferences, submitStarPreferences } from "@/lib/star-preferences.functions";
import { finalizeInvitationStep } from "@/lib/trips.functions";
import { AMBIANCES, STAR_DEAL_BREAKERS, STAR_WANTED_ACTIVITIES } from "@/lib/krew/constants";
import { KrewIcon, KrewMark, KrewHighlight } from "@/components/krew/visual-language";
import { cn } from "@/lib/utils";
import { CityAutocomplete } from "@/components/krew/CityAutocomplete";

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

function MonthGrid({
  month,
  selection,
  onToggle,
}: {
  month: Date;
  selection: Map<string, DayMode>;
  onToggle: (iso: string) => void;
}) {
  const first = startOfMonth(month);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayISO = toISO(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-3.5 shadow-none">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{monthLabel(month)}</p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[12px] font-medium uppercase text-muted-foreground">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`e-${i}`} />;
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
                "aspect-square min-h-10 rounded-xl text-sm font-mono font-medium transition flex items-center justify-center",
                isPast && "cursor-not-allowed opacity-30",
                !isPast && !mode && "bg-background hover:bg-primary/10 hover:text-primary border border-border/40",
                mode === "available" && "bg-secondary text-secondary-foreground shadow-sm hover:opacity-90 font-bold",
                mode === "blocked" && "bg-destructive/90 text-destructive-foreground hover:bg-destructive font-bold",
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

export const Route = createFileRoute("/_authenticated/trips/$tripId/star")({
  head: () => ({
    meta: [{ title: "Préférences de la Star — KREW" }],
  }),
  component: StarQuestionnaire,
});

function SelectableOption({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 cursor-pointer rounded-[14px] border p-4 text-left text-sm sm:text-base font-medium transition-colors select-none",
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

function toggle(list: string[], set: (v: string[]) => void, value: string) {
  set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
}

function StarQuestionnaire() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchStar = useServerFn(getStarPreferences);
  const submit = useServerFn(submitStarPreferences);
  const saveStarSetup = useServerFn(finalizeInvitationStep);

  const { data, isLoading } = useQuery({
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
  const [localMobility, setLocalMobility] = useState<
    "walk_transit" | "car_if_worth_it" | "car_ok" | null
  >(null);
  const [accommodationRole, setAccommodationRole] = useState<
    "base_only" | "part_of_stay" | "centerpiece" | null
  >(null);
  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [paintMode, setPaintMode] = useState<"available" | "blocked">("available");
  const [monthOffset, setMonthOffset] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data) { setStarMode((data as any).starMode === "participant" ? "participant" : "secret"); setStarPaysShare((data as any).starPaysShare !== false); }
  }, [data]);

  useEffect(() => {
    if (data && !hydrated) {
      if (data.preferences) {
        setWanted(data.preferences.wantedActivities);
        setBreakers(data.preferences.dealBreakers);
        setAmbiances(data.preferences.ambiances);
        setNotes(data.preferences.notes ?? "");
        setDepartureCity(data.preferences.departureCity ?? "");
        setDepartureAirportOrStation(data.preferences.departureAirportOrStation ?? "");
        setDesiredDestination(data.preferences.desiredDestination ?? "");
        setExcludedDestinations((data.preferences.excludedDestinations ?? []).join(", "));
        setWantedEnvTypes(
          (data.preferences as any).wantedEnvType
            ? (data.preferences as any).wantedEnvType.split(", ")
            : [],
        );
        setWeatherPreference((data.preferences as any).weatherPreference ?? 1);
        setLocalMobility((data.preferences as any).localMobility ?? null);
        setAccommodationRole((data.preferences as any).accommodationRole ?? null);

        const m = new Map<string, DayMode>();
        for (const d of data.preferences.availableDates ?? []) m.set(d.slice(0, 10), "available");
        for (const d of data.preferences.blockedDates ?? []) m.set(d.slice(0, 10), "blocked");
        setSelection(m);
      }
      setHydrated(true);
    }
  }, [data, hydrated]);

  const availableDates = useMemo(
    () =>
      [...selection.entries()]
        .filter(([, v]) => v === "available")
        .map(([k]) => k)
        .sort(),
    [selection],
  );
  const blockedDates = useMemo(
    () =>
      [...selection.entries()]
        .filter(([, v]) => v === "blocked")
        .map(([k]) => k)
        .sort(),
    [selection],
  );

  function toggleDay(iso: string) {
    setSelection((prev) => {
      const next = new Map(prev);
      const cur = next.get(iso) ?? null;
      if (paintMode === "available") {
        if (cur === "available") next.delete(iso);
        else next.set(iso, "available");
      } else {
        if (cur === "blocked") next.delete(iso);
        else next.set(iso, "blocked");
      }
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
          if (wd === 0 || wd === 6) {
            if (paintMode === "available") next.set(iso, "available");
            else next.set(iso, "blocked");
          }
        }
      }
      return next;
    });
  }

  function clearSelection() {
    setSelection(new Map());
  }

  const baseMonth = startOfMonth(new Date());
  const months = [0, 1].map((i) => addMonths(baseMonth, monthOffset + i));

  const setupMutation = useMutation({
    mutationFn: () => saveStarSetup({ data: { tripId, starMode, starPaysShare } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] }); queryClient.invalidateQueries({ queryKey: ["trip", tripId] }); },
    onError: (e: any) => {
      console.error("Impossible d'enregistrer les choix de la Star:", e);
      toast.error("Impossible d’enregistrer ces choix pour le moment.");
    },
  });

  const mutation = useMutation({
    mutationFn: () => {
      const excluded = excludedDestinations
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return submit({
        data: {
          tripId,
          wantedActivities: wanted,
          dealBreakers: breakers,
          ambiances,
          notes: notes.trim() || undefined,
          departureCity: departureCity.trim() || undefined,
          departureAirportOrStation: departureAirportOrStation.trim() || undefined,
          desiredDestination: desiredDestination.trim() || undefined,
          excludedDestinations: excluded,
          availableDates,
          blockedDates,
          wantedEnvType: wantedEnvTypes.join(", ") || undefined,
          weatherPreference,
          localMobility,
          accommodationRole,
        },
      });
    },
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

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[820px] px-5 sm:px-7 py-8 sm:py-10">
        <KrewThinkingState context="generic" customMessage="Chargement des préférences de la Star…" delayMs={0} />
      </main>
    );
  }

  if (!data?.trip.hasStar) {
    return (
      <main className="mx-auto max-w-[820px] px-5 sm:px-7 py-8 sm:py-10 text-center space-y-4">
        <p className="text-muted-foreground">
          Ce voyage n’a pas de Star.
        </p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour au voyage
          </Link>
        </Button>
      </main>
    );
  }

  const starName = data.trip.celebratedPerson || "la Star";

  return (
    <main className="mx-auto max-w-[820px] px-5 sm:px-7 py-8 sm:py-10 space-y-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <div className="space-y-2 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[34px] sm:text-[44px] font-normal leading-[0.98] tracking-tight text-foreground">
            Préférences de{" "}
            <KrewHighlight tone="plum" className="px-2 py-0.5 font-normal">
              {starName}
            </KrewHighlight>
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-1 -bottom-2 w-[clamp(96px,38vw,160px)] max-w-[70%] pointer-events-none"
          />
        </div>
        <p className="text-sm sm:text-base text-muted-foreground font-sans pt-1">
          Complète les réponses au nom de <strong>{starName}</strong> pour ce voyage.
        </p>
      </div>

      <section className="space-y-6 border-b border-border/50 pb-8">
        <div className="space-y-1.5"><h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="favorite" tone="plum" size="sm" className="size-5 shrink-0" />Pour commencer</h2><p className="text-sm leading-relaxed text-muted-foreground">Ces deux choix restent modifiables si l’organisation évolue.</p></div>
        <div className="space-y-4">
          <div className="space-y-3"><p className="text-base font-semibold leading-snug text-foreground">Comment participe {starName} à l’organisation ?</p><div className="grid gap-3 sm:grid-cols-2"><SelectableOption active={starMode === "secret"} onClick={() => data.trip.isOwner && setStarMode("secret")} className={!data.trip.isOwner ? "pointer-events-none opacity-60" : undefined}>Mode secret · tu complètes ses réponses</SelectableOption><SelectableOption active={starMode === "participant"} onClick={() => data.trip.isOwner && setStarMode("participant")} className={!data.trip.isOwner ? "pointer-events-none opacity-60" : undefined}>Mode participant · la Star répond elle-même</SelectableOption></div></div>
          <div className="space-y-3"><p className="text-base font-semibold leading-snug text-foreground">La Star participe-t-elle aux frais ?</p><div className="grid gap-3 sm:grid-cols-2"><SelectableOption active={starPaysShare} onClick={() => data.trip.isOwner && setStarPaysShare(true)} className={!data.trip.isOwner ? "pointer-events-none opacity-60" : undefined}>Oui, sa part reste incluse</SelectableOption><SelectableOption active={!starPaysShare} onClick={() => data.trip.isOwner && setStarPaysShare(false)} className={!data.trip.isOwner ? "pointer-events-none opacity-60" : undefined}>Non, sa part est répartie</SelectableOption></div></div>
        </div>
        {data.trip.isOwner ? <KrewStatefulButton variant="outline" className="w-full sm:w-auto" idleLabel="Enregistrer ces choix" loadingLabel="Enregistrement…" successLabel="Choix enregistrés" errorLabel="Réessayer" onAction={() => setupMutation.mutateAsync()} /> : null}
      </section>

      <div className="pt-2">
        <section className="border-b border-border/50 pb-9 mb-9 space-y-8">
          <div className="space-y-4">
            <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="preferences" tone="plum" size="sm" className="size-5 shrink-0" />Quelles activités plairaient à {starName} ?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAR_WANTED_ACTIVITIES.map((a) => (
                <SelectableOption key={a} active={wanted.includes(a)} onClick={() => toggle(wanted, setWanted, a)}>
                  <span className="mr-1.5">{STAR_WANTED_ACTIVITIES_EMOJIS[a] || "✨"}</span> {a.charAt(0).toUpperCase() + a.slice(1)}
                </SelectableOption>
              ))}
            </div>
          </div>

          <div className="space-y-5 pt-3">
            <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="party" tone="plum" size="sm" className="size-5 shrink-0" />Quelle ambiance {starName} apprécierait ?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMBIANCES.map((a) => (
                <SelectableOption
                  key={a.value}
                  active={ambiances.includes(a.value)}
                  onClick={() => toggle(ambiances, setAmbiances, a.value)}
                >
                  <span className="mr-1.5">{a.emoji}</span> {a.label}
                </SelectableOption>
              ))}
            </div>
          </div>

          <div className="space-y-5 pt-3">
            <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="attention" tone="plum" size="sm" className="size-5 shrink-0" />Que refuserait absolument {starName} ?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAR_DEAL_BREAKERS.map((a) => (
                <SelectableOption
                  key={a}
                  active={breakers.includes(a)}
                  onClick={() => toggle(breakers, setBreakers, a)}
                >
                  <span className="mr-1.5">{STAR_DEAL_BREAKERS_EMOJIS[a] || "🚫"}</span> {a}
                </SelectableOption>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-9 mb-9 space-y-6 font-sans border-b border-border/50">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="destination" tone="plum" size="sm" className="size-5 shrink-0" />Les lieux qui plairaient à {starName}</h2>
          <div className="space-y-2">
            <Label htmlFor="destination" className="font-semibold block text-base text-foreground">Quelle serait sa destination rêvée ? (optionnel)</Label>
            <Input
              id="destination"
              value={desiredDestination}
              onChange={(e) => setDesiredDestination(e.target.value)}
              placeholder="Ex : Lisbonne, Barcelone…"
              className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            />
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="excluded" className="font-semibold block text-base text-foreground">Quelles destinations {starName} voudrait éviter ? (optionnel)</Label>
            <Input
              id="excluded"
              value={excludedDestinations}
              onChange={(e) => setExcludedDestinations(e.target.value)}
              placeholder="Ex : Ibiza, Marrakech (séparées par des virgules)"
              className="h-12 rounded-xl border-border focus-visible:ring-primary text-base"
            />
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">
              Quel type de lieu plairait le plus à {starName} ?
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { v: "Centre-ville / urbain", label: "🏢 Centre-ville / urbain" },
                { v: "Quartier animé", label: "🍻 Quartier animé" },
                { v: "Bord de mer", label: "🌊 Bord de mer" },
                { v: "Nature / pleine nature", label: "🌳 Nature / pleine nature" },
                { v: "Village de charme", label: "🏡 Village de charme" },
                { v: "Montagne", label: "🏔️ Montagne" },
                { v: "Lac / rivière", label: "🚣 Lac / rivière" },
              ].map((env) => (
                <SelectableOption
                  key={env.v}
                  active={wantedEnvTypes.includes(env.v)}
                  onClick={() => toggle(wantedEnvTypes, setWantedEnvTypes, env.v)}
                >
                  {env.label}
                </SelectableOption>
              ))}
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Label className="font-semibold block text-base text-foreground">
              Quelle importance {starName} accorderait à la météo pour ce voyage ?
            </Label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { v: 2, label: "☀️ Je veux privilégier une destination avec de bonnes chances de beau temps" },
                { v: 1, label: "🌤️ C’est un plus, mais ce n’est pas déterminant" },
                { v: 0, label: "🌍 La météo n’est pas un critère pour moi" },
              ].map((opt) => (
                <SelectableOption
                  key={opt.v}
                  active={weatherPreference === opt.v}
                  onClick={() => setWeatherPreference(opt.v)}
                >
                  {opt.label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface/50 rounded-[20px] p-5 sm:p-7 pb-9 mb-9 space-y-6 font-sans">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="accommodation" tone="plum" size="sm" className="size-5 shrink-0" />Hébergement</h2>
          <div className="space-y-3">
            <Label className="font-semibold block text-base text-foreground">Pour {starName}, l’hébergement serait plutôt…</Label>
            <div className="grid grid-cols-1 gap-3">
              {[
                ["base_only", "Un point de chute"],
                ["part_of_stay", "Un lieu où on aime aussi passer du temps"],
                ["centerpiece", "Une vraie partie du voyage"],
              ].map(([value, label]) => (
                <SelectableOption
                  key={value}
                  active={accommodationRole === value}
                  onClick={() => setAccommodationRole(value as typeof accommodationRole)}
                >
                  {label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/50 pb-9 mb-9 space-y-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground">
            <KrewIcon name="transport" tone="plum" size="sm" className="size-5 shrink-0" />
            Transport
          </h2>
          <div className="space-y-2">
            <Label htmlFor="departure" className="font-semibold block text-base text-foreground">D’où partirait {starName} ? (ville ou code postal)</Label>
            <CityAutocomplete
              id="departure"
              value={departureCity}
              onChange={setDepartureCity}
              onSelect={(sel) => {
                setDepartureCity(sel.city);
                if (sel.airportIata) {
                  setDepartureAirportOrStation(sel.airportIata);
                } else {
                  setDepartureAirportOrStation("");
                }
              }}
              placeholder="Ex. Lyon, 69001, Paris…"
            />
          </div>
          <div className="space-y-3 pt-2">
            <Label className="font-semibold block text-base text-foreground">Sur place, qu’est-ce que {starName} préférerait ?</Label>
            <div className="grid grid-cols-1 gap-3">
              {[
                ["walk_transit", "Tout faire à pied / transports"],
                ["car_if_worth_it", "Une voiture si ça vaut vraiment le coup"],
                ["car_ok", "Aucun problème pour se déplacer en voiture"],
              ].map(([value, label]) => (
                <SelectableOption
                  key={value}
                  active={localMobility === value}
                  onClick={() => setLocalMobility(value as typeof localMobility)}
                >
                  <span className="flex items-center gap-2"><KrewIcon name={value === "walk_transit" ? "walk" : "car"} tone={localMobility === value ? "plum" : "muted"} size="sm" className="size-4 shrink-0" />{label}</span>
                </SelectableOption>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6 pb-9 mb-9 border-b border-border/50">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-normal text-foreground"><KrewIcon name="calendar" tone="plum" size="sm" className="size-5 shrink-0" />Disponibilités de {starName}</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Indique les dates où {starName} serait disponible ou indisponible.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaintMode("available")}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition",
                paintMode === "available"
                    ? "border-sage/40 bg-sage/20 text-primary font-semibold"
                    : "border-border bg-background text-muted-foreground hover:border-primary/25",
              )}
            >
              <span className="size-2 rounded-full bg-current" /> Disponible
            </button>
            <button
              type="button"
              onClick={() => setPaintMode("blocked")}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition",
                paintMode === "blocked"
                  ? "border-destructive bg-destructive text-white"
                  : "border-border bg-background text-muted-foreground hover:border-destructive/50",
              )}
            >
              <span className="size-2 rounded-full bg-current" /> Impossible
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mois précédents"
              onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
              disabled={monthOffset <= 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-center text-[13px] text-muted-foreground">Fais défiler les mois →</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Mois suivants"
              onClick={() => setMonthOffset((o) => o + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {months.map((m) => (
              <MonthGrid key={toISO(m)} month={m} selection={selection} onToggle={toggleDay} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-[13px]"
              onClick={selectWeekendsInView}
            >
              Tous les week-ends affichés
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-[13px]"
              onClick={clearSelection}
            >
              Tout effacer
            </Button>
          </div>
        </section>

        <section className="space-y-2 pb-8">
          <Label className="flex items-center gap-2 font-semibold text-base text-foreground"><KrewIcon name="message" tone="plum" size="sm" className="size-4 shrink-0" />Autres précisions utiles sur les préférences de {starName}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Précisions utiles pour le groupe…"
            className="min-h-[120px] rounded-xl border-border focus-visible:ring-primary text-base"
          />
        </section>

        <div className="pt-2 pb-12">
          <KrewStatefulButton
            className="max-w-full"
            idleLabel={starMode !== "secret" ? "La Star répond elle-même en mode participant" : data.preferences ? "Enregistrer les modifications" : "Enregistrer les préférences de la Star"}
            loadingLabel="Enregistrement…"
            successLabel="Préférences enregistrées"
            errorLabel="Réessayer"
            disabled={starMode !== "secret"}
            onAction={() => mutation.mutateAsync()}
          />
        </div>
      </div>
    </main>
  );
}
