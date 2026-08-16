import type { HotelOffer, SearchParams } from "./travel-providers.server";
import { lookupStayApiDestination } from "./stayapi-destination.server";

const STAYAPI_SEARCH_ENDPOINT = "https://api.stayapi.com/v1/booking/search";

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickArray(payload: any): any[] {
  const candidates = [
    payload?.data?.hotels,
    payload?.data?.results,
    payload?.data?.result,
    payload?.data?.destinations,
    payload?.data?.locations,
    payload?.data?.data,
    Array.isArray(payload?.data) ? payload.data : null,
    payload?.hotels,
    payload?.results,
    payload?.destinations,
    Array.isArray(payload) ? payload : null,
  ];
  return candidates.find(Array.isArray) ?? [];
}

export async function resolveStayApiDestination(destination: string): Promise<{ id: string; type: string }> {
  return lookupStayApiDestination(destination, "fr");
}

function classifyAccommodation(raw: any): HotelOffer["accommodationClass"] {
  const value = [raw?.accommodation_type_name, raw?.propertyType, raw?.type, raw?.unit_configuration_label, raw?.room_name, raw?.description]
    .filter(Boolean).join(" ").toLowerCase();
  if (/entire\s+(villa|apartment|home|house|chalet)|holiday\s+home|vacation\s+home|maison\s+enti[eè]re|appartement\s+entier|villa\s+enti[eè]re/.test(value)) return "ENTIRE_HOME";
  if (/hostel|auberge|guesthouse|guest house/.test(value)) return "HOSTEL";
  if (/hotel|hôtel|aparthotel|room|chambre/.test(value)) return "HOTEL";
  return "OTHER";
}

function positiveInt(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Math.floor(num(value));
    if (parsed > 0) return parsed;
  }
  return null;
}

function normalizeHotel(raw: any, params: SearchParams): HotelOffer | null {
  const id = String(raw?.hotel_id ?? raw?.hotelId ?? raw?.property_id ?? raw?.id ?? "");
  const name = raw?.hotel_name ?? raw?.name ?? raw?.property?.name ?? raw?.title;
  const stayTotal = num(raw?.min_total_price ?? raw?.composite_price_breakdown?.gross_amount?.value ?? raw?.priceBreakdown?.grossPrice);
  const nightlyTotal = num(raw?.composite_price_breakdown?.gross_amount_per_night?.value ?? raw?.pricePerNight);
  const genericAmount = num(raw?.price?.amount ?? raw?.price);
  const amount = stayTotal || nightlyTotal || genericAmount;
  if (!id || !name || amount <= 0) return null;

  const nights = Math.max(1, params.checkin && params.checkout
    ? Math.round((new Date(`${params.checkout}T12:00:00Z`).getTime() - new Date(`${params.checkin}T12:00:00Z`).getTime()) / 86400000)
    : 1);
  const rawBasis = stayTotal > 0 ? "STAY_TOTAL" as const : "NIGHT_TOTAL" as const;
  const groupStayTotal = rawBasis === "STAY_TOTAL" ? amount : amount * nights;
  const unitsCount = Math.max(1, params.rooms ?? 1);
  const capacity = positiveInt(raw?.max_occupancy, raw?.max_adults, raw?.capacity, raw?.room?.max_occupancy);
  const accommodationClass = classifyAccommodation(raw);
  const rawType = String(raw?.accommodation_type_name ?? raw?.propertyType ?? raw?.type ?? "other").toLowerCase();
  const canonicalType = accommodationClass === "ENTIRE_HOME" ? "entire_home" : accommodationClass === "HOTEL" ? "hotel" : rawType;
  return {
    externalId: `stayapi/booking:${id}`,
    name: String(name),
    type: canonicalType,
    description: [raw?.unit_configuration_label, raw?.room_name, raw?.description].filter(Boolean).join(" · ") || null,
    rating: num(raw?.rating?.score ?? raw?.review_score ?? raw?.reviewScore ?? raw?.star_rating ?? 0),
    distanceCenterKm: num(raw?.distance_from_center ?? raw?.distance ?? 0),
    imageUrl: raw?.image_url ?? raw?.imageUrl ?? raw?.photoUrls?.[0] ?? raw?.main_photo_url ?? null,
    offers: [{
      provider: "stayapi/booking",
      pricePerNight: Math.round(groupStayTotal / nights),
      currency: String(raw?.price?.currency ?? raw?.currency_code ?? "EUR"),
      url: raw?.url ?? raw?.booking_url ?? raw?.deeplink ?? null,
      rawAmount: amount,
      rawBasis,
      groupStayTotal: Math.round(groupStayTotal),
      perPersonStay: Math.round(groupStayTotal / Math.max(1, params.adults)),
      perPersonPerNight: Math.round(groupStayTotal / Math.max(1, params.adults) / nights),
      unitsCount,
      estimated: genericAmount > 0 && stayTotal <= 0 && nightlyTotal <= 0,
    }],
    capacity,
    unitsCount,
    accommodationClass,
  };
}

export async function searchHotelsStayApi(params: SearchParams & { destId?: string; destType?: string }): Promise<HotelOffer[]> {
  const key = process.env["STAYAPI_API_KEY"];
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");

  let destId = params.destId;
  let destType = params.destType;
  if (!destId) {
    const resolved = await lookupStayApiDestination(params.destination, "fr");
    destId = resolved.id;
    destType = resolved.type;
  }
  if (!destId) throw new Error(`StayAPI: dest_id manquant pour la destination "${params.destination}"`);

  const query = new URLSearchParams({
    dest_id: String(destId),
    dest_type: String(destType ?? "CITY"),
    adults: String(Math.max(1, params.adults)),
    rooms: String(Math.max(1, params.rooms ?? 1)),
    children: "0",
    rows_per_page: "100",
    offset: "0",
    language: "fr-fr",
    currency: "EUR",
  });
  if (params.checkin) query.set("checkin", String(params.checkin));
  if (params.checkout) query.set("checkout", String(params.checkout));

  const response = await fetch(`${STAYAPI_SEARCH_ENDPOINT}?${query.toString()}`, {
    method: "GET",
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok || body?.success === false) {
    throw new Error(`StayAPI /v1/booking/search → ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  const hotels = pickArray(body).map((hotel) => normalizeHotel(hotel, params)).filter((hotel): hotel is HotelOffer => Boolean(hotel));
  if (!hotels.length) throw new Error(`StayAPI: aucun hôtel trouvé pour dest_id "${destId}" (${params.destination})`);
  return hotels;
}
