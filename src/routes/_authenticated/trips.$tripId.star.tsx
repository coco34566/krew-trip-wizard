import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getStarPreferences, submitStarPreferences } from "@/lib/star-preferences.functions";
import { AMBIANCES, STAR_DEAL_BREAKERS, STAR_WANTED_ACTIVITIES } from "@/lib/krew/constants";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
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
  const startWeekday = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayISO = toISO(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{monthLabel(month)}</p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
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
                "aspect-square rounded-xl text-sm font-mono font-medium transition min-h-[38px] flex items-center justify-center",
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
        "cursor-pointer rounded-[14px] border p-4 text-left text-sm font-medium transition-colors select-none",
        active
          ? "border-primary bg-primary/5 text-foreground"
          : "border-border bg-background text-foreground/80 hover:border-primary/40",
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

  const { data, isLoading } = useQuery({
    queryKey: ["star-prefs", tripId],
    queryFn: () => fetchStar({ data: { tripId } }),
  });

  useEffect(() => {
    if ((data as any)?.starMode === "participant") {
      navigate({ to: "/trips/$tripId", params: { tripId }, replace: true });
    }
  }, [data, navigate, tripId]);

  const [wanted, setWanted] = useState<string[]>([]);
  const [breakers, setBreakers] = useState<string[]>([]);
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Nouveaux champs pour la star
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

  // Disponibilités de la star (iso → DayMode)
  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [paintMode, setPaintMode] = useState<"available" | "blocked">("available");
  const [monthOffset, setMonthOffset] = useState(0);

  const [hydrated, setHydrated] = useState(false);

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
    onSuccess: (res) => {
      toast.success(
        res.isUpdate
          ? "Préférences de la Star mises à jour"
          : "Préférences de la Star enregistrées",
      );
      queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 120)),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[820px] space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-[24px]" />
      </main>
    );
  }

  if (!data?.trip.hasStar) {
    return (
      <main className="mx-auto max-w-[820px] text-center space-y-4 pt-8">
        <p className="text-muted-foreground">
          Ce type de voyage n’a pas de personne principale (star).
        </p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour au voyage
          </Link>
        </Button>
      </main>
    );
  }

  const starName = data.trip.celebratedPerson || "la personne principale";

  return (
    <main className="mx-auto max-w-[820px] space-y-8">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="size-4" /> Retour au voyage
      </Link>

      <div className="space-y-2 relative">
        <div className="relative inline-block">
          <h1 className="font-display text-[40px] sm:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
            Préférences de {starName}
          </h1>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-0 -bottom-2 w-[160px] pointer-events-none"
          />
        </div>
        <p className="text-sm text-muted-foreground font-sans pt-1">
          Complète les réponses au nom de <strong>{starName}</strong> pour ce voyage.
        </p>
      </div>

      <div className="pt-4">
        {/* 1. Envies & ambiance */}
        <section className="border-b border-border/50 pb-8 mb-8 space-y-6">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-normal text-foreground">Quelles activités plairaient à {starName} ?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STAR_WANTED_ACTIVITIES.map((a) => (
                <SelectableOption key={a} active={wanted.includes(a)} onClick={() => toggle(wanted, setWanted, a)}>
                  <span className="mr-1.5">{STAR_WANTED_ACTIVITIES_EMOJIS[a] || "✨"}</span> {a.charAt(0).toUpperCase() + a.slice(1)}
                </SelectableOption>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h2 className="font-display text-2xl font-normal text-foreground">Quelle ambiance {starName} apprécierait ?</h2>
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

          <div className="space-y-4 pt-2">
            <h2 className="font-display text-2xl font-normal text-foreground">Que refuserait absolument {starName} ?</h2>
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

        {/* 2. Destination & cadre */}
        <section className="border-b border-border/50 pb-8 mb-8 space-y-4">
          <h2 className="font-display text-2xl font-normal text-foreground">Les lieux qui plairaient à {starName}</h2>
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
                {
                  v: 2,
                  label:
                    "☀️ Je veux privilégier une destination avec de bonnes chances de beau temps",
                },
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

        {/* 3. Hébergement */}
        <section className="border-b border-border/50 pb-8 mb-8 space-y-4">
          <h2 className="font-display text-2xl font-normal text-foreground">Hébergement</h2>
          <div className="space-y-3">
            <Label className="font-semibold block text-base text-foreground">Pour {starName}, le logement serait plutôt…</Label>
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

        {/* 4. Transport */}
        <section className="border-b border-border/50 pb-8 mb-8 space-y-6">
          <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
            <KrewIcon name="transport" tone="plum" size="sm" className="size-5" />
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
                  {label}
                </SelectableOption>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Disponibilités Calendrier */}
        <section className="space-y-4 pb-8 mb-8 border-b border-border/50">
          <h2 className="font-display text-2xl font-normal text-foreground">Disponibilités de {starName}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Indique les dates où {starName} serait disponible ou indisponible.
          </p>

          {/* Mode peinture */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPaintMode("available")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                paintMode === "available"
                  ? "border-lagoon bg-lagoon text-white"
                  : "border-border bg-background text-muted-foreground hover:border-lagoon/50",
              )}
            >
              <span className="size-2 rounded-full bg-current" /> Disponible
            </button>
            <button
              type="button"
              onClick={() => setPaintMode("blocked")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition",
                paintMode === "blocked"
                  ? "border-destructive bg-destructive text-white"
                  : "border-border bg-background text-muted-foreground hover:border-destructive/50",
              )}
            >
              <span className="size-2 rounded-full bg-current" /> Impossible
            </button>
          </div>

          {/* Navigation mois */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
              disabled={monthOffset <= 0}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-[10px] text-muted-foreground">Fais défiler les mois →</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
              size="sm"
              className="text-xs"
              onClick={selectWeekendsInView}
            >
              Tous les week-ends affichés
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={clearSelection}
            >
              Tout effacer
            </Button>
          </div>
        </section>

        {/* 6. Précisions */}
        <section className="space-y-2 pb-8">
          <Label className="font-semibold block text-base text-foreground">Autres précisions utiles sur les préférences de {starName}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Précisions utiles pour le groupe…"
            className="min-h-[120px] rounded-xl border-border focus-visible:ring-primary text-base"
          />
        </section>

        <div className="pt-2 pb-12">
          <Button
            className="w-full h-12 rounded-xl text-base font-medium"
            size="lg"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <KrewIcon name="favorite" tone="plum" size="sm" className="size-4 mr-2" />
            )}
            {data.preferences ? "Modifier" : "Enregistrer les préférences de la star"}
          </Button>
        </div>
      </div>
    </main>
  );
}
