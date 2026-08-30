import { Link } from "@tanstack/react-router";
import type { TripWeatherSummary } from "@/lib/krew/trip-weather";
import { buildTravelModeModel } from "@/lib/krew/trip-travel-mode";
import { cn } from "@/lib/utils";
import { KrewHighlight, KrewIcon, KrewMark, KrewNote } from "@/components/krew/visual-language";

type Props = {
  tripId: string;
  trip: any;
  destinationName?: string | null;
  weather?: TripWeatherSummary | null;
  canEditPlanning?: boolean;
};

function temperatureLabel(day: NonNullable<TripWeatherSummary["days"]>[number]) {
  if (day.tempMin != null && day.tempMax != null) return `${day.tempMin}–${day.tempMax}°`;
  if (day.tempMax != null) return `${day.tempMax}°`;
  if (day.tempMin != null) return `${day.tempMin}°`;
  return null;
}

export function TripTravelMode({ tripId, trip, destinationName, weather, canEditPlanning = false }: Props) {
  const model = buildTravelModeModel({ trip, destinationName, weather });
  if (!model.active) return null;

  const focus = model.current ?? model.next;
  const weatherTemp = model.todayWeather ? temperatureLabel(model.todayWeather) : null;

  return (
    <section aria-labelledby="travel-mode-today" className="relative -mt-2 overflow-hidden rounded-[28px] border border-sage/30 bg-card/95 px-4 py-5 shadow-sm sm:px-6 sm:py-6">
      <KrewMark type="spark" tone="sage" size="sm" className="pointer-events-none absolute right-4 top-4 size-7 opacity-55" />

      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <KrewNote variant="margin" rotation={-2} className="mb-1 inline-block px-2 py-0.5 text-[11px] uppercase tracking-[.08em] text-primary">
            Jour {model.dayNumber ?? "—"}
          </KrewNote>
          <h2 id="travel-mode-today" className="font-display text-[31px] font-normal leading-none text-foreground sm:text-[36px]">
            Aujourd’hui
          </h2>
          <KrewMark type="underline-wave" tone="sage" size="sm" className="mt-1 h-3 w-20 opacity-80" />
        </div>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage", section: "planning" }}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-primary hover:underline"
        >
          Planning
          <KrewMark type="arrow-right" tone="plum" size="sm" className="h-4 w-5" />
        </Link>
      </div>

      {model.slots.length ? (
        <div className="space-y-1">
          {model.slots.map((slot) => {
            const emphasized = slot.status === "current" || slot.status === "next";
            return (
              <article
                key={slot.key}
                className={cn(
                  "relative grid grid-cols-[58px_minmax(0,1fr)] gap-2 rounded-2xl px-2.5 py-3 transition-opacity sm:grid-cols-[72px_minmax(0,1fr)] sm:px-3",
                  slot.status === "past" && "opacity-45",
                  emphasized && "bg-sage/12 ring-1 ring-sage/25",
                )}
              >
                <div className="pt-0.5 font-mono text-[12px] font-semibold text-primary sm:text-[13px]">
                  {slot.time ?? slot.moment ?? "—"}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="min-w-0 break-words font-sans text-[15px] font-semibold leading-snug text-foreground sm:text-base">
                      {slot.label}
                    </h3>
                    {slot.status === "current" ? (
                      <KrewHighlight tone="sage" className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.08em]">
                        En cours
                      </KrewHighlight>
                    ) : slot.status === "next" ? (
                      <KrewHighlight tone="sage" className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.08em]">
                        Ensuite
                      </KrewHighlight>
                    ) : null}
                  </div>
                  {slot.address ? <p className="mt-1 break-words text-[12px] leading-snug text-muted-foreground sm:text-[13px]">{slot.address}</p> : null}
                  {(slot.distanceLabel || slot.mapsUrl) && emphasized ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      {slot.distanceLabel ? <span className="text-[11px] font-medium text-muted-foreground">{slot.distanceLabel}</span> : null}
                      {slot.mapsUrl ? (
                        <a
                          href={slot.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                        >
                          <KrewIcon name="destination" tone="muted" size="sm" className="size-3.5 brightness-0 invert" />
                          Ouvrir dans Maps
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-sage/35 bg-sage/8 px-4 py-4">
          <p className="font-sans text-sm font-medium text-foreground">Rien de prévu aujourd’hui.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Le reste du voyage reste accessible dans le planning.</p>
        </div>
      )}

      {(focus || model.todayWeather || model.lodging) ? <div className="my-4 border-t border-dashed border-sage/30" /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {model.todayWeather ? (
          <div className="rounded-2xl bg-background/80 px-3.5 py-3 ring-1 ring-border/60">
            <div className="flex items-center gap-2">
              <KrewIcon name="calendar" tone="sage" size="sm" className="size-4" />
              <p className="text-[11px] font-bold uppercase tracking-[.1em] text-primary/75">Météo du jour</p>
            </div>
            <p className="mt-1.5 font-sans text-sm font-semibold text-foreground">
              {model.todayWeather.label}{weatherTemp ? ` · ${weatherTemp}` : ""}
            </p>
            {model.todayWeather.precipitationMm > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">{Math.round(model.todayWeather.precipitationMm * 10) / 10} mm de pluie prévus</p>
            ) : null}
            {model.weatherImpact ? <p className="mt-2 text-xs font-medium leading-relaxed text-primary">{model.weatherImpact}</p> : null}
          </div>
        ) : null}

        {model.lodging ? (
          <div className="rounded-2xl bg-background/80 px-3.5 py-3 ring-1 ring-border/60">
            <div className="flex items-center gap-2">
              <KrewIcon name="accommodation" tone="plum" size="sm" className="size-4" />
              <p className="text-[11px] font-bold uppercase tracking-[.1em] text-primary/75">Votre point de chute</p>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{model.lodging.name}</p>
            {model.lodging.address ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{model.lodging.address}</p> : null}
            {model.lodging.mapsUrl ? (
              <a href={model.lodging.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                Ouvrir dans Maps
                <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {model.planB ? (
        <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/[.045] px-3.5 py-3.5">
          <div className="flex items-center gap-2">
            <KrewMark type="spark" tone="plum" size="sm" className="size-4" />
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-primary">Plan B KREW</p>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-foreground">{model.planB.label}</p>
          {model.planB.detail ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.planB.detail}</p> : null}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.planB.reason}</p>
          {canEditPlanning ? (
            <Link
              to="/trips/$tripId"
              params={{ tripId }}
              search={{ view: "voyage", section: "planning" }}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Voir l’alternative dans le planning
              <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
