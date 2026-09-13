import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewIcon, KrewNote } from "@/components/krew/visual-language";
import { getTripAvailability, submitMyAvailability } from "@/lib/availability.functions";
import { cn } from "@/lib/utils";

type DayMode = "available" | "blocked" | null;

function toISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
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
  for (let index = 0; index < startWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return (
    <div className="rounded-[16px] border border-border/45 bg-background p-3.5">
      <p className="mb-2 text-center text-sm font-semibold capitalize">{monthLabel(month)}</p>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[12px] font-medium uppercase text-muted-foreground" aria-hidden="true">
        {["L", "M", "M", "J", "V", "S", "D"].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
          const iso = toISO(date);
          const mode = selection.get(iso) ?? null;
          const isPast = iso < todayISO;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              aria-pressed={isPast ? undefined : mode !== null}
              onClick={() => onToggle(iso)}
              className={cn(
                "flex aspect-square min-h-10 items-center justify-center rounded-[10px] border text-[13px] font-mono font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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

export function ParticipantAvailabilityStep({
  tripId,
  onComplete,
}: {
  tripId: string;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const fetchAvailability = useServerFn(getTripAvailability);
  const submitAvailability = useServerFn(submitMyAvailability);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvailability({ data: { tripId } }),
    retry: false,
  });

  const [selection, setSelection] = useState<Map<string, DayMode>>(new Map());
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [paintMode, setPaintMode] = useState<"available" | "blocked">("available");

  useEffect(() => {
    if (!data || hydrated) return;
    const next = new Map<string, DayMode>();
    for (const date of data.mine?.availableDates ?? []) next.set(date.slice(0, 10), "available");
    for (const date of data.mine?.blockedDates ?? []) next.set(date.slice(0, 10), "blocked");
    setSelection(next);
    setNotes(data.mine?.notes ?? "");
    setHydrated(true);
  }, [data, hydrated]);

  const availableDates = useMemo(
    () => [...selection.entries()].filter(([, value]) => value === "available").map(([date]) => date).sort(),
    [selection],
  );
  const blockedDates = useMemo(
    () => [...selection.entries()].filter(([, value]) => value === "blocked").map(([date]) => date).sort(),
    [selection],
  );

  const baseMonth = startOfMonth(new Date());
  const months = [0, 1].map((index) => addMonths(baseMonth, monthOffset + index));

  function toggleDay(iso: string) {
    setSelection((previous) => {
      const next = new Map(previous);
      const current = next.get(iso) ?? null;
      if (paintMode === "available") {
        if (current === "available") next.delete(iso);
        else next.set(iso, "available");
      } else if (current === "blocked") next.delete(iso);
      else next.set(iso, "blocked");
      return next;
    });
  }

  function selectWeekendsInView() {
    setSelection((previous) => {
      const next = new Map(previous);
      const todayISO = toISO(new Date());
      for (const month of months) {
        const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        for (let day = 1; day <= days; day += 1) {
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const iso = toISO(date);
          if (iso < todayISO) continue;
          if (date.getDay() === 0 || date.getDay() === 6) next.set(iso, paintMode);
        }
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () =>
      submitAvailability({
        data: {
          tripId,
          availableDates,
          blockedDates,
          flexDays: 0,
          notes: notes.trim() || undefined,
          durationNights: data?.trip.durationNights,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
      await queryClient.invalidateQueries({ queryKey: ["trip-progress", tripId] });
      onComplete();
    },
    onError: (mutationError: any) => {
      console.error("Impossible d'enregistrer les disponibilités:", mutationError);
      toast.error("Impossible d’enregistrer tes disponibilités. Réessaie dans un instant.");
    },
  });

  if (isLoading) {
    return <KrewJourneyLoadingState maxWidthClassName="max-w-[820px]" message="Chargement du questionnaire…" />;
  }

  if (error || !data) {
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        maxWidthClassName="max-w-[820px]"
        returnLabel="Retour au voyage"
        title="Impossible de charger le questionnaire"
        description="Tes disponibilités ne sont pas disponibles pour le moment."
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <KrewPageShell data-krew-availability-page size="form" className="space-y-[var(--krew-journey-content-gap)] py-8 sm:py-10">
      <KrewJourneyPageHeader
        tripName={data.trip.name}
        title="Questionnaire"
        otterSrc="/brand/otter-states/preferences.png"
      >
        <p>Une seule étape pour donner à KREW les informations nécessaires au voyage.</p>
        <p className="font-medium text-foreground">1/2 · Tes disponibilités</p>
      </KrewJourneyPageHeader>

      <section className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[length:var(--krew-title-section)] font-normal text-foreground">
            <KrewIcon name="calendar" tone="plum" size="sm" className="size-5" />
            Tes disponibilités
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
            Indique les jours qui fonctionnent pour toi. Cette information alimente le même moteur de dates qu’aujourd’hui.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Mode de sélection">
          <Button type="button" variant={paintMode === "available" ? "default" : "outline"} onClick={() => setPaintMode("available")}>
            Disponible
          </Button>
          <Button type="button" variant={paintMode === "blocked" ? "default" : "outline"} onClick={() => setPaintMode("blocked")}>
            Impossible
          </Button>
          <Button type="button" variant="outline" onClick={selectWeekendsInView}>
            Appliquer aux week-ends affichés
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => setMonthOffset((value) => Math.max(0, value - 2))} disabled={monthOffset === 0}>
            <ChevronLeft className="mr-1 size-4" /> Précédent
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMonthOffset((value) => value + 2)}>
            Suivant <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {months.map((month) => (
            <MonthGrid key={`${month.getFullYear()}-${month.getMonth()}`} month={month} selection={selection} onToggle={toggleDay} />
          ))}
        </div>

        <KrewNote tone="cream" className="max-w-full">
          Vert = disponible · Rouge = impossible. Tu peux modifier tes choix tant que les dates du groupe ne sont pas verrouillées.
        </KrewNote>

        <div className="space-y-2">
          <Label htmlFor="availability-notes" className="font-semibold text-base text-foreground">Précision sur tes disponibilités (optionnel)</Label>
          <Textarea
            id="availability-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Ex : je peux arriver le vendredi soir après 20h…"
            className="min-h-[100px] rounded-xl border-border focus-visible:ring-primary text-base"
          />
        </div>

        <div className="pb-12 pt-2">
          <KrewStatefulButton
            className="max-w-full"
            idleLabel={data.mine ? "Enregistrer et continuer" : "Continuer vers mes préférences"}
            loadingLabel="Enregistrement…"
            successLabel="Disponibilités enregistrées"
            errorLabel="Réessayer"
            onAction={() => mutation.mutateAsync()}
          />
        </div>
      </section>
    </KrewPageShell>
  );
}
