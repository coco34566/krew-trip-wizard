import type { HotelOffer, SearchParams } from "./travel-providers.server";

const STAYAPI_ENDPOINT = "https://api.stayapi.com/v1/booking/search";

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickHotels(payload: any): any[] {
  const candidates = [
    payload?.data?.hotels,
    payload?.data?.results,
    payload?.data?.result,
    payload?.data?.data,
    Array.isArray(payload?.data) ? payload.data : null,
    payload?.hotels,
    payload?.results,
  ];
  return candidates.find(Array.isArray) ?? [];
}

function normalizeHotel(raw: any): HotelOffer | null {
  const id = String(raw?.hotel_id ?? raw?.hotelId ?? raw?.property_id ?? raw?.id ?? "");
  const name = raw?.hotel_name ?? raw?.name ?? raw?.property?.name ?? raw?.title;
  const amount = num(raw?.price?.amount ?? raw?.min_total_price ?? raw?.price ?? raw?.pricePerNight);
  if (!id || !name || amount <= 0) return null;

  return {
    externalId: `stayapi/booking:${id}`,
    name: String(name),
    type: "hotel",
    description: raw?.room_name ?? raw?.unit_configuration_label ?? raw?.description ?? null,
    rating: num(raw?.rating?.score ?? raw?.review_score ?? raw?.reviewScore ?? raw?.star_rating ?? 0),
    distanceCenterKm: num(raw?.distance_from_center ?? raw?.distance ?? 0),
    imageUrl: raw?.image_url ?? raw?.imageUrl ?? null,
    offers: [
      {
        provider: "stayapi/booking",
        pricePerNight: Math.round(amount),
        currency: String(raw?.price?.currency ?? raw?.currency_code ?? "EUR"),
        url: raw?.url ?? raw?.booking_url ?? null,
      },
    ],
  };
}

export async function searchHotelsStayApi(params: SearchParams & { destId: string; destType?: string }): Promise<HotelOffer[]> {
  const key = process.env.STAYAPI_API_KEY;
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");
  if (!params.destId) throw new Error("StayAPI: dest_id manquant pour la destination sélectionnée");

  const query = new URLSearchParams({
    dest_id: String(params.destId),
    dest_type: String(params.destType ?? "CITY"),
    checkin: String(params.checkin ?? ""),
    checkout: String(params.checkout ?? ""),
    adults: String(Math.max(1, params.adults)),
    rooms: String(Math.max(1, params.rooms ?? 1)),
    children: "0",
    rows_per_page: "100",
    offset: "0",
    language: "fr-fr",
    currency: "EUR",
  });

  const response = await fetch(`${STAYAPI_ENDPOINT}?${query.toString()}`, {
    method: "GET",
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const text = await response.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok || body?.success === false) {
    throw new Error(`StayAPI /v1/booking/search → ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  return pickHotels(body)
    .map(normalizeHotel)
    .filter((hotel): hotel is HotelOffer => Boolean(hotel));
}
