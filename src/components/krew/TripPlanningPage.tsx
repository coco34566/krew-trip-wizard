import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Utensils,
  Wine,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";
import { KrewThinkingState } from "@/components/krew/KrewThinkingState";
import { KrewIcon, KrewNote } from "@/components/krew/visual-language";
import { computeItineraryActivitiesCost } from "@/lib/krew/cost-split";
import { formatEuro } from "@/lib/krew/constants";
import { getTripLifecycleState } from "@/lib/krew/trip-lifecycle";
import {
  generateGroupItinerary,
  getTripDetail,
  regenerateItinerarySlot,
} from "@/lib/trips.functions";

export function planningTypeLabel(type: string | null | undefined) {
  const normalized = String(type ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    activite: "Activité",
    activité: "Activité",
    resto: "Restaurant",
    restaurant: "Restaurant",
    libre: "Temps libre",
    temps_libre: "Temps libre",
    bar: "Bar",
    transport: "Transport",
    hotel: "Hébergement",
    hébergement: "Hébergement",
  };
  return labels[normalized] ?? (type ? String(type).replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase()) : "");
}

export function TripPlanningPage({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getTripDetail);
  const generatePlanning = useServerFn(generateGroupItinerary);
  const regenerateSlot = useServerFn(regenerateItinerarySlot);

  const detailQuery = useQuery({
    queryKey: ["trip", tripId],
    queryFn: () => fetchDetail({ data: { tripId } }),
  });

  const planningMutation = useMutation({
    mutationFn: () => generatePlanning({ data: { tripId, force: true } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (error) => {
      console.error("Impossible de préparer le planning:", error);
      toast.error("Impossible de préparer le planning pour le moment.");
    },
  });

  const slotMutation = useMutation({
    mutationFn: ({ day, slotIndex }: { day: number; slotIndex: number }) =>
      regenerateSlot({ data: { tripId, day, slotIndex } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: (error) => {
      console.error("Impossible de proposer une autre option:", error);
      toast.error("Impossible de proposer une autre option pour le moment.");
    },
  });

  if (detailQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <KrewThinkingState context="planning" />
      </main>
    );
  }

  if (!detailQuery.data || detailQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage" }}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" /> Retour au voyage
        </Link>
        <section className="rounded-3xl border border-border/60 bg-card p-6 text-center sm:p-8" role="alert">
          <h1 className="font-display text-[28px] font-normal text-foreground sm:text-[32px]">
            Impossible de charger le planning
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Le planning n’est pas disponible pour le moment.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => void detailQuery.refetch()}
            disabled={detailQuery.isFetching}
            aria-busy={detailQuery.isFetching}
          >
            {detailQuery.isFetching ? "Chargement…" : "Réessayer"}
          </Button>
        </section>
      </main>
    );
  }

  const data = detailQuery.data as any;
  const trip = data.trip as any;
  const isAdmin = Boolean(data.isOwner);
  const completedTrip =
    getTripLifecycleState({
      datesLocked: Boolean(trip.dates_locked ?? trip.datesLocked),
      startDate: trip.start_date ?? null,
      endDate: trip.end_date ?? null,
    }) === "completed";
  const days = (trip.group_itinerary?.days ?? []) as any[];
  const activityCost = computeItineraryActivitiesCost(days);
  const priceStatusLabel =
    activityCost.priceStatus === "verified"
      ? "prix vérifiés"
      : activityCost.priceStatus === "free"
        ? "gratuit"
        : activityCost.priceStatus === "partial"
          ? "estimation partielle"
          : "estimation";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/trips/$tripId"
        params={{ tripId }}
        search={{ view: "voyage" }}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Retour au parcours
      </Link>

      <header className="relative border-b border-border/45 pb-5 pr-20 sm:pr-24">
        <img
          src="/brand/otter-states/planning.png"
          alt=""
          className="pointer-events-none absolute right-0 top-0 w-[72px] object-contain opacity-90 sm:w-[88px]"
        />
        <div className="flex items-center gap-3">
          <h1 className="flex items-center gap-2 font-display text-[30px] font-normal text-foreground sm:text-[36px]">
            <KrewIcon name="planning" tone="plum" size="sm" className="size-5" />
            Planning
          </h1>
          <KrewNote variant="tape" tone="sage" rotation={-2} size="xs" className="hidden sm:inline-block">
            {completedTrip ? "Voyage terminé · consultation" : "Jour par jour"}
          </KrewNote>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {completedTrip
            ? "Le planning réalisé pendant le séjour, conservé pour consultation."
            : "Le planning du séjour, de l’arrivée au départ."}
        </p>
        {activityCost.activitiesPerPerson != null ? (
          <p className="mt-3 inline-flex flex-wrap items-baseline gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm">
            <span className="font-semibold text-foreground">
              Activités : ~{Math.round(activityCost.activitiesPerPerson)} € / personne
            </span>
            <span className="text-xs text-muted-foreground">{priceStatusLabel}</span>
          </p>
        ) : null}
      </header>

      {isAdmin && !completedTrip ? (
        <div className="flex justify-end">
          <KrewStatefulButton
            className="w-full sm:w-auto"
            idleLabel={days.length ? "Revoir le planning" : "Préparer le planning"}
            loadingLabel={days.length ? "Mise à jour…" : "Préparation…"}
            successLabel={days.length ? "Planning actualisé" : "Planning prêt"}
            errorLabel="Réessayer"
            resetAfterMs={1400}
            onAction={() => planningMutation.mutateAsync()}
          />
        </div>
      ) : null}

      {planningMutation.isPending ? (
        <KrewThinkingState context="planning" />
      ) : days.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {completedTrip
            ? "Aucun planning n’a été conservé pour ce voyage."
            : isAdmin
              ? "Prépare le planning du séjour, de l’arrivée au départ."
              : "Le planning du séjour sera bientôt disponible."}
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day) => (
            <article key={day.day} className="space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  Jour {day.day}
                  {day.date
                    ? ` · ${new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}`
                    : ""}
                </h2>
              </div>

              <div className="relative divide-y divide-border/40 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-border/60 sm:pl-8 sm:before:left-3">
                {(day.slots ?? []).map((slot: any, slotIndex: number) => {
                  const Icon =
                    slot.type === "resto"
                      ? Utensils
                      : slot.type === "bar"
                        ? Wine
                        : slot.type === "activite"
                          ? Camera
                          : CalendarDays;
                  const directPrice = Number(slot.pricePerPerson ?? slot.priceHint);
                  const hasDirectPrice = Number.isFinite(directPrice) && directPrice >= 0;
                  const typeLabel = planningTypeLabel(slot.type);

                  return (
                    <div
                      key={`${day.day}-${slotIndex}`}
                      className="relative flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <span className="absolute -left-6 top-4 size-2.5 rounded-full border border-primary bg-background ring-4 ring-card sm:-left-8" />
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {slot.time ? <span className="font-mono font-semibold text-primary">{slot.time}</span> : null}
                            {slot.moment ? <span>{slot.moment}</span> : null}
                            {typeLabel ? <span>· {typeLabel}</span> : null}
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">{slot.label}</p>
                          {slot.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{slot.detail}</p> : null}

                          {slot.priceStatus === "free" ? (
                            <p className="mt-1 text-xs text-muted-foreground">Gratuit</p>
                          ) : hasDirectPrice && (slot.priceStatus === "verified" || slot.priceStatus === "estimated") ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {slot.priceStatus === "estimated" ? "~" : ""}{formatEuro(directPrice)} / pers.
                              {slot.priceStatus === "estimated" ? " (estimé)" : ""}
                            </p>
                          ) : Number.isFinite(Number(slot.estimatedPriceMinPerPerson)) &&
                            Number.isFinite(Number(slot.estimatedPriceMaxPerPerson)) ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Env. {slot.estimatedPriceMinPerPerson}–{slot.estimatedPriceMaxPerPerson}{slot.estimatedPriceCurrency === "EUR" ? " €" : ` ${slot.estimatedPriceCurrency || ""}`} / pers.
                            </p>
                          ) : null}

                          {slot.booking?.provider === "getyourguide" && slot.booking?.url ? (
                            <a
                              href={slot.booking.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
                            >
                              {slot.booking.type === "exact_product"
                                ? "Voir les disponibilités sur GetYourGuide →"
                                : "Voir les activités sur GetYourGuide →"}
                            </a>
                          ) : slot.url && slot.type !== "transport" && slot.type !== "hotel" ? (
                            <a
                              href={slot.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
                            >
                              {slot.resourceKind === "booking"
                                ? "Voir / réserver →"
                                : slot.resourceKind === "ideas"
                                  ? "Voir les idées →"
                                  : "Voir le lieu →"}
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {isAdmin && !completedTrip ? (
                        <KrewStatefulButton
                          size="sm"
                          variant="outline"
                          className="w-full shrink-0 sm:w-auto"
                          idleLabel="Autre option"
                          loadingLabel="Recherche…"
                          successLabel="Option actualisée"
                          errorLabel="Réessayer"
                          onAction={() => slotMutation.mutateAsync({ day: day.day, slotIndex })}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}

          <section className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <KrewIcon name="tasks" tone="plum" size="sm" className="size-4" />
                {completedTrip ? "Tâches du voyage" : isAdmin ? "Répartir les tâches" : "Voir les tâches"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {completedTrip
                  ? "Retrouve les tâches conservées pour mémoire."
                  : isAdmin
                    ? "Attribue les tâches utiles aux membres du groupe."
                    : "Retrouve les tâches du groupe et mets à jour celles qui te sont attribuées."}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full shrink-0 sm:w-auto">
              <Link
                to="/trips/$tripId"
                params={{ tripId }}
                search={{ view: "voyage", section: "tasks" }}
              >
                <KrewIcon name="tasks" size="sm" className="size-3.5" />
                {completedTrip ? "Voir les tâches" : isAdmin ? "Répartir les tâches" : "Voir les tâches"}
              </Link>
            </Button>
          </section>
        </div>
      )}
    </main>
  );
}
