import { cn } from "@/lib/utils";
import type { TripWeatherKind, TripWeatherSummary } from "@/lib/krew/trip-weather";

function WeatherGlyph({ kind }: { kind: TripWeatherKind }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "clear") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
        <circle {...common} cx="20" cy="20" r="6.5" />
        <path {...common} d="M20 5.5v5M20 29.5v5M5.5 20h5M29.5 20h5M9.7 9.7l3.5 3.5M26.8 26.8l3.5 3.5M30.3 9.7l-3.5 3.5M13.2 26.8l-3.5 3.5" />
      </svg>
    );
  }

  if (kind === "storm") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
        <path {...common} d="M11 25.5h17.5c4 0 6-2.3 6-5.2 0-3.1-2.4-5.2-5.4-5.2-.9-4.3-4.1-7-8.5-7-4.6 0-8.1 3.1-8.7 7.4-3.5.2-6 2.3-6 5.2 0 2.8 2 4.8 5.1 4.8Z" />
        <path {...common} d="m20.5 27-3.2 5h3l-1.4 4 5.3-6h-3.1l1.8-3" />
      </svg>
    );
  }

  if (kind === "snow") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
        <path {...common} d="M10.5 23.5h18c3.8 0 5.8-2.2 5.8-5 0-3-2.3-5-5.2-5-.9-4-3.9-6.5-8.1-6.5-4.4 0-7.8 3-8.4 7-3.4.2-5.8 2.2-5.8 5 0 2.6 1.9 4.5 3.7 4.5Z" />
        <path {...common} d="M13 29v6M10 32h6M25 29v6M22 32h6" />
      </svg>
    );
  }

  if (kind === "cloudy") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
        <path {...common} d="M10.5 24h18c3.8 0 5.8-2.2 5.8-5 0-3-2.3-5-5.2-5-.9-4-3.9-6.5-8.1-6.5-4.4 0-7.8 3-8.4 7-3.4.2-5.8 2.2-5.8 5 0 2.6 1.9 4.5 3.7 4.5Z" />
      </svg>
    );
  }

  if (kind === "rain") {
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
        <path {...common} d="M10.5 23.5h18c3.8 0 5.8-2.2 5.8-5 0-3-2.3-5-5.2-5-.9-4-3.9-6.5-8.1-6.5-4.4 0-7.8 3-8.4 7-3.4.2-5.8 2.2-5.8 5 0 2.6 1.9 4.5 3.7 4.5Z" />
        <path {...common} d="m13 28-2 5M21 28l-2 5M29 28l-2 5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-8 text-primary sm:size-9">
      <path {...common} d="M17 8.5v15.2a7 7 0 1 0 6 0V8.5a3 3 0 0 0-6 0Z" />
      <path {...common} d="M20 14v12" />
      <circle cx="20" cy="30" r="3.2" fill="currentColor" opacity=".75" />
    </svg>
  );
}

function temperatureText(weather: TripWeatherSummary) {
  if (weather.tempMin != null && weather.tempMax != null) return `${weather.tempMin}° · ${weather.tempMax}°`;
  if (weather.tempMax != null) return `~${weather.tempMax}°`;
  if (weather.tempMin != null) return `~${weather.tempMin}°`;
  return null;
}

export function TripWeatherBadge({ weather, className }: { weather: TripWeatherSummary; className?: string }) {
  const temp = temperatureText(weather);
  if (!temp) return null;

  const accessible = `${weather.mode === "forecast" ? "Prévision météo" : "Tendance météo habituelle"} : ${weather.label}, ${temp}${weather.rainRelevant ? ", pluie probable pendant le séjour" : ""}`;

  return (
    <aside
      aria-label={accessible}
      className={cn(
        "relative isolate w-full max-w-[230px] rotate-[1.2deg] rounded-[18px_14px_19px_13px] border border-primary/15 bg-background/95 px-2.5 py-2.5 shadow-[0_8px_22px_rgba(75,40,68,0.10)] backdrop-blur-sm sm:px-3",
        "motion-reduce:transform-none sm:max-w-[250px]",
        className,
      )}
    >
      <span className="absolute -left-1 top-3 h-8 w-2 rotate-[-7deg] rounded-full bg-sage/45" aria-hidden="true" />
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="grid size-9 shrink-0 place-items-center sm:size-10 rounded-[14px_11px_13px_10px] bg-sage/20">
          <WeatherGlyph kind={weather.kind} />
        </div>
        <div className="min-w-0">
          <p className="font-sans text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.11em] text-primary/75">
            {weather.mode === "forecast" ? weather.label : "En général à cette période"}
          </p>
          <p className="font-display text-[21px] sm:text-[23px] leading-none tracking-tight text-foreground">{temp}</p>
          {weather.mode === "forecast" && weather.rainRelevant ? (
            <p className="mt-0.5 font-sans text-[10.5px] font-semibold text-primary">Pluie à prévoir</p>
          ) : null}
        </div>
      </div>
      {weather.mode === "forecast" && weather.microcopy ? (
        <p className="mt-1.5 hidden max-w-[190px] pl-0.5 font-sans text-[10.5px] leading-snug text-foreground/70 sm:block">
          {weather.microcopy}
        </p>
      ) : null}
    </aside>
  );
}
