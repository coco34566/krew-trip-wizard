import type { KrewTripWeather, KrewWeatherState } from "@/lib/krew/weather";
import { weatherStateLabel } from "@/lib/krew/weather";

function WeatherGlyph({ state, seasonal }: { state: KrewWeatherState | null; seasonal: boolean }) {
  const common = "fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round]";
  if (seasonal || !state) {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
        <path className={common} strokeWidth="2.2" d="M9 30c5-9 11-14 18-14 5 0 9 2 12 6M13 35c5-5 10-7 16-7 4 0 7 .8 10 2.5" />
        <path className={common} strokeWidth="1.7" d="M11 13c3-2 6-3 9-3M36 11l2-3M40 17l4-1" />
      </svg>
    );
  }
  if (state === "clear") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
        <circle className={common} strokeWidth="2.2" cx="24" cy="24" r="8" />
        <path className={common} strokeWidth="2" d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.3 4.3M33.2 33.2l4.3 4.3M37.5 10.5l-4.3 4.3M14.8 33.2l-4.3 4.3" />
      </svg>
    );
  }
  if (state === "cloudy") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
        <path className={common} strokeWidth="2.2" d="M10 32c-4-1-5-7-2-10 2-2 5-2 7-1 1-6 5-10 11-10 7 0 11 5 11 11 4 0 7 3 7 7 0 4-3 7-8 7H14c-2 0-3-.4-4-1" />
      </svg>
    );
  }
  if (state === "rain") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
        <path className={common} strokeWidth="2.2" d="M9 27c-3-1-4-5-2-8 2-2 5-2 7-1 1-6 5-9 11-9 6 0 10 4 11 10 4 0 7 3 7 7s-3 7-8 7H13" />
        <path className={common} strokeWidth="2" d="M16 37l-2 5M25 37l-2 5M34 37l-2 5" />
      </svg>
    );
  }
  if (state === "storm") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
        <path className={common} strokeWidth="2.2" d="M9 26c-3-1-4-5-2-8 2-2 5-2 7-1 1-5 5-8 10-8 6 0 10 4 11 9 5 0 8 3 8 7s-3 7-8 7H13" />
        <path className={common} strokeWidth="2.3" d="M27 31l-6 9h6l-3 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-10 text-primary">
      <path className={common} strokeWidth="2" d="M24 7v34M10 15l28 18M38 15L10 33M17 10l7 5 7-5M17 38l7-5 7 5M9 24l6-7M9 24l6 7M39 24l-6-7M39 24l-6 7" />
    </svg>
  );
}

function microcopy(weather: KrewTripWeather) {
  if (weather.mode === "seasonal") return null;
  if (weather.rainRelevant) return "On garde un plan B sous le coude.";
  switch (weather.state) {
    case "clear":
      return weather.maxTemp != null && weather.maxTemp >= 28 ? "Ça va chauffer." : "Les lunettes peuvent sortir.";
    case "snow":
      return "Le pull gagne sa place dans le sac.";
    case "storm":
      return "On garde un œil sur le ciel.";
    default:
      return null;
  }
}

export function KrewWeatherStamp({ weather }: { weather: KrewTripWeather }) {
  const seasonal = weather.mode === "seasonal";
  const accessibleState = seasonal ? weather.label : weatherStateLabel(weather.state);
  const copy = microcopy(weather);
  const temperatures =
    weather.minTemp != null && weather.maxTemp != null
      ? `${weather.minTemp}° · ${weather.maxTemp}°`
      : weather.maxTemp != null
        ? `~${weather.maxTemp}°`
        : null;

  if (!temperatures) return null;

  return (
    <aside
      aria-label={`${accessibleState}, ${temperatures}`}
      className="relative inline-flex max-w-[220px] -rotate-[1.5deg] items-center gap-2.5 rounded-[18px_15px_20px_13px] border border-primary/20 bg-background/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(42,28,38,0.08)] sm:max-w-[250px] sm:px-3.5"
    >
      <span className="absolute -right-1.5 -top-1.5 size-3 rotate-12 rounded-sm bg-sage/55" aria-hidden="true" />
      <WeatherGlyph state={weather.state} seasonal={seasonal} />
      <span className="min-w-0 font-sans">
        <span className="block text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-primary/75">
          {weather.label}
        </span>
        <span className="mt-0.5 block font-display text-[24px] leading-none tracking-tight text-foreground">
          {temperatures}
        </span>
        {!seasonal && (weather.rainRelevant || copy) ? (
          <span className="mt-1 block text-[10.5px] leading-tight text-foreground/70">
            {weather.rainRelevant ? "Pluie à prévoir" : copy}
          </span>
        ) : null}
      </span>
    </aside>
  );
}
