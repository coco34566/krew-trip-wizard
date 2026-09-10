import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { KrewJourneyErrorState, KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { KrewPageShell } from "@/components/krew/KrewPageShell";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewIcon } from "@/components/krew/visual-language";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  calculateTripDateRange,
  chooseTripDates,
  getTripAvailability,
  unlockTripDates,
} from "@/lib/availability.functions";
import { buildTripIcs } from "@/lib/krew/calendar-export";
import { getTripDetail } from "@/lib/trips.functions";

function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", options);
}

export function TripDatesPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const fetchAvailability = useServerFn(getTripAvailability);
  const chooseDates = useServerFn(chooseTripDates);
  const unlockDates = useServerFn(unlockTripDates);
  const [manualStartDate, setManualStartDate] = useState("");

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });
  const availabilityQuery = useQuery({
    queryKey: ["trip-availability", tripId],
    queryFn: () => fetchAvailability({ data: { tripId } }),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trip-availability", tripId] });
    queryClient.invalidateQueries({ queryKey: ["generation-readiness", tripId] });
  };

  const chooseMutation = useMutation({
    mutationFn: ({ start, end }: { start: string; end: string }) =>
      chooseDates({ data: { tripId, startDate: start, endDate: end } } as any),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible de confirmer les dates:", error);
      toast.error("Impossible de confirmer ces dates pour le moment.");
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockDates({ data: { tripId } }),
    onSuccess: refresh,
    onError: (error) => {
      console.error("Impossible de modifier les dates:", error);
      toast.error("Impossible de rendre les dates modifiables pour le moment.");
    },
  });

  if (detailQuery.isLoading || availabilityQuery.isLoading) {
    return <KrewJourneyLoadingState message="Chargement des dates du groupe…" />;
  }

  if (!detailQuery.data || detailQuery.isError || availabilityQuery.isError) {
    const retrying = detailQuery.isFetching || availabilityQuery.isFetching;
    return (
      <KrewJourneyErrorState
        tripId={tripId}
        title="Impossible de charger les dates du groupe"
        description="Les disponibilités nécessaires au choix des dates ne sont pas disponibles pour le moment."
        retrying={retrying}
        onRetry={() => {
          void detailQuery.refetch();
          void availabilityQuery.refetch();
        }}
      />
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as any;
  const availability = availabilityQuery.data as any;
  const isAdmin = Boolean(data.isOwner);
  const datesLocked = Boolean(trip.dates_locked || availability?.trip?.datesLocked);
  const startDate = trip.start_date || availability?.trip?.lockedStart || null;
  const endDate = trip.end_date || availability?.trip?.lockedEnd || null;
  const expected = availability?.expected ?? trip.participants_count ?? 1;
  const answered = availability?.answered ?? 0;
  const windows = (availability?.windows ?? []) as any[];
  const manualRange = manualStartDate
    ? calculateTripDateRange(manualStartDate, Number(trip.duration_nights || 1))
    : null;

  const calendarUrls = (() => {
    if (!startDate || !endDate) return null;
    const start = String(startDate).replace(/-/g, "");
    const end = new Date(`${endDate}T12:00:00`);
    end.setDate(end.getDate() + 1);
    const exclusiveEnd = end.toISOString().slice(0, 10);
    const compactEnd = exclusiveEnd.replace(/-/g, "");
    const title = encodeURIComponent(trip.name || "Mon Voyage KREW");
    return {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${compactEnd}`,
      outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${startDate}&enddt=${exclusiveEnd}&allday=true`,
      office365: `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${startDate}&enddt=${exclusiveEnd}&allday=true`,
    };
  })();

  const downloadIcs = () => {
    const content = buildTripIcs(trip, trip.group_itinerary);
    if (!content) {
      toast.error("Impossible d’exporter le calendrier pour le moment.");
      return;
    }
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${trip.name || "voyage"}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const calendarAction = datesLocked ? (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">Ajouter au calendrier</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter au calendrier</DialogTitle>
          <DialogDescription>Choisis le calendrier que tu utilises.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button type="button" variant="outline" onClick={downloadIcs}>Apple / calendrier mobile (.ics)</Button>
          {calendarUrls ? (
            <>
              <Button asChild variant="outline"><a href={calendarUrls.google} target="_blank" rel="noreferrer">Google Calendar</a></Button>
              <Button asChild variant="outline"><a href={calendarUrls.outlook} target="_blank" rel="noreferrer">Outlook</a></Button>
              <Button asChild variant="outline"><a href={calendarUrls.office365} target="_blank" rel="noreferrer">Microsoft 365</a></Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  ) : undefined;

  return (
    <KrewPageShell size="standard" className="space-y-8 py-8 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <KrewJourneyPageHeader
        tripName={trip.name ?? "Voyage"}
        title="Dates du groupe"
        otterSrc="/brand/otter-states/availability.png"
      >
        <p>
          {datesLocked
            ? "Les dates sont confirmées pour le groupe."
            : `${answered}/${expected} disponibilités renseignées. L’organisateur·rice choisit les dates qui fonctionnent le mieux pour la Krew.`}
        </p>
      </KrewJourneyPageHeader>

      {availability?.schemaMissing ? (
        <KrewJourneyStatusPanel title="Disponibilités momentanément indisponibles" icon="attention" tone="info" role="alert">
          <p>Réessaie un peu plus tard pour choisir les dates du groupe.</p>
        </KrewJourneyStatusPanel>
      ) : datesLocked ? (
        <KrewJourneyStatusPanel
          title="Dates confirmées"
          icon="check"
          tone="complete"
          action={calendarAction}
        >
          <p className="font-medium text-foreground">
            {formatDate(startDate)} → {formatDate(endDate)}
          </p>
          <p>Cette étape est terminée et la suite de l’organisation peut avancer.</p>
        </KrewJourneyStatusPanel>
      ) : (
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="font-sans text-[15px] font-semibold text-foreground">Meilleurs créneaux du groupe</h2>
            <p className="text-[13px] leading-[1.5] text-muted-foreground sm:text-[14px]">
              Les créneaux sont classés selon le nombre de personnes disponibles.
            </p>
          </div>

          {windows.length ? (
            <ul className="divide-y divide-border/50 border-y border-border/45">
              {windows.slice(0, 3).map((window: any, index: number) => (
                <li key={`${window.start}-${window.end}`} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground sm:text-[15px]">
                      {index === 0 ? "🥇 " : index === 1 ? "🥈 " : "🥉 "}
                      {formatDate(window.start)} → {formatDate(window.end)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {window.covered}/{window.total} disponibles · {Math.round((window.coverageRatio ?? 0) * 100)} %
                    </p>
                    {window.availablePeople?.length ? (
                      <p className="mt-1 inline-flex items-start gap-1 text-xs text-primary">
                        <KrewIcon name="check" tone="sage" size="sm" className="mt-0.5 size-3.5 shrink-0" />
                        <span>{window.availablePeople.map((person: any) => person.name).join(", ")}</span>
                      </p>
                    ) : null}
                    {window.unavailablePeople?.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Indisponibles : {window.unavailablePeople.map((person: any) => person.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {isAdmin ? (
                    <KrewStatefulButton
                      size="sm"
                      variant={index === 0 ? "default" : "outline"}
                      idleLabel="Choisir ces dates"
                      loadingLabel="Validation…"
                      successLabel="Dates choisies"
                      errorLabel="Réessayer"
                      onAction={() => chooseMutation.mutateAsync({ start: window.start, end: window.end })}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
              Aucune date commune pour le moment. Il manque peut-être encore des disponibilités.
            </div>
          )}

          {isAdmin ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">Choisir d’autres dates</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Choisir d’autres dates</DialogTitle>
                  <DialogDescription>La date de fin est calculée selon la durée définie pour le voyage.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="manual-start-date" className="text-sm font-medium">Date de départ</label>
                    <Input
                      id="manual-start-date"
                      type="date"
                      className="mt-1.5"
                      value={manualStartDate}
                      onChange={(event) => setManualStartDate(event.target.value)}
                    />
                  </div>
                  {manualRange ? (
                    <p className="rounded-[18px] border border-border/55 bg-surface/40 px-4 py-3 text-sm font-medium">
                      {formatDate(manualRange.startDate, { day: "numeric" })} → {formatDate(manualRange.endDate, { day: "numeric", month: "long" })} · {trip.duration_nights} nuits
                    </p>
                  ) : null}
                  <KrewStatefulButton
                    idleLabel="Choisir ces dates"
                    loadingLabel="Validation…"
                    successLabel="Dates choisies"
                    errorLabel="Réessayer"
                    disabled={!manualRange}
                    onAction={() => {
                      if (!manualRange) throw new Error("Dates manquantes");
                      return chooseMutation.mutateAsync({ start: manualRange.startDate, end: manualRange.endDate });
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          ) : null}

          {isAdmin && datesLocked ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => unlockMutation.mutate()} disabled={unlockMutation.isPending}>
              Modifier les dates
            </Button>
          ) : null}
        </section>
      )}

      {datesLocked && isAdmin ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          disabled={unlockMutation.isPending}
          onClick={() => {
            if (window.confirm("Rendre les dates modifiables pour en choisir d’autres ?")) unlockMutation.mutate();
          }}
        >
          Modifier les dates
        </Button>
      ) : null}
    </KrewPageShell>
  );
}
