/**
 * Génération d'URL comparateurs (affichage uniquement — pas de scoring).
 * Codes IATA courants Europe ; fallback nom de ville en clair.
 */

export type DepartureOrigin = { city: string; count: number };

/** Ville (normalisée) → code aéroport principal. */
export const CITY_IATA: Record<string, string> = {
  paris: "PAR",
  "paris cdg": "CDG",
  "paris orly": "ORY",
  lyon: "LYS",
  marseille: "MRS",
  nice: "NCE",
  toulouse: "TLS",
  bordeaux: "BOD",
  nantes: "NTE",
  lille: "LIL",
  strasbourg: "SXB",
  montpellier: "MPL",
  rennes: "RNS",
  geneve: "GVA",
  geneva: "GVA",
  bruxelles: "BRU",
  brussels: "BRU",
  amsterdam: "AMS",
  londres: "LON",
  london: "LON",
  barcelone: "BCN",
  barcelona: "BCN",
  madrid: "MAD",
  rome: "ROM",
  roma: "ROM",
  milan: "MIL",
  lisbonne: "LIS",
  lisbon: "LIS",
  porto: "OPO",
  berlin: "BER",
  munich: "MUC",
  münchen: "MUC",
  francfort: "FRA",
  frankfurt: "FRA",
  vienne: "VIE",
  vienna: "VIE",
  prague: "PRG",
  budapest: "BUD",
  cracovie: "KRK",
  varsovie: "WAW",
  dubrovnik: "DBV",
  split: "SPU",
  athenes: "ATH",
  athens: "ATH",
  dublin: "DUB",
  copenhague: "CPH",
  stockholm: "STO",
  oslo: "OSL",
  zurich: "ZRH",
  basel: "BSL",
  bale: "BSL",
};

/** Coordonnées approx pour estimer distance train vs avion. */
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  paris: { lat: 48.86, lon: 2.35 },
  lyon: { lat: 45.75, lon: 4.85 },
  marseille: { lat: 43.3, lon: 5.4 },
  nice: { lat: 43.7, lon: 7.27 },
  toulouse: { lat: 43.6, lon: 1.44 },
  bordeaux: { lat: 44.84, lon: -0.58 },
  nantes: { lat: 47.22, lon: -1.55 },
  lille: { lat: 50.63, lon: 3.06 },
  strasbourg: { lat: 48.57, lon: 7.75 },
  montpellier: { lat: 43.61, lon: 3.88 },
  rennes: { lat: 48.11, lon: -1.68 },
  geneve: { lat: 46.2, lon: 6.14 },
  bruxelles: { lat: 50.85, lon: 4.35 },
  amsterdam: { lat: 52.37, lon: 4.9 },
  londres: { lat: 51.51, lon: -0.13 },
  barcelone: { lat: 41.39, lon: 2.17 },
  madrid: { lat: 40.42, lon: -3.7 },
  rome: { lat: 41.9, lon: 12.5 },
  milan: { lat: 45.46, lon: 9.19 },
  lisbonne: { lat: 38.72, lon: -9.14 },
  berlin: { lat: 52.52, lon: 13.4 },
  munich: { lat: 48.14, lon: 11.58 },
  vienne: { lat: 48.21, lon: 16.37 },
  prague: { lat: 50.08, lon: 14.44 },
  budapest: { lat: 47.5, lon: 19.04 },
};

export function normalizeCityKey(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Code IATA si connu, sinon nom de ville (accepté par Google Flights / Kayak). */
export function cityToIataOrName(city: string): string {
  const key = normalizeCityKey(city);
  return CITY_IATA[key] ?? city.trim();
}

function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance estimée origine → destination (km). */
export function estimateDistanceKm(
  originCity: string,
  destCity: string,
  fallbackKm?: number | null,
): number {
  const o = CITY_COORDS[normalizeCityKey(originCity)];
  const d = CITY_COORDS[normalizeCityKey(destCity)];
  if (o && d) return Math.round(haversineKm(o, d));
  if (fallbackKm != null && Number.isFinite(fallbackKm)) return Number(fallbackKm);
  return 9999;
}

function ymd(date: string | null | undefined, fallbackDaysFromNow = 21): string {
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() + fallbackDaysFromNow);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type DeepLinkContext = {
  originCity: string;
  destinationCity: string;
  departDate: string | null;
  returnDate: string | null;
  nights?: number;
  adults: number;
  /** Distance catalogue (ex. depuis Paris) en secours. */
  fallbackDistanceKm?: number | null;
};

export type OriginDeepLinks = {
  originCity: string;
  adults: number;
  distanceKm: number;
  showTrain: boolean;
  googleFlights: string;
  kayak: string;
  omio: string | null;
  trainline: string | null;
  sncf: string | null;
  booking: string;
};

export function buildOriginDeepLinks(ctx: DeepLinkContext): OriginDeepLinks {
  const depart = ymd(ctx.departDate, 21);
  const nights = ctx.nights && ctx.nights > 0 ? ctx.nights : 3;
  const ret =
    ctx.returnDate && /^\d{4}-\d{2}-\d{2}/.test(ctx.returnDate)
      ? ctx.returnDate.slice(0, 10)
      : addDays(depart, nights);

  const originLabel = ctx.originCity.trim();
  const destLabel = ctx.destinationCity.trim();
  const originCode = cityToIataOrName(originLabel);
  const destCode = cityToIataOrName(destLabel);
  const adults = Math.max(1, Math.min(9, ctx.adults || 1));

  const distanceKm = estimateDistanceKm(originLabel, destLabel, ctx.fallbackDistanceKm);
  const showTrain = distanceKm < 700;

  const googleFlights =
    `https://www.google.com/travel/flights?q=` +
    encodeURIComponent(`Vols de ${originLabel} à ${destLabel} le ${depart} retour ${ret}`);

  // Kayak FR : codes IATA ou ville
  const kayak =
    `https://www.kayak.fr/flights/${encodeURIComponent(originCode)}-${encodeURIComponent(destCode)}/${depart}/${ret}?adults=${adults}`;

  const booking =
    `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destLabel)}` +
    `&checkin=${depart}&checkout=${ret}&group_adults=${adults}&no_rooms=1&lang=fr`;

  let omio: string | null = null;
  let trainline: string | null = null;
  let sncf: string | null = null;

  if (showTrain) {
    omio =
      `https://www.omio.fr/search?` +
      `departurePosition=${encodeURIComponent(originLabel)}` +
      `&arrivalPosition=${encodeURIComponent(destLabel)}` +
      `&departureDate=${depart}&returnDate=${ret}` +
      `&adults=${adults}`;
    trainline =
      `https://www.thetrainline.com/search/` +
      `${encodeURIComponent(originLabel)}/` +
      `${encodeURIComponent(destLabel)}/` +
      `${depart}/${ret}`;
    sncf =
      `https://www.sncf-connect.com/app/home/search/` +
      `?originLabel=${encodeURIComponent(originLabel)}` +
      `&destinationLabel=${encodeURIComponent(destLabel)}` +
      `&outwardDate=${depart}` +
      `&inwardDate=${ret}` +
      `&passengers=${adults}`;
  }

  return {
    originCity: originLabel,
    adults,
    distanceKm,
    showTrain,
    googleFlights,
    kayak,
    omio,
    trainline,
    sncf,
    booking,
  };
}

export function buildDeepLinksForProposal(params: {
  destinationCity: string;
  origins: DepartureOrigin[];
  departDate: string | null;
  returnDate: string | null;
  nights?: number;
  fallbackDistanceKm?: number | null;
  /** Booking : total adultes du groupe (hébergement partagé). */
  groupAdults?: number;
}): { origins: OriginDeepLinks[]; bookingGroup: string } {
  const origins = (params.origins.length ? params.origins : [{ city: "Paris", count: 1 }]).map(
    (o) =>
      buildOriginDeepLinks({
        originCity: o.city,
        destinationCity: params.destinationCity,
        departDate: params.departDate,
        returnDate: params.returnDate,
        nights: params.nights,
        adults: o.count,
        fallbackDistanceKm: params.fallbackDistanceKm,
      }),
  );

  const depart = ymd(params.departDate, 21);
  const nights = params.nights && params.nights > 0 ? params.nights : 3;
  const ret =
    params.returnDate && /^\d{4}-\d{2}-\d{2}/.test(params.returnDate)
      ? params.returnDate.slice(0, 10)
      : addDays(depart, nights);
  const groupAdults = Math.max(1, params.groupAdults ?? origins.reduce((s, o) => s + o.adults, 0));
  const bookingGroup =
    `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(params.destinationCity)}` +
    `&checkin=${depart}&checkout=${ret}&group_adults=${Math.min(groupAdults, 30)}&no_rooms=${Math.max(1, Math.ceil(groupAdults / 3))}&lang=fr`;

  return { origins, bookingGroup };
}
