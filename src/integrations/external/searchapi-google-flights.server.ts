/* eslint-disable @typescript-eslint/no-explicit-any */
import { checkTransportTimeCompatibility, type TransportQuote } from "./transport.server";
import { CITY_IATA, normalizeCityKey } from "@/lib/krew/deep-links";

const SEARCH_ENDPOINT = "https://www.searchapi.io/api/v1/search";

export type FlightLocation = {
  id: string;
  name: string;
  type: "airport" | "city";
};

type FlightSearchOptions = {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  adults: number;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  earliestReturnDepartureTime?: string | null;
  latestReturnTime?: string | null;
};

async function searchApi(params: Record<string, string>): Promise<any> {
  const apiKey = process.env["SEARCHAPI_API"];
  if (!apiKey) throw new Error("SEARCHAPI_API manquante");
  const query = new URLSearchParams({ ...params, api_key: apiKey });
  const response = await fetch(`${SEARCH_ENDPOINT}?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `SearchAPI ${params["engine"]} → ${response.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return body;
}

const locationId = (value: any): string | null => {
  const candidate =
    value?.id ?? value?.iata_code ?? value?.iata ?? value?.code ?? value?.airport_code;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim().toUpperCase() : null;
};

/** Résout une ville via le provider, sans aucune table IATA locale. */
export async function resolveGoogleFlightsLocations(query: string): Promise<FlightLocation[]> {
  const payload = await searchApi({ engine: "google_flights_location_search", q: query });
  const roots = [
    payload?.suggestions,
    payload?.locations,
    payload?.airports,
    payload?.results,
    payload?.data,
  ]
    .filter(Array.isArray)
    .flat();
  const candidates = roots.flatMap((item: any) => {
    const nested = [
      item,
      ...(Array.isArray(item?.airports) ? item.airports : []),
      ...(Array.isArray(item?.children) ? item.children : []),
    ];
    return nested.map((entry: any) => ({
      id: locationId(entry),
      name: String(entry?.name ?? entry?.title ?? entry?.city ?? entry?.label ?? query),
      type: String(entry?.type ?? "")
        .toLowerCase()
        .includes("airport")
        ? ("airport" as const)
        : ("city" as const),
    }));
  });
  const unique = new Map<string, FlightLocation>();
  for (const candidate of candidates) {
    if (candidate.id && !unique.has(candidate.id))
      unique.set(candidate.id, candidate as FlightLocation);
  }
  if (!unique.size) throw new Error(`SearchAPI: aucun identifiant aérien pour « ${query} »`);
  return [...unique.values()];
}

const unknownLocationCache = new Map<string, Promise<FlightLocation[]>>();

function flightLocations(city: string): Promise<FlightLocation[]> {
  const key = normalizeCityKey(city);
  const iata = CITY_IATA[key];
  if (iata) return Promise.resolve([{ id: iata, name: city.trim(), type: "city" }]);
  let pending = unknownLocationCache.get(key);
  if (!pending) {
    pending = resolveGoogleFlightsLocations(city).catch((error) => {
      unknownLocationCache.delete(key);
      throw error;
    });
    unknownLocationCache.set(key, pending);
  }
  return pending;
}

export function clearGoogleFlightsLocationCacheForTests() {
  unknownLocationCache.clear();
}

const timePart = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:T|\s)(\d{2}:\d{2})/) ?? value.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? null;
};

/** Normalise une offre Google Flights dans le modèle fournisseur KREW. */
export function normalizeGoogleFlightOffer(item: any, adults: number): TransportQuote | null {
  const outbound = Array.isArray(item?.flights)
    ? item.flights
    : Array.isArray(item?.outbound_flights)
      ? item.outbound_flights
      : [];
  const inbound = Array.isArray(item?.return_flights)
    ? item.return_flights
    : Array.isArray(item?.inbound_flights)
      ? item.inbound_flights
      : [];
  const segments = [...outbound, ...inbound];
  const price = Number(item?.price ?? item?.total_price ?? item?.booking_options?.[0]?.price);
  if (!Number.isFinite(price) || price <= 0 || outbound.length === 0) return null;
  const firstOut = outbound[0];
  const lastOut = outbound[outbound.length - 1];
  const firstReturn = inbound[0];
  const lastReturn = inbound[inbound.length - 1];
  const airline =
    [...new Set(segments.map((s: any) => s?.airline).filter(Boolean))].join(", ") ||
    "Google Flights";
  const bookingToken =
    item?.booking_token ??
    item?.departure_token ??
    item?.booking_options?.[0]?.booking_token ??
    null;
  return {
    pricePerPerson: Math.round(price),
    currency: String(item?.currency ?? "EUR"),
    provider: "searchapi/google_flights",
    mode: "flight",
    label: airline,
    url: item?.booking_url ?? item?.link ?? null,
    searchUrl: null,
    rawError: null,
    dataKind: "provider_offer",
    airline,
    origin: firstOut?.departure_airport?.name ?? firstOut?.departure_airport?.id ?? null,
    departureAirport: firstOut?.departure_airport?.id ?? null,
    destination: lastOut?.arrival_airport?.name ?? lastOut?.arrival_airport?.id ?? null,
    arrivalAirport: lastOut?.arrival_airport?.id ?? null,
    outboundTime: timePart(firstOut?.departure_airport?.time ?? firstOut?.departure_time),
    outboundArrivalTime: timePart(lastOut?.arrival_airport?.time ?? lastOut?.arrival_time),
    returnDepartureTime: timePart(
      firstReturn?.departure_airport?.time ?? firstReturn?.departure_time,
    ),
    returnTime: timePart(lastReturn?.arrival_airport?.time ?? lastReturn?.arrival_time),
    durationMinutes:
      outbound.reduce((sum: number, segment: any) => sum + (Number(segment?.duration) || 0), 0) ||
      null,
    outboundDurationMinutes:
      outbound.reduce((sum: number, segment: any) => sum + (Number(segment?.duration) || 0), 0) ||
      null,
    returnDurationMinutes:
      inbound.reduce((sum: number, segment: any) => sum + (Number(segment?.duration) || 0), 0) ||
      null,
    stops: Math.max(0, outbound.length - 1),
    outboundStops: Math.max(0, outbound.length - 1),
    returnStops: Math.max(0, inbound.length - 1),
    segments,
    adults,
    bookingToken,
  };
}

export async function searchGoogleFlightsRoundTrip(
  opts: FlightSearchOptions,
): Promise<TransportQuote> {
  const [origins, destinations] = await Promise.all([
    flightLocations(opts.originCity),
    flightLocations(opts.destinationCity),
  ]);
  const payload = await searchApi({
    engine: "google_flights",
    departure_id: origins.map((location) => location.id).join(","),
    arrival_id: destinations.map((location) => location.id).join(","),
    outbound_date: opts.departDate,
    return_date: opts.returnDate,
    flight_type: "round_trip",
    adults: String(Math.min(9, Math.max(1, opts.adults))),
    currency: "EUR",
    hl: "fr",
    gl: "fr",
  });
  const items = [
    ...(payload?.best_flights ?? []),
    ...(payload?.other_flights ?? []),
    ...(payload?.flights ?? []),
  ];
  const constraints = opts;
  const compatible = items
    .map((item: any) => normalizeGoogleFlightOffer(item, opts.adults))
    .filter((quote: TransportQuote | null): quote is TransportQuote => Boolean(quote))
    .filter((quote) => checkTransportTimeCompatibility(quote, constraints, true).isCompatible)
    .sort((a, b) => a.pricePerPerson - b.pricePerPerson);
  if (!compatible[0])
    throw new Error("SearchAPI: aucune offre compatible avec les contraintes impératives");
  return compatible[0];
}
