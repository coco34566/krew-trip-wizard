import type { HotelOffer, SearchParams } from "./travel-providers.server";

async function stayApiSearchByUrl(url: string) {
  const key = process.env.STAYAPI_API_KEY;
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");
  const params = new URLSearchParams({ url });
  const res = await fetch(`https://api.stayapi.com/v1/booking/search_by_url?${params.toString()}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const text = await res.text();
  let body: any;
  try { body