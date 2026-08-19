import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Loader2,
  CalendarDays,
  Lock,
  Unlock,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  getTripAvailability,
  submitMyAvailability,
  chooseTripDates,
  unlockTripDates,
} from "@/lib/availability.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trips/$tripId/availability")({
  head: () => ({
    meta: [
      { title: "Disponibilités — KREW" },
      { name: "description", content: "Indique et enregistre tes disponibilités pour ce voyage." },
    ],
  }),
  component: AvailabilityPage,
});

type DayMode = "available" | "blocked" | null;

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

function formatRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString("fr-FR")} → ${new Date(end).toLocaleDateString("fr-FR")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Grille calendrier d'un mois — clic pour basculer disponible / impossible */
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
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground font-mono">
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

function AvailabilityPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAvail = useServerFn(getTripAvailability);
  const submit = useServerFn(submitMyAvailability);
  const choose = useServerFn(chooseTripDates);
  const unlock = useServerFn(unlockTripDates);

  const { data, isLoading, error } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
  });

  /** iso → available | blocked */
  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  /** Mode de clic : dispo (vert) ou impossible (rouge) */
  const [paintMode, setPaintMode] = useState<"available" | "blocked">("available");

  useEffect(() => {
    if (data && !hydrated) {
      if (data.mine) {
        const m = new Map<string, DayMode>();
        for (const d of data.mine.availableDates ?? []) m.set(d.slice(0, 10), "available");
        for (const d of data.mine.blockedDates ?? []) m.set(d.slice(0, 10), "blocked");
        setSelection(m);
        setNotes(data.mine.notes ?? "");
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
    mutationFn: () =>
      submit({
        data: {
          tripId,
          availableDates,
          blockedDates,
          flexDays: 0,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(
        availableDates.length
          ? `${availableDates.length} date(s) dispo enregistrée(s)`
          : "Disponibilités enregistrées",
      );
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur").slice(0, 160)),
  });

  const chooseMutation = useMutation({
    mutationFn: (payload: { start: string; end: string }) =>
      choose({ data: { tripId, startDate: payload.start, endDate: payload.end } }),
    onSuccess: () => {
      toast.success("Dates du voyage validées");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur").slice(0, 120)),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlock({ data: { tripId } }),
    onSuccess: () => {
      toast.success("Date déverrouillée");
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Erreur").slice(0, 120)),
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-40 w-full rounded-3xl" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-destructive">{(error as any)?.message ?? "Impossible de charger"}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/trips/$tripId" params={{ tripId }}>
            Retour
          </Link>
        </Button>
      </main>
    );
  }

  const datesLocked = Boolean(data.trip.datesLocked);
  const lockedLabel =
    data.trip.lockedStart && data.trip.lockedEnd
      ? formatRange(data.trip.lockedStart, data.trip.lockedEnd)
      : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <a
        href={`/trips/${tripId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour à Mon Voyage
      </a>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Disponibilités · résumé live
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{data.trip.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.answered}/{data.expected} ont indiqué leurs dates
        </p>
      </header>

      {/* Formulaire ultra simple */}
      <section className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-display text-lg font-semibold">Mes disponibilités</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tape sur les jours pour les sélectionner — tu peux en choisir autant que tu veux. Tes
            réponses sont liées à <strong>ton compte</strong> : personne d&apos;autre ne peut les
            modifier.
          </p>
        </div>

        {/* Mode peinture */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPaintMode("available")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              paintMode === "available"
                ? "border-lagoon bg-lagoon text-white"
                : "border-border bg-background text-muted-foreground hover:border-lagoon/50",
            )}
          >
            <span className="size-2.5 rounded-full bg-current" /> Je suis dispo
          </button>
          <button
            type="button"
            onClick={() => setPaintMode("blocked")}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              paintMode === "blocked"
                ? "border-destructive bg-destructive text-white"
                : "border-border bg-background text-muted-foreground hover:border-destructive/50",
            )}
          >
            <span className="size-2.5 rounded-full bg-current" /> Impossible
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
          <p className="text-xs text-muted-foreground">Fais défiler les mois →</p>
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

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectWeekendsInView}>
            Tous les week-ends affichés
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            Tout effacer
          </Button>
        </div>

        {/* Chips résumé */}
        <div className="space-y-2">
          <div>
            <p className="text-xs font-medium text-lagoon">Dispo ({availableDates.length})</p>
            {availableDates.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune date sélectionnée</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {availableDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className="inline-flex items-center gap-1 rounded-full bg-lagoon/15 px-2.5 py-1 text-xs text-foreground"
                  >
                    {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    <X className="size-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {blockedDates.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-destructive">
                Impossible ({blockedDates.length})
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {blockedDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs"
                  >
                    {new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    <X className="size-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <Label>Notes (optionnel)</Label>
          <Textarea
            className="mt-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. : OK pour partir le jeudi soir, préfère un week-end…"
          />
        </div>

        {datesLocked ? (
          <p className="rounded-2xl border border-lagoon/40 bg-lagoon/10 px-4 py-3 text-sm text-foreground">
            <Lock className="mr-1.5 inline size-4 text-lagoon" />
            Dates validées par l&apos;organisateur·rice — tes disponibilités sont figées et ne
            peuvent plus être modifiées.
          </p>
        ) : null}
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || availableDates.length === 0 || datesLocked}
          className="w-full"
          size="lg"
        >
          {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {data.mine ? "Mettre à jour mes disponibilités" : "Enregistrer mes disponibilités"}
        </Button>
        {availableDates.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            Sélectionne au moins une date verte pour enregistrer.
          </p>
        ) : null}
      </section>

      {/* Date verrouillée */}
      {datesLocked && lockedLabel ? (
        <section className="mt-6 rounded-3xl border border-lagoon/40 bg-lagoon/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 text-lagoon" />
              <div>
                <h2 className="font-semibold">Date choisie (verrouillée)</h2>
                <p className="mt-1 text-sm">
                  <strong>{lockedLabel}</strong>
                </p>
              </div>
            </div>
            {data.isOwner ? (
              <Button
                variant="outline"
                size="sm"
                disabled={unlockMutation.isPending}
                onClick={() => {
                  if (window.confirm("Déverrouiller la date ?")) unlockMutation.mutate();
                }}
              >
                {unlockMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Unlock className="size-4" />
                )}
                Déverrouiller
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
