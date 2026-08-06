// src/integrations/external/hotels.rapidapi.ts
// Minimal wrapper for hotels4.p.rapidapi.com (RapidAPI Hotels/Properties endpoints)
// This module provides a resilient `searchHotelsRapidAPI` function that returns
// an array of raw hotel objects from the provider. The exact response shape
// depends on the RapidAPI product; the mapper in the server function should be
// tolerant to differences.

export type RapidApiHotel = any;

function getEnv(key: string): string {
  return (import.meta.env?.[key] as string) || (process.env?.[key] as string) || "";
}

const HOST = getEnv("HOTELS_RAPIDAPI_HOST") || "hotels4.p.rapidapi.com";
const KEY = getEnv("HOTELS_RAPIDAPI_KEY") || "";

if (!KEY) {
  // Do not throw at module import time in the client bundle — only warn on server usage.
  // console.warn('[hotels.rapidapi] HOTELS_RAPIDAPI_KEY not set. Provider disabled.');
}

export async function searchHotelsRapidAPI(opts: {
  destination: string;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number;
  pageSize?: number;
  pageNumber?: number;
}): Promise<RapidApiHotel[]> {
  const { destination, checkin, checkout, adults = 2, pageSize = 25, pageNumber = 1 } = opts;
  if (!KEY) throw new Error("Missing HOTELS_RAPIDAPI_KEY environment variable (RapidAPI)");

  // hotels4.p.rapidapi.com supports a `properties/list` endpoint that accepts
  // a JSON body in some variants or query parameters in others. We conservatively
  // use query params for the common wrappers.
  const base = `https://${HOST}/properties/list`;
  const params = new URLSearchParams({
    destination: destination,
    adults: String(adults),
    currency: "EUR",
    locale: "fr_FR",
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  });
  if (checkin) params.set("checkIn", checkin);
  if (checkout) params.set("checkOut", checkout);

  const url = `${base}?${params.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": KEY,
      "X-RapidAPI-Host": HOST,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Hotels RapidAPI request failed: ${res.status} ${txt}`);
  }

  const payload = await res.json().catch(() => ({}));
  // Common fields where results may live: payload.results, payload.data, payload.properties
  const list = payload.results || payload.data || payload.properties || payload.items || [];
  if (!Array.isArray(list)) return [];
  return list as RapidApiHotel[];
}
