/**
 * Fournisseurs hôtels + activités.
 *
 * StayAPI est le provider hôtel principal. RapidAPI reste le fallback hôtel
 * et le provider des activités existant.
 */
import { reportServerError } from "@/lib/server-error-reporting.server";

export type ProviderConfig = {
  rapidApiKey: string;
  hotelsHost?: string;
  bookingHost?: string;
  hotelsComHost?: string;
  expediaHost?: string;
  kayakHost?: string;
  tripadvisorHost?: string;
  klookHost?: string;
};

export const DEFAULT_RAPIDAPI_HOSTS = {
  booking: "booking-com15.p.rapidapi.com",
  hotelsCom: "hotels-com6.p.rapidapi.com",
  expedia: "expedia13.p.rapidapi.com",
  tripadvisor: "tripadvisor16.p.rapidapi.com",
  kayakSearch: "kayak-search.p.rapidapi.com",
  kiwi: "kiwi-com-cheap-flights.p.rapidapi.com",
} as const;

export type PriceOffer = {
  provider: string;
  pricePerNight: number;
  currency: string;
  url: string | null;
  /** Canonical provider price metadata. Prices are for the complete search party. */
  rawAmount?: number;
  rawBasis?: "STAY_TOTAL" | "NIGHT_TOTAL";
  groupStayTotal?: number;
  perPersonStay?: number;
  perPersonPerNight?: number;
  unitsCount?: number;
  estimated?: boolean;
};

export type HotelOffer = {
  externalId: string;
  name: string;
  type: string;
  description: string | null;
  rating: number;
  distanceCenterKm: number;
  imageUrl: string | null;
  offers: PriceOffer[];
  capacity: number | null;
  unitsCount: number;
  accommodationClass: "HOTEL" | "ENTIRE_HOME" | "HOSTEL" | "OTHER";
};

export type ActivityOffer = {
  externalId: string;
  name: string;
  category: string;
  description: string | null;
  pricePerPerson: number;
  durationHours: number;
  rating: number;
  imageUrl: string | null;
  bookingUrl: string | null;
  provider: string;
};

export type SearchParams = {
  destination: string;
  latitude: number;
  longitude: number;
  checkin?: string | null;
  checkout?: string | null;
  adults: number;
  rooms?: number;
  requiredAmenities?: string[];
  roomTypePreferences?: string[];
};

async function rapid(host: string, key: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${host}${path} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return res.json() as Promise<any>;
}

async function stayApi(path: string, params: Record<string, string>) {
  const key = process.env.STAYAPI_API_KEY;
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stayapi.com${path}?${qs}`, {
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || body?.success === false) throw new Error(`StayAPI ${path} → ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

const num = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function pickArray(payload: any): any[] {
  const candidates = [
    payload?.data?.hotels,
    payload?.data?.result,
    payload?.data?.results,
    payload?.data?.propertySearchListings,
    payload?.data?.data,
    Array.isArray(payload?.data) ? payload.data : null,
    payload?.result,
    payload?.results,
    payload?.hotels,
    payload?.properties,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function extractPrice(raw: any): number {
  const candidates = [
    raw?.price?.amount,
    raw?.priceBreakdown?.grossPrice,
    raw?.price_breakdown?.gross_price,
    raw?.composite_price_breakdown?.gross_amount_per_night?.value,
    raw?.composite_price_breakdown?.gross_amount?.value,
    raw?.price?.lead?.amount,
    raw?.priceForDisplay,
    raw?.min_total_price,
    raw?.property?.priceInfo?.displayPrice,
    raw?.gross_price,
    raw?.minRate,
    raw?.price,
  ];
  for (const c of candidates) { const p = num(c); if (p > 0) return p; }
  return 0;
}

function normalizeHotel(raw: any, provider: string): HotelOffer | null {
  const externalId = String(raw?.id ?? raw?.hotel_id ?? raw?.property_id ?? raw?.hotelId ?? raw?.propertyId ?? "");
  const name = raw?.name ?? raw?.hotel_name ?? raw?.property?.name ?? raw?.title ?? raw?.headline?.text;
  const price = extractPrice(raw);
  if (!externalId || !name || price <= 0) return null;
  const distance = num(raw?.distanceFromCenter ?? raw?.distance_from_center ?? raw?.distance_to_cc ?? raw?.distance ?? 0);
  return {
    externalId: `${provider}:${externalId}`,
    name: String(name),
    type: String(raw?.accommodation_type_name ?? raw?.propertyType ?? raw?.accommodationType ?? "hotel").toLowerCase(),
    description: raw?.description ?? raw?.unit_configuration_label ?? raw?.room_name ?? null,
    rating: num(raw?.reviewScore ?? raw?.review_score ?? raw?.rating?.score ?? raw?.review?.score ?? raw?.bubbleRating?.rating ?? raw?.star_rating ?? raw?.starRating ?? 0),
    distanceCenterKm: distance,
    imageUrl: raw?.image_url ?? raw?.cardPhotos?.[0]?.sizes?.urlTemplate?.replace("{width}", "600").replace("{height}", "400") ?? raw?.photoUrls?.[0] ?? raw?.main_photo_url ?? raw?.propertyImage?.image?.url ?? raw?.photoUrl ?? null,
    offers: [{
      provider,
      pricePerNight: Math.round(price),
      currency: String(raw?.currency ?? raw?.currency_code ?? raw?.currencycode ?? "EUR"),
      url: raw?.url ?? raw?.commerceInfo?.externalUrl ?? raw?.deeplink ?? raw?.booking_url ?? null,
    }],
    capacity: null,
    unitsCount: 1,
    accommodationClass: /hostel|auberge/i.test(String(raw?.accommodation_type_name ?? raw?.propertyType ?? "")) ? "HOSTEL" : "HOTEL",
  };
}

async function resolveStayApiDestination(destination: string) {
  const payload = await stayApi("/v1/booking/destinations/lookup", { query: destination, language: "fr" });
  const candidates = pickArray(payload);
  const norm = destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = candidates.find((d: any) => String(d?.name ?? d?.label ?? d?.city_name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === norm);
  const city = candidates.find((d: any) => String(d?.type ?? d?.dest_type ?? "").toLowerCase() === "city");
  const d = exact ?? city ?? candidates[0];
  const id = d?.dest_id ?? d?.destination_id ?? d?.id;
  if (!id) throw new Error(`StayAPI: destination ID introuvable pour "${destination}"`);
  return { id: String(id), type: String(d?.dest_type ?? d?.type ?? "CITY").toUpperCase() };
}

async function searchHotelsStayApi(params: SearchParams): Promise<HotelOffer[]> {
  const destination = await resolveStayApiDestination(params.destination);
  const payload = await stayApi("/v1/booking/search", {
    dest_id: destination.id,
    dest_type: destination.type,
    ...(params.checkin ? { checkin: params.checkin } : {}),
    ...(params.checkout ? { checkout: params.checkout } : {}),
    adults: String(Math.max(1, params.adults)),
    rooms: String(Math.max(1, params.rooms ?? Math.ceil(params.adults / 2))),
    rows_per_page: "100",
    offset: "0",
    language: "fr-fr",
    currency: "EUR",
  });
  return pickArray(payload).map((h) => normalizeHotel(h, "stayapi/booking")).filter((h): h is HotelOffer => Boolean(h));
}

function rapidHotelSources(cfg: ProviderConfig) {
  const key = cfg.rapidApiKey;
  const bookingHost = cfg.bookingHost || DEFAULT_RAPIDAPI_HOSTS.booking;
  const hotelsComHost = cfg.hotelsComHost || cfg.hotelsHost || DEFAULT_RAPIDAPI_HOSTS.hotelsCom;
  const expediaHost = cfg.expediaHost || DEFAULT_RAPIDAPI_HOSTS.expedia;
  return [
    {
      provider: "booking.com",
      run: async (p: SearchParams) => {
        const destPayload = await rapid(bookingHost, key, "/api/v1/hotels/searchDestination", { query: p.destination });
        const list = Array.isArray(destPayload?.data) ? destPayload.data : Array.isArray(destPayload) ? destPayload : [];
        const norm = p.destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const dest = list.find((d: any) => (d.search_type === "city" || d.dest_type === "city") && String(d.city_name || d.name || d.label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(norm)) ?? list.find((d: any) => d.search_type === "city" || d.dest_type === "city");
        if (!dest?.dest_id) throw new Error(`Booking: destination introuvable pour ${p.destination}`);
        const payload = await rapid(bookingHost, key, "/api/v1/hotels/searchHotels", {
          dest_id: String(dest.dest_id), search_type: String(dest.search_type ?? dest.dest_type ?? "city"),
          adults: String(Math.min(Math.max(1, p.adults), 8)), room_qty: String(Math.max(1, p.rooms ?? Math.ceil(p.adults / 2))), currency_code: "EUR", languagecode: "fr",
          ...(p.checkin ? { arrival_date: p.checkin } : {}), ...(p.checkout ? { departure_date: p.checkout } : {}),
        });
        return pickArray(payload).map((h) => normalizeHotel(h?.property ? { ...h.property, ...h } : h, "booking.com")).filter((h): h is HotelOffer => Boolean(h));
      },
    },
    {
      provider: "hotels.com",
      run: async (p: SearchParams) => {
        const payload = await rapid(hotelsComHost, key, "/hotels/search", {
          query: p.destination, locale: "fr_FR", domain: "FR", adults_number: String(Math.min(Math.max(1, p.adults), 8)), sort_order: "PRICE_LOW_TO_HIGH",
          ...(p.checkin ? { checkin_date: p.checkin } : {}), ...(p.checkout ? { checkout_date: p.checkout } : {}),
        });
        return pickArray(payload).map((h) => normalizeHotel(h?.property ? { ...h.property, ...h } : h, "hotels.com")).filter((h): h is HotelOffer => Boolean(h));
      },
    },
    {
      provider: "expedia",
      run: async (p: SearchParams) => {
        const payload = await rapid(expediaHost, key, "/hotels/search", {
          query: p.destination, adults: String(Math.min(Math.max(1, p.adults), 8)), currency: "EUR", locale: "fr_FR",
          ...(p.checkin ? { checkin: p.checkin } : {}), ...(p.checkout ? { checkout: p.checkout } : {}),
        });
        return pickArray(payload).map((h) => normalizeHotel(h, "expedia")).filter((h): h is HotelOffer => Boolean(h));
      },
    },
  ];
}

export async function searchHotelsAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const errors: string[] = [];
  try {
    const stayHotels = await searchHotelsStayApi(params);
    if (stayHotels.length > 0) {
      const hotels = stayHotels.map((h) => ({ ...h, offers: h.offers.sort((a, b) => a.pricePerNight - b.pricePerNight) }));
      return { hotels, errors };
    }
    errors.push("StayAPI: aucun résultat");
  } catch (err) {
    const message = `StayAPI: ${String(err).slice(0, 300)}`;
    errors.push(message);
    reportServerError(err, { provider: "stayapi", kind: "hotels", destination: params.destination });
  }

  if (!cfg.rapidApiKey) {
    errors.push("RapidAPI: clé absente");
    return { hotels: [] as HotelOffer[], errors };
  }

  const results = await Promise.allSettled(rapidHotelSources(cfg).map((s) => s.run(params)));
  const hotels = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const provider = rapidHotelSources(cfg)[i]?.provider ?? "rapidapi";
    errors.push(`${provider}: ${String(r.reason).slice(0, 200)}`);
    return [];
  });

  if (hotels.length === 0) reportServerError(new Error(`Toutes les sources d'hôtels ont échoué: ${errors.join(" | ")}`), { provider: "rapidapi/hotels", kind: "hotels", destination: params.destination });

  const byName = new Map<string, HotelOffer>();
  for (const h of hotels) {
    const keyName = h.name.trim().toLowerCase();
    const existing = byName.get(keyName);
    if (!existing) byName.set(keyName, h);
    else existing.offers.push(...h.offers);
  }
  return { hotels: [...byName.values()].map((h) => ({ ...h, offers: h.offers.sort((a, b) => a.pricePerNight - b.pricePerNight) })), errors };
}

export async function searchActivitiesAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const key = cfg.rapidApiKey;
  const errors: string[] = [];
  const activities: ActivityOffer[] = [];
  if (!key) return { activities, errors: ["RapidAPI: clé absente"] };
  const host = cfg.tripadvisorHost || DEFAULT_RAPIDAPI_HOSTS.tripadvisor;
  try {
    const payload = await rapid(host, key, "/api/v1/attractions/searchAttractions", { latitude: String(params.latitude), longitude: String(params.longitude), currencyCode: "EUR", language: "fr" });
    const normalize = (raw: any): ActivityOffer | null => {
      const id = String(raw?.id ?? raw?.location_id ?? raw?.attraction_id ?? "");
      const name = raw?.name ?? raw?.title;
      if (!id || !name) return null;
      return {
        externalId: `${"tripadvisor"}:${id}`,
        name: String(name),
        category: String(raw?.category?.name ?? raw?.category ?? raw?.type ?? "activity"),
        description: raw?.description ?? raw?.descriptionText ?? null,
        pricePerPerson: num(raw?.price ?? raw?.priceFrom ?? raw?.price_info),
        durationHours: num(raw?.duration ?? raw?.length ?? 3) || 3,
        rating: num(raw?.rating ?? raw?.reviewScore ?? raw?.bubbleRating?.rating ?? 0),
        imageUrl: raw?.photo?.images?.large?.url ?? raw?.image ?? raw?.imageUrl ?? raw?.thumbnail ?? null,
        bookingUrl: raw?.web_url ?? raw?.url ?? raw?.webUrl ?? null,
        provider: "tripadvisor",
      };
    };
    activities.push(...pickArray(payload).map(normalize).filter((a): a is ActivityOffer => Boolean(a)));
  } catch (err) {
    errors.push(`tripadvisor: ${String(err).slice(0, 200)}`);
    reportServerError(err, { provider: "tripadvisor", kind: "activities", destination: params.destination });
  }
  return { activities, errors };
}
