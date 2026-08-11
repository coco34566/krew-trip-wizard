import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Sparkles, MapPin, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getStarPreferences, submitStarPreferences } from "@/lib/star-preferences.functions";
import {
  AMBIANCES,
  STAR_DEAL_BREAKERS,
  STAR_WANTED_ACTIVITIES,
} from "@/lib/krew/constants";
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
  "déguisement": "🎭",
  "strip-tease": "🔞",
  "activités extrêmes": "🪂",
  "musée": "🏛️",
  "camping": "⛺",
  "foule": "👥",
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
    <div className="rounded-2xl border border-border bg-surface/40 p-3">
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
                "aspect-square rounded-xl text-sm font-medium transition",
                isPast && "cursor-not-allowed opacity-30",
                !isPast && !mode && "bg-background hover:bg-primary/10 hover:text-primary",
                mode === "available" && "bg-lagoon text-white shadow-sm hover:bg-lagoon/90",
                mode === "blocked" && "bg-destructive/90 text-white hover:bg-destructive",
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
    meta: [{ title: "Préférences de la star — Krew" }],
  }),
  component: StarQuestionnaire,
});

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-surface/60 text-muted-foreground hover:border-primary/50",
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

  const [wanted, setWanted] = useState<string[]>([]);
  const [breakers, setBreakers] = useState<string[]>([]);
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  // Nouveaux champs pour la star
  const [departureCity, setDepartureCity] = useState("");
  const [departureAirportOrStation, setDepartureAirportOrStation] = useState("");
  const [desiredDestination, setDesiredDestination] = useState("");
  const [excludedDestinations, setExcludedDestinations] = useState("");
  const [wantedEnvType, setWantedEnvType] = useState("");

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
        setWantedEnvType((data.preferences as any).wantedEnvType ?? "");

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
          wantedEnvType: wantedEnvType || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.isUpdate ? "Préférences de la star mises à jour" : "Préférences de la star enregistrées");
      queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => toast.error(String(e?.message ?? e).slice(0, 120)),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </main>
    );
  }

  if (!data?.trip.hasStar) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-muted-foreground">
          Ce type de voyage n’a pas de personne principale (star).
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour à Mon Voyage
          </Link>
        </Button>
      </main>
    );
  }

  const starName = data.trip.celebratedPerson || "la personne principale";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <a href={`/trips/${tripId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Retour à Mon Voyage</a>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Préférences de {starName}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Complément dédié à <strong>{starName}</strong> — ne remplace pas le questionnaire du groupe.
        Ses réponses sont intégrées aux compteurs de participation et pèsent davantage dans les recommandations.
      </p>

      {/* Point de départ */}
      <section className="mt-8 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          Point de départ
        </h2>
        <div>
          <Label htmlFor="departure">Ville de départ (ou code postal)</Label>
          <div className="mt-2">
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
        </div>
      </section>

      {/* Destinations rêvées / banni */}
      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Lieux rêvés / à bannir</h2>
        <div>
          <Label htmlFor="destination">Destination rêvée (optionnel)</Label>
          <Input
            id="destination"
            value={desiredDestination}
            onChange={(e) => setDesiredDestination(e.target.value)}
            placeholder="Ex : Lisbonne, Barcelone…"
            className="mt-2"
          />
        </div>
        <div className="mt-2">
          <Label htmlFor="excluded">Destinations à éviter (optionnel)</Label>
          <Input
            id="excluded"
            value={excludedDestinations}
            onChange={(e) => setExcludedDestinations(e.target.value)}
            placeholder="Ex : Ibiza, Marrakech (séparées par des virgules)"
            className="mt-2"
          />
        </div>
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label className="font-semibold block text-sm">Type de lieu / environnement recherché (optionnel)</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "Centre-ville / urbain", label: "🏢 Centre-ville / urbain" },
              { v: "Quartier animé", label: "🍻 Quartier animé" },
              { v: "Bord de mer", label: "🌊 Bord de mer" },
              { v: "Nature / pleine nature", label: "🌳 Nature / pleine nature" },
              { v: "Village de charme", label: "🏡 Village de charme" },
              { v: "Montagne", label: "🏔️ Montagne" },
              { v: "Lac / rivière", label: "🚣 Lac / rivière" }
            ].map((env) => (
              <Chip
                key={env.v}
                active={wantedEnvType === env.v}
                onClick={() => setWantedEnvType(env.v)}
              >
                {env.label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {/* Disponibilités Calendrier */}
      <section className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ses disponibilités</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sélectionne les dates où la star est disponible ou indisponible.
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
            <MonthGrid
              key={toISO(m)}
              month={m}
              selection={selection}
              onToggle={toggleDay}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={selectWeekendsInView}>
            Tous les week-ends affichés
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={clearSelection}>
            Tout effacer
          </Button>
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Activités souhaitées</h2>
        <div className="flex flex-wrap gap-2">
          {STAR_WANTED_ACTIVITIES.map((a) => (
            <Chip key={a} active={wanted.includes(a)} onClick={() => toggle(wanted, setWanted, a)}>
              {STAR_WANTED_ACTIVITIES_EMOJIS[a] || "✨"} {a}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ce qu’elle / il refuse absolument</h2>
        <div className="flex flex-wrap gap-2">
          {STAR_DEAL_BREAKERS.map((a) => (
            <Chip
              key={a}
              active={breakers.includes(a)}
              onClick={() => toggle(breakers, setBreakers, a)}
            >
              {STAR_DEAL_BREAKERS_EMOJIS[a] || "🚫"} {a}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">Ambiance recherchée</h2>
        <div className="flex flex-wrap gap-2">
          {AMBIANCES.map((a) => (
            <Chip
              key={a.value}
              active={ambiances.includes(a.value)}
              onClick={() => toggle(ambiances, setAmbiances, a.value)}
            >
              {a.emoji} {a.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-5">
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Précisions utiles pour le groupe…"
        />
      </section>

      <Button
        className="mt-6 w-full"
        size="lg"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="size-4 mr-2" />}
        {data.preferences ? "Modifier" : "Enregistrer les préférences de la star"}
      </Button>
    </main>
  );
}
