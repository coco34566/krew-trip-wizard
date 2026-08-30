export type KrewWeatherState = "clear" | "cloudy" | "rain" | "storm" | "snow";

export type KrewTripWeather = {
  mode: "forecast" | "seasonal";
  state: KrewWeatherState | null;
  minTemp: number | null;
  maxTemp: number | null;
  rainRelevant: boolean;
  label: string;
};

export function weatherCodeToState(code: number | null | undefined): KrewWeatherState | null {
  if (code == null || !Number.isFinite(code)) return null;
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return null;
}

const SEVERITY: Record<KrewWeatherState, number> = {
  clear: 1,
  cloudy: 2,
  rain: 3,
  snow: 4,
  storm: 5,
};

export function dominantWeatherState(
  days: { weatherCode: number | null; precipitationMm?: number | null }[],
): KrewWeatherState | null {
  const states = days
    .map((day) => weatherCodeToState(day.weatherCode))
    .filter((state): state is KrewWeatherState => Boolean(state));
  if (!states.length) return null;

  const counts = new Map<KrewWeatherState, number>();
  states.forEach((state) => counts.set(state, (counts.get(state) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || SEVERITY[b[0]] - SEVERITY[a[0]])[0]?.[0] ?? null;
}

export function weatherStateLabel(state: KrewWeatherState | null) {
  switch (state) {
    case "clear":
      return "Ciel dégagé";
    case "cloudy":
      return "Nuageux";
    case "rain":
      return "Pluie";
    case "storm":
      return "Orage";
    case "snow":
      return "Neige";
    default:
      return "Météo";
  }
}
