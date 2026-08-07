/**
 * Géocodage + climat / saisonnalité via Open-Meteo (gratuit, sans clé API).
 * https://open-meteo.com/
 */

export type GeoPlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  population: number | null;
};

export type MonthClimate = {
  month: number;
  tempMaxAvg: number;
  precipitationMm: number;
};

export type ClimateSummary = {
  months: MonthClimate[];
  bestMonths: number[];
  summary: string;
  forecast?: { date: string; tempMax: number; tempMin: number; precipitationMm: number }[] | undefined;
};

const PARIS = { lat: 48.8566, lon: 2.3522 };

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function distanceFromParisKm(lat: number, lon: number): number {
  return haversineKm(PARIS, { lat, lon });
}

/** Résout un nom de ville en coordonnées + pays. */
export async function geocodeDestination(query: string): Promise<GeoPlace | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query,
  )}&count=1&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const payload = (await res.json()) as { results?: any[] };
  const hit = payload.results?.[0];
  if (!hit) return null;
  return {
    name: String(hit.name),
    country: String(hit.country ?? ""),
    latitude: Number(hit.latitude),
    longitude: Number(hit.longitude),
    population: hit.population ? Number(hit.population) : null,
  };
}

const MONTH_LABELS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/**
 * Normales mensuelles calculées sur les 3 dernières années complètes (ERA5),
 * puis déduction des meilleurs mois (température agréable, peu de pluie).
 */
export async function fetchClimate(
  latitude: number,
  longitude: number,
  opts: { startDate?: string | null; endDate?: string | null } = {},
): Promise<ClimateSummary> {
  const lastYear = new Date().getUTCFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${lastYear - 2}-01-01&end_date=${lastYear}-12-31` +
    `&daily=temperature_2m_max,precipitation_sum&timezone=UTC`;

  const res = await fetch(url);
  const months: MonthClimate[] = [];
  if (res.ok) {
    const payload = (await res.json()) as {
      daily?: { time?: string[]; temperature_2m_max?: (number | null)[]; precipitation_sum?: (number | null)[] };
    };
    const time = payload.daily?.time ?? [];
    const temps = payload.daily?.temperature_2m_max ?? [];
    const rain = payload.daily?.precipitation_sum ?? [];
    const buckets = new Map<number, { t: number[]; p: number; years: Set<number> }>();
    time.forEach((day, i) => {
      const month = Number(day.slice(5, 7));
      const year = Number(day.slice(0, 4));
      const bucket = buckets.get(month) ?? { t: [], p: 0, years: new Set<number>() };
      const t = temps[i];
      const p = rain[i];
      if (typeof t === "number") bucket.t.push(t);
      if (typeof p === "number") bucket.p += p;
      bucket.years.add(year);
      buckets.set(month, bucket);
    });
    for (const [month, bucket] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      if (!bucket.t.length) continue;
      months.push({
        month,
        tempMaxAvg: Math.round((bucket.t.reduce((a, b) => a + b, 0) / bucket.t.length) * 10) / 10,
        precipitationMm: Math.round(bucket.p / Math.max(1, bucket.years.size)),
      });
    }
  }

  const scored = months
    .map((m) => ({
      month: m.month,
      score: -Math.abs(m.tempMaxAvg - 24) - m.precipitationMm / 25,
    }))
    .sort((a, b) => b.score - a.score);
  const bestMonths = scored.slice(0, 5).map((m) => m.month).sort((a, b) => a - b);

  const summary = bestMonths.length
    ? `Meilleure période : ${bestMonths.map((m) => MONTH_LABELS[m - 1]).join(", ")}. ` +
      months
        .filter((m) => bestMonths.includes(m.month))
        .map((m) => `${MONTH_LABELS[m.month - 1]} ${Math.round(m.tempMaxAvg)}°C`)
        .join(" · ")
    : "Données climatiques indisponibles";

  let forecast: ClimateSummary["forecast"];
  if (opts.startDate) {
    const start = new Date(opts.startDate);
    const diffDays = (start.getTime() - Date.now()) / 86_400_000;
    if (diffDays >= -1 && diffDays <= 15) {
      const fRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto` +
          `&start_date=${opts.startDate}&end_date=${opts.endDate ?? opts.startDate}`,
      );
      if (fRes.ok) {
        const fp = (await fRes.json()) as { daily?: any };
        forecast = (fp.daily?.time ?? []).map((date: string, i: number) => ({
          date,
          tempMax: Number(fp.daily.temperature_2m_max?.[i] ?? 0),
          tempMin: Number(fp.daily.temperature_2m_min?.[i] ?? 0),
          precipitationMm: Number(fp.daily.precipitation_sum?.[i] ?? 0),
        }));
      }
    }
  }

  return { months, bestMonths, summary, forecast };
}