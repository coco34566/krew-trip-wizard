import type { HotelOffer, SearchParams } from "./travel-providers.server";

const STAYAPI_SEARCH_ENDPOINT = "https://api.stayapi.com/v1/booking/search";
const STAYAPI_LOOKUP_ENDPOINT = "https://api.stayapi.com/v1/booking/destinations/lookup";

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
  const key = process.env.STAYAPI_API_KEY;
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");

  const query = new URLSearchParams({ query: destination, language: "fr" });
  const response = await fetch(`${STAYAPI_LOOKUP_ENDPOINT}?${query.toString()}`, {
    method: "GET",
    headers: { "x-api-key": key, Accept: "application/json" },
  });

  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok || body?.success === false) {
    throw new Error(`StayAPI /v1/booking/destinations/lookup → ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  const candidates = pickArray(body);
  if (!candidates.length) throw new Error(`StayAPI: aucun dest_id trouvé pour la destination "${destination}"`);

  const normDest = destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = candidates.find((d: any) => {
    const label = String(d?.name ?? d?.label ?? d?.city_name ?? d?.dest_name ?? d?.title ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return label === normDest;
  });
  const city = candidates.find((d: any) => String(d?.dest_type ?? d?.type ?? d?.search_type ?? "").trim().toUpperCase() === "CITY");
  const selected = exact ?? city ?? candidates[0];
  const id = selected?.dest_id ?? selected?.destination_id ?? selected?.id;
  if (!id) throw new Error(`StayAPI: dest_id introuvable pour "${destination}" dans la réponse lookup`);
  const type = String(selected?.dest_type ?? selected?.type ?? "CITY").trim().toUpperCase() || "CITY";
  return { id: String(id), type };
}

function normalizeHotel(raw: any): HotelOffer | null {
  const id = String(raw?.hotel_id ?? raw?.hotelId ?? raw?.property_id ?? raw?.id ?? "");
  const name = raw?.hotel_name ?? raw?.name ?? raw?.property?.name ?? raw?.title;
  const amount = num(
    raw?.price?.amount ??
      raw?.min_total_price ??
      raw?.composite_price_breakdown?.gross_amount_per_night?.value ??
      raw?.composite_price_breakdown?.gross_amount?.value ??
      raw?.priceBreakdown?.grossPrice ??
      raw?.price ??
      raw?.pricePerNight,
  );
  if (!id || !name || amount <= 0) return null;

  return {
    externalId: `stayapi/booking:${id}`,
    name: String(name),
    type: String(raw?.accommodation_type_name ?? raw?.propertyType ?? raw?.type ?? "hotel").toLowerCase(),
    description: raw?.room_name ?? raw?.unit_configuration_label ?? raw?.description ?? null,
    rating: num(raw?.rating?.score ?? raw?.review_score ?? raw?.reviewScore ?? raw?.star_rating ?? 0),
    distanceCenterKm: num(raw?.distance_from_center ?? raw?.distance ?? 0),
    imageUrl: raw?.image_url ?? raw?.imageUrl ?? raw?.photoUrls?.[0] ?? raw?.main_photo_url ?? null,
    offers: [{
      provider: "stayapi/booking",
      pricePerNight: Math.round(amount),
      currency: String(raw?.price?.currency ?? raw?.currency_code ?? "EUR"),
      url: raw?.url ?? raw?.booking_url ?? raw?.deeplink ?? null,
    }],
  };
}

export async function searchHotelsStayApi(params: SearchParams & { destId?: string; destType?: string }): Promise<HotelOffer[]> {
  const key = process.env.STAYAPI_API_KEY;
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");

  let destId = params.destId;
  let destType = params.destType;
  if (!destId) {
    const resolved = await resolveStayApiDestination(params.destination);
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

  const hotels = pickArray(body).map(normalizeHotel).filter((hotel): hotel is HotelOffer => Boolean(hotel));
  if (!hotels.length) throw new Error(`StayAPI: aucun hôtel trouvé pour dest_id "${destId}" (${params.destination})`);
  return hotels;
}
