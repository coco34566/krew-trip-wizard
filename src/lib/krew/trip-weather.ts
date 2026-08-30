import type { ClimateSummary } from "@/integrations/external/geo-weather.server";

export type TripWeatherKind = "clear" | "cloudy" | "rain" | "storm" | "snow" | "unknown";

export type TripWeatherSummary = {
  mode: "forecast" | "seasonal";
  kind: TripWeatherKind;
  label: string;
  tempMin: number | null;
  tempMax: number | null;
  rainRelevant: boolean;
  rainyDays: number;
  microcopy: string | null;
};

const WEATHER_LABELS: Record<TripWeatherKind, string> = {
  clear: "Ciel dégagé",
  cloudy: "Nuageux",
  rain: "Pluie",
  storm: "Orage",
  snow: "Neige",
  unknown: "Météo",
};

const SEVERITY: Record<TripWeatherKind, number> = {
  unknown: 0,
  clear: 1,
  cloudy: 2,
  rain: 3,
  snow: 4,
  storm: 5,
};

export function weatherKindFromCode(code: number | null | undefined): TripWeatherKind {
  if (code == null || !Number.isFinite(code)) return "unknown";
  if (code === 0) return "clear";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "unknown";
}

function dominantKind(kinds: TripWeatherKind[]) {
  const counts = new Map<TripWeatherKind, number>();
  for (const kind of kinds.filter((kind) => kind !== "unknown")) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  if (!counts.size) return "unknown" as const;

  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return SEVERITY[b[0]] - SEVERITY[a[0]];
  })[0][0];
}

function forecastMicrocopy(kind: TripWeatherKind, tempMax: number | null) {
  if (kind === "storm" || kind === "rain") return "On garde un plan B sous le coude.";
  if (kind === "snow") return "Le pull gagne sa place dans le sac.";
  if (tempMax != null && tempMax >= 30) return "Ça va chauffer.";
  if (tempMax != null && tempMax <= 10) return "Le pull gagne sa place dans le sac.";
  if (kind === "clear") return "Les lunettes peuvent sortir.";
  return null;
}

export function buildTripWeatherSummary(
  climate: ClimateSummary,
  startDate: string,
  endDate?: string | null,
  allowForecast = true,
): TripWeatherSummary | null {
  const forecast = allowForecast ? climate.forecast ?? [] : [];
  if (forecast.length) {
    const validTempsMin = forecast.map((day) => day.tempMin).filter(Number.isFinite);
    const validTempsMax = forecast.map((day) => day.tempMax).filter(Number.isFinite);
    const kinds = forecast.map((day) => weatherKindFromCode(day.weatherCode));
    const rainyDays = forecast.filter((day) => day.precipitationMm >= 1).length;
    const totalRain = forecast.reduce((sum, day) => sum + Math.max(0, day.precipitationMm || 0), 0);
    const rainRelevant = rainyDays >= 2 || rainyDays / forecast.length >= 0.4 || totalRain >= 5;
    const kind = dominantKind(kinds);
    const tempMin = validTempsMin.length ? Math.round(Math.min(...validTempsMin)) : null;
    const tempMax = validTempsMax.length ? Math.round(Math.max(...validTempsMax)) : null;

    return {
      mode: "forecast",
      kind,
      label: WEATHER_LABELS[kind],
      tempMin,
      tempMax,
      rainRelevant,
      rainyDays,
      microcopy: forecastMicrocopy(kind, tempMax),
    };
  }

  const startMonth = Number(startDate.slice(5, 7));
  const endMonth = Number((endDate || startDate).slice(5, 7));
  if (!startMonth || !endMonth) return null;

  const months = climate.months.filter((month) => {
    if (startMonth <= endMonth) return month.month >= startMonth && month.month <= endMonth;
    return month.month >= startMonth || month.month <= endMonth;
  });
  if (!months.length) return null;

  const mins = months.map((month) => month.tempMinAvg).filter((value): value is number => value != null && Number.isFinite(value));
  const maxs = months.map((month) => month.tempMaxAvg).filter(Number.isFinite);
  if (!mins.length && !maxs.length) return null;

  return {
    mode: "seasonal",
    kind: "unknown",
    label: "Tendance habituelle",
    tempMin: mins.length ? Math.round(Math.min(...mins)) : null,
    tempMax: maxs.length ? Math.round(Math.max(...maxs)) : null,
    rainRelevant: false,
    rainyDays: 0,
    microcopy: null,
  };
}
