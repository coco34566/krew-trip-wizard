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
  const host = process.env["KAYAK_SEARCH_RAPIDAPI_HOST"] ?? "kayak-search.p.rapidapi.com";

  const fallbackPrice = estimateTransportFromDistance(opts.distanceKm ?? 1000);

  if (!key) {
    return {
      pricePerPerson: fallbackPrice,
      currency: "EUR",
      provider: "estimate",
      mode: "estimate",
      label: "Estimation (pas de clé Kayak)",
      url: null,
      rawError: "missing_api_key",
    };
  }

  try {
    // Paths standards Kayak Search — ajustables via env si le playground diffère
    const searchPath = process.env["KAYAK_FLIGHTS_SEARCH_PATH"] ?? "/flights/search";
    const payload = await rapid(host, key, searchPath, {
      origin: opts.originCity,
      destination: opts.destinationCity,
      departure_date: opts.departDate,
      return_date: opts.returnDate,
      adults: String(Math.min(Math.max(1, opts.adults), 9)),
      currency: "EUR",
      cabin: "economy",
    });

    const best = pickCheapestPrice(payload);
    if (!best) {
      return {
        pricePerPerson: fallbackPrice,
        currency: "EUR",
        provider: "kayak",
        mode: "estimate",
        label: "Estimation (aucun vol Kayak parsé)",
        url: null,
        rawError: "empty_results",
      };
    }

    return {
      pricePerPerson: Math.round(best.price),
      currency: "EUR",
      provider: "kayak",
      mode: "flight",
      label: best.label,
      url: best.url,
      rawError: null,
    };
  } catch (e) {
    return {
      pricePerPerson: fallbackPrice,
      currency: "EUR",
      provider: "estimate",
      mode: "estimate",
      label: "Estimation (Kayak indisponible)",
      url: null,
      rawError: String(e).slice(0, 200),
    };
  }
}