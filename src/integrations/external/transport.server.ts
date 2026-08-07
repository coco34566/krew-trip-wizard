/**
 * Transport A/R via Kayak Search (RapidAPI).
 * Host: kayak-search.p.rapidapi.com
 * Fallback: estimateTransport(distanceKm) si l'API échoue.
 */

export type TransportQuote = {
  pricePerPerson: number;
  currency: string;
  provider: string;
  mode: "flight" | "estimate";
  label: string;
  url: string | null;
  rawError?: string | null;
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

function pickCheapestPrice(payload: any): { price: number; url: string | null; label: string } | null {
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
  let best: { price: number; url: string | null; label: string } | null = null;

  for (const item of items) {
    const price = num(
      item?.price ??
        item?.totalPrice ??
        item?.displayPrice ??
        item?.cheapestPrice ??
        item?.priceAmount ??
        item?.pricing?.total ??
        item?.fare?.price,
    );
    if (price <= 0) continue;
    const url = item?.url ?? item?.deepLink ?? item?.bookingUrl ?? item?.shareUrl ?? null;
    const label =
      item?.airline ??
      item?.carrier ??
      item?.legs?.[0]?.airline ??
      item?.provider ??
      "Vol Kayak";
    if (!best || price < best.price) best = { price, url, label: String(label) };
  }
  return best;
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
    const best = pickCheapestPrice(payload);
    if (best) {
      return {
        pricePerPerson: Math.round(best.price),
        currency: "EUR",
        provider: "kayak",
        mode: "flight",
        label: best.label,
        url: best.url,
        rawError: null,
      };
    }
  } catch {
    /* try Kiwi */
  }

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
    if (Array.isArray(kiwiPayload?.data)) {
      let minP = 0;
      let url: string | null = null;
      let label = "Vol Kiwi";
      for (const item of kiwiPayload.data) {
        const price = num(item?.price ?? item?.conversion?.EUR);
        if (price > 0 && (minP === 0 || price < minP)) {
          minP = price;
          url = item?.deep_link ?? item?.url ?? null;
          label = item?.airlines?.[0] ? String(item.airlines[0]) : "Vol Kiwi";
        }
      }
      if (minP > 0) {
        return {
          pricePerPerson: Math.round(minP),
          currency: "EUR",
          provider: "kiwi",
          mode: "flight",
          label,
          url,
          rawError: null,
        };
      }
    }
    const best = kiwiPayload ? pickCheapestPrice(kiwiPayload) : null;
    if (best) {
      return {
        pricePerPerson: Math.round(best.price),
        currency: "EUR",
        provider: "kiwi",
        mode: "flight",
        label: best.label,
        url: best.url,
        rawError: null,
      };
    }
  } catch {
    /* estimate */
  }

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