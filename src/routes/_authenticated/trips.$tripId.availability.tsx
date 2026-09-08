import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getTripAvailability,
  submitMyAvailability,
  chooseTripDates,
  unlockTripDates,
} from "@/lib/availability.functions";
import { KrewIcon, KrewNote } from "@/components/krew/visual-language";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
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

function dayAriaLabel(date: Date, mode: DayMode, isPast: boolean, readOnly: boolean) {
  const label = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (isPast) return `${label}, date passée`;
  const state = mode === "available" ? "disponible" : mode === "blocked" ? "impossible" : "non renseigné";
  return readOnly ? `${label}, ${state}, consultation uniquement` : `${label}, ${state}`;
}

function MonthGrid({ month, selection, onToggle, readOnly }: { month: Date; selection: Map<string, DayMode>; onToggle: (iso: string) => void; readOnly: boolean }) {
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
              disabled={isPast || readOnly}
              aria-label={dayAriaLabel(date, mode, isPast, readOnly)}
              aria-pressed={isPast ? undefined : mode !== null}
              onClick={() => onToggle(iso)}
              className={cn(
                "flex aspect-square min-h-10 items-center justify-center rounded-[10px] border text-[13px] font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                (isPast || readOnly) && "cursor-default",
                isPast && "border-transparent opacity-30",
                !isPast && !mode && "border-border/40 bg-background",
                !readOnly && !isPast && !mode && "hover:border-primary/25 hover:bg-primary/[0.05] hover:text-primary",
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

function AvailabilityPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAvail = useServerFn(getTripAvailability);
  const submit = useServerFn(submitMyAvailability);
  const choose = useServerFn(chooseTripDates);
  const unlock = useServerFn(unlockTripDates);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvail({ data: { tripId } }),
  });

  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
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

  const availableDates = useMemo(() => [...selection.entries()].filter(([, v]) => v === "available").map(([k]) => k).sort(), [selection]);
  const blockedDates = useMemo(() => [...selection.entries()].filter(([, v]) => v === "blocked").map(([k]) => k).sort(), [selection]);

  function toggleDay(iso: string) {
    if (data?.trip.datesLocked) return;
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

  const baseMonth = startOfMonth(new Date());
  const months = [0, 1].map((i) => addMonths(baseMonth, monthOffset + i));

  function selectWeekendsInView() {
    if (data?.trip.datesLocked) return;
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

  const mutation = useMutation({
    mutationFn: () => submit({ data: { tripId, availableDates, blockedDates, flexDays: 0, notes: notes || undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      navigate({ to: "/trips/$tripId", params: { tripId } });
    },
    onError: (e: any) => {
      console.error("Impossible d'enregistrer les disponibilités:", e);
      toast.error("Impossible d’enregistrer tes disponibilités. Réessaie dans un instant.");
    },
  });

  const chooseMutation = useMutation({
    mutationFn: (payload: { start: string; end: string }) => choose({ data: { tripId, startDate: payload.start, endDate: payload.end } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
    },
    onError: (e: any) => {
      console.error("Impossible de confirmer les dates:", e);
      toast.error("Impossible de confirmer les dates pour le moment. Réessaie dans un instant.");
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlock({ data: { tripId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (e: any) => {
      console.error("Impossible de rendre les dates modifiables:", e);
      toast.error("Impossible de modifier les dates pour le moment. Réessaie dans un instant.");
    },
  });

  if (isLoading) {
    return (
      <KrewJourneyLoadingState
        maxWidthClassName="max-w-[820px]"
        message="Chargement des disponibilités…"
      />
    );
  }

  if (error || !data) {
    console.error("Impossible de charger les disponibilités:", error);
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        returnLabel="Retour au voyage"
        title="Impossible de charger les disponibilités"
        description="Les réponses du groupe ne sont pas disponibles pour le moment."
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  const datesLocked = Boolean(data.trip.datesLocked);
  const lockedLabel = data.trip.lockedStart && data.trip.lockedEnd ? formatRange(data.trip.lockedStart, data.trip.lockedEnd) : null;

  return (
    <KrewPageShell data-krew-availability-page size="form" className="space-y-8 py-8 sm:py-10">
      <Link to="/trips/$tripId" params={{ tripId }} className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="size-4" /> Retour au voyage</Link>

      <KrewJourneyPageHeader tripName={data.trip.name} title="Disponibilités" otterSrc="/brand/otter-states/availability.png">
        {datesLocked ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[15px] font-medium text-foreground"><Lock className="size-4 text-primary" /> Les dates du voyage sont confirmées.</p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">Tes disponibilités restent visibles pour mémoire, mais elles ne sont plus modifiables.</p>
          </div>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[14px] leading-relaxed sm:text-[15px]">
            <span className="font-mono font-bold text-primary">{data.answered}</span>
            <span className="font-medium text-foreground">participant{data.answered > 1 ? "s" : ""} ayant répondu</span>
            <span className="text-muted-foreground" aria-hidden="true">/</span>
            <span className="font-mono font-bold text-primary">{data.expected}</span>
            <span className="text-muted-foreground">participants au total du voyage</span>
          </p>
        )}
      </KrewJourneyPageHeader>

      {datesLocked && lockedLabel ? (
        <KrewJourneyStatusPanel
          title="Dates choisies"
          icon="check"
          tone="complete"
          action={data.isOwner ? (
            <button
              type="button"
              disabled={unlockMutation.isPending}
              aria-busy={unlockMutation.isPending}
              onClick={() => {
                if (window.confirm("Rendre les dates modifiables à nouveau ?")) unlockMutation.mutate();
              }}
              className="inline-flex min-h-10 items-center text-[14px] font-semibold text-primary underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60"
            >
              {unlockMutation.isPending ? "Modification…" : "Modifier les dates"}
            </button>
          ) : undefined}
        >
          <p className="font-mono text-foreground">{lockedLabel}</p>
          <p>Les dates sont confirmées pour la suite de l’organisation.</p>
        </KrewJourneyStatusPanel>
      ) : null}

      <section className="w-full space-y-7">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[25px] font-normal text-foreground sm:text-[28px]"><KrewIcon name="calendar" tone="plum" size="sm" className="size-5" /> Mes disponibilités</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{datesLocked ? "Voici les disponibilités que tu avais renseignées avant la confirmation des dates." : <>Tape sur les jours pour les sélectionner — tu peux en choisir autant que tu veux. Tes réponses sont liées à <strong>ton compte</strong> : personne d&apos;autre ne peut les modifier.</>}</p>
        </div>

        {!datesLocked ? (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Mode de sélection des dates">
            <button type="button" onClick={() => setPaintMode("available")} aria-pressed={paintMode === "available"} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", paintMode === "available" ? "border-sage/40 bg-sage/20 font-semibold text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/25")}><span className="size-2.5 rounded-full bg-current" /> Je suis dispo</button>
            <button type="button" onClick={() => setPaintMode("blocked")} aria-pressed={paintMode === "blocked"} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", paintMode === "blocked" ? "border-destructive bg-destructive font-semibold text-white" : "border-border bg-background text-muted-foreground hover:border-destructive/50")}><span className="size-2.5 rounded-full bg-current" /> Impossible</button>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon" aria-label="Mois précédents" onClick={() => setMonthOffset((o) => Math.max(0, o - 1))} disabled={monthOffset <= 0}><ChevronLeft className="size-4" /></Button>
          <p className="text-[12px] text-muted-foreground sm:text-[13px]">Fais défiler les mois →</p>
          <Button type="button" variant="ghost" size="icon" aria-label="Mois suivants" onClick={() => setMonthOffset((o) => o + 1)}><ChevronRight className="size-4" /></Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">{months.map((m) => <MonthGrid key={toISO(m)} month={m} selection={selection} onToggle={toggleDay} readOnly={datesLocked} />)}</div>

        {!datesLocked ? (
          <>
            <div className="flex items-center justify-end gap-2 sm:pr-2"><KrewIcon name="search" tone="sage" size="sm" className="size-5 shrink-0" /><KrewNote variant="tape" tone="sage" rotation={-1} size="sm" className="inline-block">On cherche le bon créneau</KrewNote></div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px]"><button type="button" onClick={selectWeekendsInView} className="inline-flex min-h-10 items-center font-semibold text-primary underline-offset-4 hover:underline">Sélectionner tous les week-ends affichés</button><button type="button" onClick={() => setSelection(new Map())} className="inline-flex min-h-10 items-center font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Tout effacer</button></div>
          </>
        ) : null}

        <div className="space-y-2"><Label htmlFor="availability-notes" className="text-[14px] font-semibold text-foreground">Notes (optionnel)</Label><Textarea id="availability-notes" className="min-h-[112px] rounded-[10px] border-border/70 text-[15px] shadow-none focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/10" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. : OK pour partir le jeudi soir, préfère un week-end…" disabled={datesLocked} /></div>

        {!datesLocked ? (
          <>
            <KrewStatefulButton className="max-w-full" idleLabel={data.mine ? "Mettre à jour mes disponibilités" : "Enregistrer mes disponibilités"} loadingLabel="Enregistrement…" successLabel="Disponibilités enregistrées" errorLabel="Réessayer" disabled={availableDates.length === 0} onAction={() => mutation.mutateAsync()} />
            {availableDates.length === 0 ? <p className="text-center text-[13px] text-muted-foreground">Sélectionne au moins une date verte pour enregistrer.</p> : null}
          </>
        ) : null}
      </section>

      {!datesLocked && data.isOwner && (data.windows ?? []).length > 0 ? (
        <section className="space-y-3 border-t border-border/45 pt-6">
          <h2 className="font-display text-[24px] font-normal text-foreground">Créneaux possibles</h2>
          <ul className="space-y-2">
            {(data.windows ?? []).map((window: any) => (
              <li key={`${window.start}-${window.end}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3">
                <span className="text-sm font-medium">{formatRange(window.start, window.end)}</span>
                <KrewStatefulButton size="sm" idleLabel="Choisir ces dates" loadingLabel="Validation…" successLabel="Dates choisies" errorLabel="Réessayer" onAction={() => chooseMutation.mutateAsync({ start: window.start, end: window.end })} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </KrewPageShell>
  );
}
