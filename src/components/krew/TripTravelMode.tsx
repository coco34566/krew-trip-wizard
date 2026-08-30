import { Link } from "@tanstack/react-router";
import type { TripWeatherSummary } from "@/lib/krew/trip-weather";
import { buildTravelModeModel } from "@/lib/krew/trip-travel-mode";
import { cn } from "@/lib/utils";
import { KrewIcon, KrewMark, KrewNote } from "@/components/krew/visual-language";

type Props = {
  tripId: string;
  trip: any;
  destinationName?: string | null;
  weather?: TripWeatherSummary | null;
};

function temperatureLabel(day: NonNullable<TripWeatherSummary["days"]>[number]) {
  if (day.tempMin != null && day.tempMax != null) return `${day.tempMin}–${day.tempMax}°`;
  if (day.tempMax != null) return `${day.tempMax}°`;
  if (day.tempMin != null) return `${day.tempMin}°`;
  return null;
}

export function TripTravelMode({ tripId, trip, destinationName, weather }: Props) {
  const model = buildTravelModeModel({ trip, destinationName, weather });
  if (!model.active) return null;

  const weatherTemp = model.todayWeather ? temperatureLabel(model.todayWeather) : null;

  return (
    <section
      aria-labelledby="travel-mode-today"
      className="relative -mx-4 bg-sage/[.08] px-4 py-6 sm:mx-0 sm:px-6 sm:py-7"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <KrewNote variant="margin" rotation={-2} className="mb-1.5 inline-block px-3 py-1.5 text-[14px] text-primary">
            Jour {model.dayNumber ?? "—"}
          </KrewNote>
          <div className="relative inline-block">
            <h2 id="travel-mode-today" className="font-display text-[30px] font-normal leading-none text-foreground sm:text-[34px]">
              Aujourd’hui
            </h2>
            <KrewMark type="underline-wave" tone="sage" size="sm" className="absolute -bottom-3 left-0 h-3 w-24 opacity-75" />
          </div>
        </div>
        <Link
          to="/trips/$tripId"
          params={{ tripId }}
          search={{ view: "voyage", section: "planning" }}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-[14px] font-semibold text-primary hover:underline"
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
                  "grid grid-cols-[62px_minmax(0,1fr)] gap-2 px-1 py-3.5 sm:grid-cols-[76px_minmax(0,1fr)] sm:px-2",
                  slot.status === "past" && "opacity-45",
                  emphasized && "rounded-2xl bg-background/75 px-3 ring-1 ring-sage/25",
                )}
              >
                <div className="pt-0.5 font-mono text-[13px] font-semibold text-primary sm:text-[14px]">
                  {slot.time ?? slot.moment ?? "—"}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="min-w-0 break-words font-sans text-[15px] font-semibold leading-snug text-foreground sm:text-base">
                      {slot.label}
                    </h3>
                    {slot.status === "current" ? (
                      <span className="text-[12px] font-semibold text-primary">En cours</span>
                    ) : slot.status === "next" ? (
                      <span className="text-[12px] font-semibold text-primary">Ensuite</span>
                    ) : null}
                  </div>
                  {slot.address ? <p className="mt-1 break-words text-[13px] leading-snug text-muted-foreground">{slot.address}</p> : null}
                  {(slot.distanceLabel || slot.mapsUrl) && emphasized ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                      {slot.distanceLabel ? <span className="text-[12px] font-medium text-muted-foreground">{slot.distanceLabel}</span> : null}
                      {slot.mapsUrl ? (
                        <a
                          href={slot.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[14px] font-semibold text-primary-foreground"
                        >
                          <KrewIcon name="map" tone="muted" size="sm" className="size-4 brightness-0 invert" />
                          Maps
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
        <div className="border-l-2 border-sage/45 py-2 pl-4">
          <p className="font-sans text-[15px] font-medium text-foreground">Rien de prévu aujourd’hui.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Le reste du voyage reste accessible dans le planning.</p>
        </div>
      )}

      {(model.todayWeather || model.lodging) ? <div className="my-5 border-t border-dashed border-sage/35" /> : null}

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-7">
        {model.todayWeather ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <KrewIcon name="attention" tone={model.weatherImpact ? "plum" : "sage"} size="sm" className="size-4" />
              <p className="text-[12px] font-bold uppercase tracking-[.08em] text-primary/75">Météo du jour</p>
            </div>
            <p className="mt-1.5 font-sans text-[15px] font-semibold text-foreground">
              {model.todayWeather.label}{weatherTemp ? ` · ${weatherTemp}` : ""}
            </p>
            {model.todayWeather.precipitationMm > 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">{Math.round(model.todayWeather.precipitationMm * 10) / 10} mm de pluie prévus sur la journée</p>
            ) : null}
            {model.weatherImpact ? <p className="mt-2 text-[13px] font-medium leading-relaxed text-primary">{model.weatherImpact}</p> : null}
          </div>
        ) : null}

        {model.lodging ? (
          <div className="min-w-0 sm:border-l sm:border-sage/25 sm:pl-6">
            <div className="flex items-center gap-2">
              <KrewIcon name="accommodation" tone="plum" size="sm" className="size-4" />
              <p className="text-[12px] font-bold uppercase tracking-[.08em] text-primary/75">Point de chute</p>
            </div>
            <p className="mt-1.5 text-[15px] font-semibold text-foreground">{model.lodging.name}</p>
            {model.lodging.address ? <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{model.lodging.address}</p> : null}
            {model.lodging.mapsUrl ? (
              <a href={model.lodging.mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
                Ouvrir dans Maps
                <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {model.planB ? (
        <div className="mt-5 border-t border-primary/15 pt-4">
          <div className="flex items-center gap-2">
            <KrewIcon name="attention" tone="plum" size="sm" className="size-4" />
            <p className="text-[12px] font-bold uppercase tracking-[.08em] text-primary">Plan B KREW</p>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold text-foreground">{model.planB.label}</p>
          {model.planB.detail ? <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{model.planB.detail}</p> : null}
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{model.planB.reason}</p>
          <Link
            to="/trips/$tripId"
            params={{ tripId }}
            search={{ view: "voyage", section: "planning" }}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline"
          >
            Changer cette activité dans le planning
            <KrewMark type="arrow-right" tone="plum" size="sm" className="h-3.5 w-5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
