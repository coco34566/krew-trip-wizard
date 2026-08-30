import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { KrewIcon, KrewMark } from "@/components/krew/visual-language";
import { regenerateItinerarySlot } from "@/lib/trips.functions";
import {
  buildPlanningMapModel,
  buildPlanningMapsUrl,
  formatMapSegmentDistance,
} from "@/lib/krew/planning-map";
import type { TripWeatherSummary } from "@/lib/krew/trip-weather";
import {
  classifyLiveSlots,
  isActivityLikeSlot,
  isPlanBCandidate,
  isTripLiveMode,
  localCalendarDateKey,
  tripDayNumber,
  type LiveSlotState,
} from "@/lib/krew/trip-live-mode";

export { isTripLiveMode } from "@/lib/krew/trip-live-mode";

type Props = {
  tripId: string;
  trip: any;
  destinationName?: string | null;
  weather?: TripWeatherSummary | null;
  isOwner: boolean;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function selectedLodging(logistics: any) {
  if (!logistics?.selectedHotelId || !Array.isArray(logistics.hotels)) return null;
  return logistics.hotels.find((hotel: any) => hotel?.id === logistics.selectedHotelId) ?? null;
}

function weatherLabel(kind: string) {
  if (kind === "clear") return "Ciel dégagé";
  if (kind === "cloudy") return "Nuageux";
  if (kind === "rain") return "Pluie";
  if (kind === "storm") return "Orage";
  if (kind === "snow") return "Neige";
  return "Météo du jour";
}

function eventTone(status: LiveSlotState["status"], featured: boolean) {
  if (featured) return "border-sage/45 bg-sage/12 shadow-sm";
  if (status === "past") return "border-border/50 bg-muted/20 opacity-55";
  return "border-border/60 bg-card/75";
}

export function TripLiveModePanel({ tripId, trip, destinationName = null, weather = null, isOwner }: Props) {
  const now = new Date();
  const datesLocked = Boolean(trip?.dates_locked || trip?.datesLocked);
  const live = isTripLiveMode({
    datesLocked,
    startDate: trip?.start_date,
    endDate: trip?.end_date,
    now,
  });
  if (!live) return null;

  const dayNumber = tripDayNumber(trip?.start_date, now);
  const days = Array.isArray(trip?.group_itinerary?.days) ? trip.group_itinerary.days : [];
  const todayDay = days.find((day: any) => Number(day?.day) === dayNumber) ?? null;
  const slots = Array.isArray(todayDay?.slots) ? todayDay.slots : [];
  const states = classifyLiveSlots(slots, now);
  const currentActivity = states.find(
    (state) => state.status === "current" && isActivityLikeSlot(state.slot),
  );
  const nextActivity = states.find(
    (state) => state.status === "upcoming" && isActivityLikeSlot(state.slot),
  );
  const featured = currentActivity ?? nextActivity ?? null;

  const logistics = trip?.group_logistics ?? {};
  const lodging = selectedLodging(logistics);
  const mapModel = buildPlanningMapModel({
    days,
    destination: destinationName,
    selectedLodging: lodging,
  });
  const todayKey = localCalendarDateKey(now);
  const weatherToday = weather?.days?.find((day) => day.date === todayKey) ?? null;
  const planBState = states.find((state) => isPlanBCandidate(state, weatherToday, now)) ?? null;

  const queryClient = useQueryClient();
  const regenerateSlot = useServerFn(regenerateItinerarySlot);
  const planBMutation = useMutation({
    mutationFn: (state: LiveSlotState) =>
      regenerateSlot({ data: { tripId, day: dayNumber!, slotIndex: state.slotIndex } }),
    onSuccess: () => {
      toast.success("Une autre option a été intégrée au planning");
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
    },
    onError: () => toast.error("Impossible de proposer une autre option pour le moment."),
  });

  const lodgingAddress =
    text(lodging?.address) || text(lodging?.location?.address) || null;
  const lodgingMapsUrl = lodging
    ? buildPlanningMapsUrl({
        existingUrl: lodging.mapsUrl,
        name: lodging.name,
        address: lodgingAddress,
        destination: destinationName,
        latitude: lodging.latitude ?? lodging.location?.latitude,
        longitude: lodging.longitude ?? lodging.location?.longitude,
      })
    : null;

  const featuredMapsUrl = featured
    ? buildPlanningMapsUrl({
        existingUrl: featured.slot.url,
        name: featured.slot.label,
        address: featured.slot.address,
        destination: destinationName,
        latitude: featured.slot.latitude,
        longitude: featured.slot.longitude,
      })
    : null;
  const featuredMapPoint = featured
    ? mapModel.activityPoints.find((point) => point.id === `activity-${dayNumber}-${featured.slotIndex}`)
    : null;

  return (
    <section className="relative -mx-1 overflow-hidden rounded-[28px] border border-sage/30 bg-background px-4 py-5 shadow-sm sm:mx-0 sm:px-6 sm:py-6">
      <KrewMark type="underline-wave" tone="sage" size="sm" className="absolute right-5 top-4 h-4 w-20 opacity-45" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">Vie du voyage</p>
            <h2 className="mt-1 font-display text-[31px] font-normal leading-none text-foreground sm:text-[36px]">Aujourd’hui</h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {dayNumber ? `Jour ${dayNumber}` : "Le programme du jour"}
              {todayDay?.title ? ` · ${todayDay.title}` : ""}
            </p>
          </div>
          <KrewIcon name="planning" tone="sage" size="md" className="mt-1 size-7 shrink-0" />
        </div>

        {states.length ? (
          <div className="mt-5 space-y-2.5">
            {states.map((state) => {
              const isFeatured = featured?.slotIndex === state.slotIndex;
              const mapsUrl = buildPlanningMapsUrl({
                existingUrl: state.slot.url,
                name: state.slot.label,
                address: state.slot.address,
                destination: destinationName,
                latitude: state.slot.latitude,
                longitude: state.slot.longitude,
              });
              return (
                <div
                  key={`${state.slotIndex}-${String(state.slot.label ?? "event")}`}
                  className={`flex min-w-0 items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${eventTone(state.status, isFeatured)}`}
                >
                  <div className="w-[46px] shrink-0 pt-0.5 font-mono text-[12px] font-bold text-primary">
                    {text(state.slot.time) || "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 break-words text-sm font-semibold text-foreground">
                        {text(state.slot.label) || "Étape du jour"}
                      </p>
                      {state.status === "current" ? (
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">En cours</span>
                      ) : isFeatured ? (
                        <span className="rounded-full border border-sage/35 bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">À suivre</span>
                      ) : null}
                    </div>
                    {text(state.slot.address) ? (
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">{String(state.slot.address)}</p>
                    ) : null}
                    {mapsUrl ? (
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <KrewIcon name="destination" tone="plum" size="sm" className="size-3.5" />
                        Ouvrir dans Maps
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-sage/35 bg-sage/8 px-4 py-5">
            <p className="text-sm font-semibold text-foreground">Rien de prévu pour l’instant aujourd’hui.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Le reste du voyage reste accessible dans le planning.</p>
          </div>
        )}

        {featured ? (
          <div className="mt-4 border-t border-sage/25 pt-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary/70">
              {featured.status === "current" ? "Maintenant" : "Prochaine activité"}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-base font-semibold text-foreground">{text(featured.slot.label) || "Activité"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[text(featured.slot.time), text(featured.slot.address)].filter(Boolean).join(" · ")}
                </p>
                {featuredMapPoint?.distanceFromPreviousKm != null ? (
                  <p className="mt-1 text-xs font-medium text-foreground/75">
                    Depuis l’étape précédente · {formatMapSegmentDistance(featuredMapPoint.distanceFromPreviousKm)}
                  </p>
                ) : null}
              </div>
              {featuredMapsUrl ? (
                <a href={featuredMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  <KrewIcon name="destination" tone="cream" size="sm" className="size-4" />
                  Maps
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {weatherToday ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-primary/70">Météo utile aujourd’hui</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {weatherLabel(weatherToday.kind)}
                {weatherToday.tempMin != null && weatherToday.tempMax != null
                  ? ` · ${weatherToday.tempMin}–${weatherToday.tempMax}°C`
                  : weatherToday.tempMax != null
                    ? ` · ${weatherToday.tempMax}°C`
                    : ""}
              </p>
            </div>
            {weatherToday.precipitationMm > 0 ? (
              <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">{Math.round(weatherToday.precipitationMm)} mm</span>
            ) : null}
          </div>
        ) : null}

        {planBState ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4">
            <div className="flex items-start gap-3">
              <KrewIcon name="planning" tone="plum" size="sm" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-normal text-foreground">Plan B KREW</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                  La météo peut vraiment gêner {text(planBState.slot.label) || "cette activité extérieure"}. Aucun changement n’est fait automatiquement.
                </p>
                {isOwner ? (
                  <button
                    type="button"
                    disabled={planBMutation.isPending}
                    onClick={() => planBMutation.mutate(planBState)}
                    className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-primary/25 bg-background px-4 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    {planBMutation.isPending ? "Recherche d’une autre option…" : "Intégrer une autre option"}
                  </button>
                ) : (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">L’organisateur·rice peut proposer une autre option pour ce créneau.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {lodging ? (
          <div className="mt-4 flex min-w-0 items-center gap-3 border-t border-border/50 pt-4">
            <KrewIcon name="accommodation" tone="sage" size="sm" className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{text(lodging.name) || "Hébergement"}</p>
              {lodgingAddress ? <p className="truncate text-xs text-muted-foreground">{lodgingAddress}</p> : null}
            </div>
            {lodgingMapsUrl ? (
              <a href={lodgingMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center px-2 text-xs font-semibold text-primary hover:underline">Maps</a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            search={{ view: "voyage", section: "planning" }}
            className="inline-flex min-h-10 items-center gap-1.5 px-1 text-sm font-semibold text-primary hover:underline"
          >
            Voir tout le planning
            <KrewMark type="arrow-right" tone="sage" size="sm" className="h-4 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
