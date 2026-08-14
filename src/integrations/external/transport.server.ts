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
  url: string | null;
  rawError?: string | null;
  outsideTimeWindow?: boolean;
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
    throw new Error(`${host}${path} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 250)}`);
  }
  return res.json() as Promise<any>;
}

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Extrait les heures de départ (aller) et de retour (inbound) d'un vol pour le filtrage horaire.
 */
function extractItemTimes(item: any, provider: string): { outboundTime: string | null; outboundArrivalTime: string | null; returnDepartureTime: string | null; returnTime: string | null } {
  let outboundTime: string | null = null;
  let outboundArrivalTime: string | null = null;
  let returnDepartureTime: string | null = null;
  let returnTime: string | null = null;

  if (provider === "kayak") {
    const legs = item?.legs;
    if (Array.isArray(legs) && legs.length > 0) {
      const dep0 = legs[0]?.departure || legs[0]?.departureTime;
      if (dep0) {
        outboundTime = dep0.includes("T") ? dep0.split("T")[1]?.slice(0, 5) || null : dep0.slice(0, 5);
      }
      const arr0 = legs[0]?.arrival || legs[0]?.arrivalTime;
      if (arr0) {
        outboundArrivalTime = arr0.includes("T") ? arr0.split("T")[1]?.slice(0, 5) || null : arr0.slice(0, 5);
      }
      if (legs.length > 1) {
        const dep1 = legs[1]?.departure || legs[1]?.departureTime;
        if (dep1) {
          returnDepartureTime = dep1.includes("T") ? dep1.split("T")[1]?.slice(0, 5) || null : dep1.slice(0, 5);
        }
        const arr1 = legs[1]?.arrival || legs[1]?.arrivalTime;
        if (arr1) {
          returnTime = arr1.includes("T") ? arr1.split("T")[1]?.slice(0, 5) || null : arr1.slice(0, 5);
        }
      }
    } else {
      const dep = item?.departure_time || item?.departureTime;
      if (dep) outboundTime = dep.slice(0, 5);
    }
  } else if (provider === "kiwi") {
    const locDep = item?.local_departure;
    if (locDep) {
      outboundTime = locDep.includes("T") ? locDep.split("T")[1]?.slice(0, 5) || null : locDep.slice(0, 5);
    }
    const locArr = item?.local_arrival;
    if (locArr) {
      outboundArrivalTime = locArr.includes("T") ? locArr.split("T")[1]?.slice(0, 5) || null : locArr.slice(0, 5);
    }
    const route = item?.route;
    if (Array.isArray(route)) {
      const returnSeg = route.find((r: any) => r.return === 1 || r.return === true);
      if (returnSeg) {
        if (returnSeg.local_departure) {
          returnDepartureTime = returnSeg.local_departure.includes("T")
            ? returnSeg.local_departure.split("T")[1]?.slice(0, 5) || null
            : returnSeg.local_departure.slice(0, 5);
        }
        if (returnSeg.local_arrival) {
          returnTime = returnSeg.local_arrival.includes("T")
            ? returnSeg.local_arrival.split("T")[1]?.slice(0, 5) || null
            : returnSeg.local_arrival.slice(0, 5);
        }
      }
    }
  }

  return { outboundTime, outboundArrivalTime, returnDepartureTime, returnTime };
}

/**
 * Sélectionne la meilleure offre de transport dans la fenêtre horaire souhaitée.
 * Fallback sur la moins chère globale si aucune n'est compatible.
 */
function pickCheapestPriceInWindow(
  items: any[],
  provider: string,
  earliestDepartureTime?: string | null,
  latestReturnTime?: string | null,
  latestArrivalTime?: string | null,
  earliestReturnDepartureTime?: string | null
): { best: any; outsideWindow: boolean } | null {
  if (!items || items.length === 0) return null;

  let bestInWindow: any = null;
  let bestOverall: any = null;

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

    const { outboundTime, outboundArrivalTime, returnDepartureTime, returnTime } = extractItemTimes(item, provider);

    let match = true;
    if (earliestDepartureTime && outboundTime && outboundTime < earliestDepartureTime) {
      match = false;
    }
    if (latestArrivalTime && outboundArrivalTime && outboundArrivalTime > latestArrivalTime) {
      match = false;
    }
    if (earliestReturnDepartureTime && returnDepartureTime && returnDepartureTime < earliestReturnDepartureTime) {
      match = false;
    }
    if (latestReturnTime && returnTime && returnTime > latestReturnTime) {
      match = false;
    }

    const priceObj = {
      price,
      url: item?.url ?? item?.deepLink ?? item?.bookingUrl ?? item?.shareUrl ?? item?.deep_link ?? null,
      label: item?.airline ?? item?.carrier ?? item?.legs?.[0]?.airline ?? item?.provider ?? item?.airlines?.[0] ?? (provider === "kayak" ? "Vol Kayak" : "Vol Kiwi"),
    };

    if (!bestOverall || price < bestOverall.price) {
      bestOverall = priceObj;
    }

    if (match) {
      if (!bestInWindow || price < bestInWindow.price) {
        bestInWindow = priceObj;
      }
    }
  }

  if (bestInWindow) {
    return { best: bestInWindow, outsideWindow: false };
  } else if (bestOverall) {
    return { best: bestOverall, outsideWindow: true };
  }

  return null;
}

/** Estimation distance (fallback historique Krew). */
export function estimateTransportFromDistance(distanceKm: number): number {
  if (distanceKm <= 350) return 45;
  if (distanceKm <= 900) return 90;
  if (distanceKm <= 1600) return 130;
  return Math.round(130 + (distanceKm - 1600) * 0.05);
}

/**
 * Prix transport A/R par personne.
 * 1) Kayak flights  2) sinon estimation distance
 */
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
  const key = process.env["HOTELS_RAPIDAPI_KEY"] ?? process.env["KAYAK_RAPIDAPI_KEY"] ?? "";
  const kayakHost = process.env["KAYAK_SEARCH_RAPIDAPI_HOST"] ?? "kayak-search.p.rapidapi.com";
  const kiwiHost = process.env["KIWI_RAPIDAPI_HOST"] ?? "kiwi-com-cheap-flights.p.rapidapi.com";

  const fallbackPrice = estimateTransportFromDistance(opts.distanceKm ?? 1000);
  const adults = String(Math.min(Math.max(1, opts.adults), 9));

  if (!key) {
    return {
      pricePerPerson: fallbackPrice,
      currency: "EUR",
      provider: "estimate",
      mode: "estimate",
      label: "Estimation (pas de clé RapidAPI)",
      url: null,
      rawError: "missing_api_key",
    };
  }

  let kayakError: any = null;
  // 1) Kayak
  try {
    const searchPath = process.env["KAYAK_FLIGHTS_SEARCH_PATH"] ?? "/flights/search";
    const payload = await rapid(kayakHost, key, searchPath, {
      origin: opts.originCity,
      destination: opts.destinationCity,
      departure_date: opts.departDate,
      return_date: opts.returnDate,
      adults,
      currency: "EUR",
      cabin: "economy",
    });

    const lists = [
      payload?.data?.flights,
      payload?.data?.results,
      payload?.data?.itineraries,
      payload?.results,
      payload?.flights,
      payload?.data,
      payload?.searchResults,
    ].filter(Array.isArray) as any[][];
    const items = lists.find((a) => a.length > 0) ?? [];

    const result = pickCheapestPriceInWindow(
      items,
      "kayak",
      opts.earliestDepartureTime,
      opts.latestReturnTime,
      opts.latestArrivalTime,
      opts.earliestReturnDepartureTime
    );
    if (result) {
      return {
        pricePerPerson: Math.round(result.best.price),
        currency: "EUR",
        provider: "kayak",
        mode: "flight",
        label: result.best.label,
        url: result.best.url,
        rawError: null,
        outsideTimeWindow: result.outsideWindow,
      };
    }
  } catch (err) {
    kayakError = err;
  }

  let kiwiError: any = null;
  // 2) Kiwi fallback
  try {
    const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");
    let kiwiPayload: any = null;
    for (const path of ["/v2/search", "/search", "/flights/search"]) {
      try {
        kiwiPayload = await rapid(kiwiHost, key, path, {
          fly_from: opts.originCity,
          fly_to: opts.destinationCity,
          date_from: ddmmyyyy(opts.departDate),
          date_to: ddmmyyyy(opts.departDate),
          return_from: ddmmyyyy(opts.returnDate),
          return_to: ddmmyyyy(opts.returnDate),
          adults,
          curr: "EUR",
          limit: "5",
          sort: "price",
        });
        if (kiwiPayload) break;
      } catch {
        /* next path */
      }
    }

    const items = kiwiPayload?.data;
    if (Array.isArray(items)) {
      const result = pickCheapestPriceInWindow(
        items,
        "kiwi",
        opts.earliestDepartureTime,
        opts.latestReturnTime,
        opts.latestArrivalTime,
        opts.earliestReturnDepartureTime
      );
      if (result) {
        return {
          pricePerPerson: Math.round(result.best.price),
          currency: "EUR",
          provider: "kiwi",
          mode: "flight",
          label: result.best.label,
          url: result.best.url,
          rawError: null,
          outsideTimeWindow: result.outsideWindow,
        };
      }
    }
  } catch (err) {
    kiwiError = err;
  }

  reportServerError(new Error(`Toutes les cotations de transport ont échoué. Kayak error: ${kayakError?.message || kayakError}. Kiwi error: ${kiwiError?.message || kiwiError}`), {
    provider: "kayak/kiwi",
    kind: "transport",
    originCity: opts.originCity,
    destinationCity: opts.destinationCity,
  });

  return {
    pricePerPerson: fallbackPrice,
    currency: "EUR",
    provider: "estimate",
    mode: "estimate",
    label: "Estimation (Kayak/Kiwi indisponibles)",
    url: null,
    rawError: "no_live_quote",
  };
}
