/**
 * Transport A/R via Kayak Search (RapidAPI).
 * Host: kayak-search.p.rapidapi.com
 * Fallback: estimateTransport(distanceKm) si l'API échoue.
 */

import { reportServerError } from "@/lib/server-error-reporting.server";

export type TransportQuote = {
  pricePerPerson: number;
  currency: string;
  provider: string;
  mode: "flight" | "estimate";
  label: string;
  /** URL d'offre fournie par le provider, si disponible. */
  url: string | null;
  /** Recherche exacte reconstruite depuis les paramètres de l'offre. */
  searchUrl?: string | null;
  rawError?: string | null;
  outsideTimeWindow?: boolean;
  dataKind?: "provider_offer" | "external_search" | "krew_estimate";
  airline?: string | null;
  origin?: string | null;
  departureAirport?: string | null;
  destination?: string | null;
  arrivalAirport?: string | null;
  outboundTime?: string | null;
  outboundArrivalTime?: string | null;
  returnDepartureTime?: string | null;
  returnTime?: string | null;
  durationMinutes?: number | null;
  outboundDurationMinutes?: number | null;
  returnDurationMinutes?: number | null;
  stops?: number;
  outboundStops?: number;
  returnStops?: number;
  segments?: unknown[];
  adults?: number;
  bookingToken?: string | null;
};

async function rapid(host: string, key: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(
      `${host}${path} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 250)}`,
    );
  }
  return res.json() as Promise<any>;
}

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(
    String(v ?? "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
};

function buildExactFlightSearchUrl(opts: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  adults: number;
}): string {
  const origin = opts.originCity.trim();
  const destination = opts.destinationCity.trim();
  const adults = Math.max(1, Math.min(9, Number(opts.adults) || 1));
  return `https://www.google.com/travel/flights?q=Flights%20to%20${encodeURIComponent(destination)}%20from%20${encodeURIComponent(origin)}%20on%20${opts.departDate}%20through%20${opts.returnDate}`;
}

/** Extrait les horaires aller/retour d'un résultat fournisseur. */
function extractItemTimes(
  item: any,
  provider: string,
): {
  outboundTime: string | null;
  outboundArrivalTime: string | null;
  returnDepartureTime: string | null;
  returnTime: string | null;
} {
  let outboundTime: string | null = null;
  let outboundArrivalTime: string | null = null;
  let returnDepartureTime: string | null = null;
  let returnTime: string | null = null;

  if (provider === "kayak") {
    const legs = item?.legs;
    if (Array.isArray(legs) && legs.length > 0) {
      const dep0 = legs[0]?.departure || legs[0]?.departureTime;
      if (dep0)
        outboundTime = dep0.includes("T")
          ? dep0.split("T")[1]?.slice(0, 5) || null
          : dep0.slice(0, 5);
      const arr0 = legs[0]?.arrival || legs[0]?.arrivalTime;
      if (arr0)
        outboundArrivalTime = arr0.includes("T")
          ? arr0.split("T")[1]?.slice(0, 5) || null
          : arr0.slice(0, 5);
      if (legs.length > 1) {
        const dep1 = legs[1]?.departure || legs[1]?.departureTime;
        if (dep1)
          returnDepartureTime = dep1.includes("T")
            ? dep1.split("T")[1]?.slice(0, 5) || null
            : dep1.slice(0, 5);
        const arr1 = legs[1]?.arrival || legs[1]?.arrivalTime;
        if (arr1)
          returnTime = arr1.includes("T")
            ? arr1.split("T")[1]?.slice(0, 5) || null
            : arr1.slice(0, 5);
      }
    } else {
      const dep = item?.departure_time || item?.departureTime;
      if (dep) outboundTime = dep.slice(0, 5);
    }
  } else if (provider === "kiwi") {
    const locDep = item?.local_departure;
    if (locDep)
      outboundTime = locDep.includes("T")
        ? locDep.split("T")[1]?.slice(0, 5) || null
        : locDep.slice(0, 5);
    const locArr = item?.local_arrival;
    if (locArr)
      outboundArrivalTime = locArr.includes("T")
        ? locArr.split("T")[1]?.slice(0, 5) || null
        : locArr.slice(0, 5);
    const route = item?.route;
    if (Array.isArray(route)) {
      const returnSeg = route.find((r: any) => r.return === 1 || r.return === true);
      if (returnSeg) {
        if (returnSeg.local_departure)
          returnDepartureTime = returnSeg.local_departure.includes("T")
            ? returnSeg.local_departure.split("T")[1]?.slice(0, 5) || null
            : returnSeg.local_departure.slice(0, 5);
        if (returnSeg.local_arrival)
          returnTime = returnSeg.local_arrival.includes("T")
            ? returnSeg.local_arrival.split("T")[1]?.slice(0, 5) || null
            : returnSeg.local_arrival.slice(0, 5);
      }
    }
  }
  return { outboundTime, outboundArrivalTime, returnDepartureTime, returnTime };
}

export function checkTransportTimeCompatibility(
  times: {
    outboundTime?: string | null;
    outboundArrivalTime?: string | null;
    returnDepartureTime?: string | null;
    returnTime?: string | null;
  },
  constraints: {
    earliestDepartureTime?: string | null | undefined;
    latestArrivalTime?: string | null | undefined;
    earliestReturnDepartureTime?: string | null | undefined;
    latestReturnTime?: string | null | undefined;
  },
  isImperative: boolean = true,
): { isCompatible: boolean; reason?: string } {
  if (constraints.earliestDepartureTime) {
    if (times.outboundTime) {
      if (times.outboundTime < constraints.earliestDepartureTime)
        return {
          isCompatible: false,
          reason: `Départ aller (${times.outboundTime}) trop tôt (exigé >= ${constraints.earliestDepartureTime})`,
        };
    } else if (isImperative)
      return {
        isCompatible: false,
        reason: `Heure de départ aller inconnue alors que la contrainte de départ (${constraints.earliestDepartureTime}) est impérative`,
      };
  }
  if (constraints.latestArrivalTime) {
    if (times.outboundArrivalTime) {
      if (times.outboundArrivalTime > constraints.latestArrivalTime)
        return {
          isCompatible: false,
          reason: `Arrivée aller (${times.outboundArrivalTime}) trop tardive (exigée <= ${constraints.latestArrivalTime})`,
        };
    } else if (isImperative)
      return {
        isCompatible: false,
        reason: `Heure d'arrivée aller inconnue alors que la contrainte d'arrivée (${constraints.latestArrivalTime}) est impérative`,
      };
  }
  if (constraints.earliestReturnDepartureTime) {
    if (times.returnDepartureTime) {
      if (times.returnDepartureTime < constraints.earliestReturnDepartureTime)
        return {
          isCompatible: false,
          reason: `Départ retour (${times.returnDepartureTime}) trop tôt (exigé >= ${constraints.earliestReturnDepartureTime})`,
        };
    } else if (isImperative)
      return {
        isCompatible: false,
        reason: `Heure de départ retour inconnue alors que la contrainte de départ retour (${constraints.earliestReturnDepartureTime}) est impérative`,
      };
  }
  if (constraints.latestReturnTime) {
    if (times.returnTime) {
      if (times.returnTime > constraints.latestReturnTime)
        return {
          isCompatible: false,
          reason: `Arrivée retour (${times.returnTime}) trop tardive (exigée <= ${constraints.latestReturnTime})`,
        };
    } else if (isImperative)
      return {
        isCompatible: false,
        reason: `Heure d'arrivée retour inconnue alors que la contrainte d'arrivée retour (${constraints.latestReturnTime}) est impérative`,
      };
  }
  return { isCompatible: true };
}

function pickCheapestPriceInWindow(
  items: any[],
  provider: string,
  earliestDepartureTime?: string | null,
  latestReturnTime?: string | null,
  latestArrivalTime?: string | null,
  earliestReturnDepartureTime?: string | null,
  isImperative: boolean = true,
): { best: any; outsideWindow: boolean } | null {
  if (!items?.length) return null;
  let bestInWindow: any = null;
  let bestOverall: any = null;
  const constraints = {
    earliestDepartureTime,
    latestArrivalTime,
    earliestReturnDepartureTime,
    latestReturnTime,
  };
  for (const item of items) {
    const price = num(
      item?.price ??
        item?.totalPrice ??
        item?.displayPrice ??
        item?.cheapestPrice ??
        item?.priceAmount ??
        item?.pricing?.total ??
        item?.fare?.price ??
        item?.conversion?.EUR,
    );
    if (price <= 0) continue;
    const times = extractItemTimes(item, provider);
    const { isCompatible } = checkTransportTimeCompatibility(times, constraints, isImperative);
    const priceObj = {
      price,
      url:
        item?.url ??
        item?.deepLink ??
        item?.bookingUrl ??
        item?.shareUrl ??
        item?.deep_link ??
        null,
      label:
        item?.airline ??
        item?.carrier ??
        item?.legs?.[0]?.airline ??
        item?.provider ??
        item?.airlines?.[0] ??
        (provider === "kayak" ? "Vol Kayak" : "Vol Kiwi"),
    };
    if (!bestOverall || price < bestOverall.price) bestOverall = priceObj;
    if (isCompatible && (!bestInWindow || price < bestInWindow.price)) bestInWindow = priceObj;
  }
  if (bestInWindow) return { best: bestInWindow, outsideWindow: false };
  if (bestOverall) return { best: bestOverall, outsideWindow: true };
  return null;
}

export function estimateTransportFromDistance(distanceKm: number): number {
  if (distanceKm <= 350) return 45;
  if (distanceKm <= 900) return 90;
  if (distanceKm <= 1600) return 130;
  return Math.round(130 + (distanceKm - 1600) * 0.05);
}

export async function searchTransportRoundTrip(opts: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  adults: number;
  distanceKm?: number;
  earliestDepartureTime?: string | null;
  latestReturnTime?: string | null;
  latestArrivalTime?: string | null;
  earliestReturnDepartureTime?: string | null;
}): Promise<TransportQuote> {
  try {
    const { searchGoogleFlightsRoundTrip } = await import("./searchapi-google-flights.server");
    return await searchGoogleFlightsRoundTrip(opts);
  } catch (searchApiError) {
    if (process.env["SEARCHAPI_API"])
      reportServerError(searchApiError, {
        provider: "searchapi/google_flights",
        kind: "transport",
        originCity: opts.originCity,
        destinationCity: opts.destinationCity,
      });
  }
  const fallbackPrice = estimateTransportFromDistance(opts.distanceKm ?? 1000);
  const adults = Math.min(Math.max(1, opts.adults), 9);
  const exactSearchUrl = buildExactFlightSearchUrl({ ...opts, adults });
  return {
    pricePerPerson: fallbackPrice,
    currency: "EUR",
    provider: "estimate",
    mode: "estimate",
    dataKind: "krew_estimate",
    label: "Estimation KREW (offre avion indisponible)",
    url: null,
    searchUrl: exactSearchUrl,
    rawError: "no_live_quote",
  };
}
