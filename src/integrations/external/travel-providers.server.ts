/**
 * Fournisseurs de voyage externes (hôtels & activités).
 *
 * Tous les connecteurs passent par RapidAPI : une seule clé donne accès aux
 * APIs Hotels.com / Expedia, Booking.com, Kayak, TripAdvisor et Klook.
 * Chaque provider est optionnel : s'il n'est pas configuré (ou si l'abonnement
 * RapidAPI n'est pas actif), il est simplement ignoré et les autres sources
 * continuent d'alimenter le comparateur.
 *
 * Variables d'environnement (serveur uniquement) :
 *   HOTELS_RAPIDAPI_KEY  clé RapidAPI (utilisée par tous les hosts)
 *   HOTELS_RAPIDAPI_HOST  défaut hotels4.p.rapidapi.com          (Hotels.com / Expedia)
 *   BOOKING_RAPIDAPI_HOST défaut booking-com15.p.rapidapi.com    (Booking.com)
 *   KAYAK_RAPIDAPI_HOST   défaut kayak-hotel-search.p.rapidapi.com (Kayak)
 *   TRIPADVISOR_RAPIDAPI_HOST défaut tripadvisor16.p.rapidapi.com (TripAdvisor)
 *   KLOOK_RAPIDAPI_HOST   défaut klook-api.p.rapidapi.com         (Klook)
 */

export type ProviderConfig = {
  rapidApiKey: string;
  hotelsHost?: string | undefined;
  bookingHost?: string | undefined;
  kayakHost?: string | undefined;
  tripadvisorHost?: string | undefined;
  klookHost?: string | undefined;
};

export type PriceOffer = {
  provider: string;
  pricePerNight: number;
  currency: string;
  url: string | null;
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
};

async function rapid(host: string, key: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${host} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

const num = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function pickArray(payload: any): any[] {
  const candidates = [
    payload?.data?.propertySearchListings,
    payload?.data?.hotels,
    payload?.data?.result,
    payload?.data?.results,
    payload?.data?.data,
    payload?.properties,
    payload?.results,
    payload?.hotels,
    payload?.data,
  ];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}

/** Normalise un objet hôtel quelle que soit la source RapidAPI. */
function normalizeHotel(raw: any, provider: string): HotelOffer | null {
  const externalId = String(
    raw?.id ?? raw?.hotel_id ?? raw?.property_id ?? raw?.hotelId ?? raw?.propertyId ?? "",
  );
  const name =
    raw?.name ??
    raw?.hotel_name ??
    raw?.property?.name ??
    raw?.title ??
    raw?.headline?.text ??
    null;
  if (!externalId || !name) return null;

  const price = num(
    raw?.priceForDisplay ??
      raw?.price?.lead?.amount ??
      raw?.ratePlan?.price?.exactCurrent ??
      raw?.min_total_price ??
      raw?.composite_price_breakdown?.gross_amount_per_night?.value ??
      raw?.property?.priceInfo?.displayPrice ??
      raw?.price ??
      0,
  );
  if (price <= 0) return null;

  return {
    externalId: `${provider}:${externalId}`,
    name: String(name),
    type: String(raw?.accommodation_type_name ?? raw?.propertyType ?? "hotel").toLowerCase(),
    description: raw?.description ?? raw?.unit_configuration_label ?? null,
    rating: num(raw?.reviewScore ?? raw?.review_score ?? raw?.bubbleRating?.rating ?? raw?.starRating ?? 0),
    distanceCenterKm: num(raw?.distanceFromCenter ?? raw?.distance ?? 0),
    imageUrl:
      raw?.cardPhotos?.[0]?.sizes?.urlTemplate?.replace("{width}", "600").replace("{height}", "400") ??
      raw?.photoUrls?.[0] ??
      raw?.main_photo_url ??
      raw?.propertyImage?.image?.url ??
      null,
    offers: [
      {
        provider,
        pricePerNight: Math.round(price),
        currency: String(raw?.currency ?? raw?.currencycode ?? "EUR"),
        url: raw?.commerceInfo?.externalUrl ?? raw?.url ?? raw?.deeplink ?? null,
      },
    ],
  };
}

type HotelSource = { provider: string; run: (p: SearchParams) => Promise<HotelOffer[]> };

function hotelSources(cfg: ProviderConfig): HotelSource[] {
  const key = cfg.rapidApiKey;
  const sources: HotelSource[] = [];

  const hotelsHost = cfg.hotelsHost || "hotels4.p.rapidapi.com";
  sources.push({
    provider: "hotels.com",
    run: async (p) => {
      const payload = await rapid(hotelsHost, key, "/properties/list", {
        destination: p.destination,
        adults: String(p.adults),
        currency: "EUR",
        locale: "fr_FR",
        pageNumber: "1",
        pageSize: "25",
        ...(p.checkin ? { checkIn: p.checkin } : {}),
        ...(p.checkout ? { checkOut: p.checkout } : {}),
      });
      return pickArray(payload)
        .map((h) => normalizeHotel(h, "hotels.com"))
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  const bookingHost = cfg.bookingHost || "booking-com15.p.rapidapi.com";
  sources.push({
    provider: "booking.com",
    run: async (p) => {
      const payload = await rapid(bookingHost, key, "/api/v1/hotels/searchHotelsByCoordinates", {
        latitude: String(p.latitude),
        longitude: String(p.longitude),
        adults: String(p.adults),
        currency_code: "EUR",
        languagecode: "fr",
        ...(p.checkin ? { arrival_date: p.checkin } : {}),
        ...(p.checkout ? { departure_date: p.checkout } : {}),
      });
      return pickArray(payload)
        .map((h) => normalizeHotel(h?.property ? { ...h, ...h.property } : h, "booking.com"))
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  const kayakHost = cfg.kayakHost || "kayak-hotel-search.p.rapidapi.com";
  sources.push({
    provider: "kayak",
    run: async (p) => {
      const payload = await rapid(kayakHost, key, "/hotels/search", {
        location: p.destination,
        adults: String(p.adults),
        currency: "EUR",
        ...(p.checkin ? { checkin: p.checkin } : {}),
        ...(p.checkout ? { checkout: p.checkout } : {}),
      });
      return pickArray(payload)
        .map((h) => normalizeHotel(h, "kayak"))
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  const tripadvisorHost = cfg.tripadvisorHost || "tripadvisor16.p.rapidapi.com";
  sources.push({
    provider: "expedia/tripadvisor",
    run: async (p) => {
      const payload = await rapid(tripadvisorHost, key, "/api/v1/hotels/searchHotelsByLocation", {
        latitude: String(p.latitude),
        longitude: String(p.longitude),
        adults: String(p.adults),
        currencyCode: "EUR",
        ...(p.checkin ? { checkIn: p.checkin } : {}),
        ...(p.checkout ? { checkOut: p.checkout } : {}),
      });
      return pickArray(payload)
        .map((h) => normalizeHotel(h, "expedia/tripadvisor"))
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  return sources;
}

/** Fusionne les hôtels des différentes sources et compare les prix par nom d'établissement. */
export async function searchHotelsAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const results = await Promise.allSettled(hotelSources(cfg).map((s) => s.run(params)));
  const errors: string[] = [];
  const merged = new Map<string, HotelOffer>();

  results.forEach((r, i) => {
    const provider = hotelSources(cfg)[i]?.provider ?? "inconnu";
    if (r.status === "rejected") {
      errors.push(`${provider}: ${String(r.reason).slice(0, 200)}`);
      return;
    }
    for (const hotel of r.value) {
      const dedupeKey = hotel.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const existing = merged.get(dedupeKey);
      if (!existing) {
        merged.set(dedupeKey, hotel);
        continue;
      }
      existing.offers.push(...hotel.offers);
      existing.imageUrl = existing.imageUrl ?? hotel.imageUrl;
      existing.description = existing.description ?? hotel.description;
      existing.rating = Math.max(existing.rating, hotel.rating);
    }
  });

  const hotels = [...merged.values()].map((h) => ({
    ...h,
    offers: h.offers.sort((a, b) => a.pricePerNight - b.pricePerNight),
  }));
  return { hotels, errors };
}

/** Activités : Klook puis TripAdvisor en repli. */
export async function searchActivitiesAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const key = cfg.rapidApiKey;
  const errors: string[] = [];
  const activities: ActivityOffer[] = [];

  const normalize = (raw: any, provider: string): ActivityOffer | null => {
    const externalId = String(raw?.id ?? raw?.activity_id ?? raw?.location_id ?? raw?.productCode ?? "");
    const name = raw?.name ?? raw?.title ?? raw?.activity_name ?? null;
    if (!externalId || !name) return null;
    return {
      externalId: `${provider}:${externalId}`,
      name: String(name),
      category: guessCategory(String(name) + " " + String(raw?.subcategory?.[0]?.name ?? raw?.category ?? "")),
      description: raw?.description ?? raw?.shortDescription ?? null,
      pricePerPerson: Math.round(num(raw?.price?.amount ?? raw?.sellingPrice ?? raw?.fromPrice ?? raw?.price ?? 0)),
      durationHours: num(raw?.duration ?? 3) || 3,
      rating: num(raw?.rating ?? raw?.reviewScore ?? 0),
      imageUrl: raw?.image ?? raw?.photo?.images?.large?.url ?? raw?.imageUrl ?? null,
      bookingUrl: raw?.web_url ?? raw?.url ?? raw?.deeplink ?? null,
      provider,
    };
  };

  const klookHost = cfg.klookHost || "klook-api.p.rapidapi.com";
  try {
    const payload = await rapid(klookHost, key, "/search", {
      query: params.destination,
      currency: "EUR",
      language: "fr",
    });
    activities.push(
      ...pickArray(payload)
        .map((a) => normalize(a, "klook"))
        .filter((a): a is ActivityOffer => Boolean(a)),
    );
  } catch (err) {
    errors.push(`klook: ${String(err).slice(0, 200)}`);
  }

  const tripadvisorHost = cfg.tripadvisorHost || "tripadvisor16.p.rapidapi.com";
  try {
    const payload = await rapid(tripadvisorHost, key, "/api/v1/attractions/searchAttractions", {
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      currencyCode: "EUR",
      language: "fr",
    });
    activities.push(
      ...pickArray(payload)
        .map((a) => normalize(a, "tripadvisor"))
        .filter((a): a is ActivityOffer => Boolean(a)),
    );
  } catch (err) {
    errors.push(`tripadvisor: ${String(err).slice(0, 200)}`);
  }

  return { activities, errors };
}

/** Déduit une catégorie Krew à partir du libellé fourni par le provider. */
export function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(bar|club|night|soir|party|pub)/.test(t)) return "soirees";
  if (/(spa|massage|wellness|détente|detente|hammam|thermal)/.test(t)) return "bien_etre";
  if (/(surf|kayak|quad|karting|jet|rafting|paintball|escalade|sport|bike|vélo|velo)/.test(t)) return "sports";
  if (/(museum|musée|musee|histor|monument|tour|visite|walking)/.test(t)) return "culture";
  if (/(food|gastro|tapas|wine|vin|cuisine|dégustation|degustation|restaurant)/.test(t)) return "gastronomie";
  if (/(boat|bateau|plage|beach|catamaran|croisière|croisiere)/.test(t)) return "nautique";
  return "insolite";
}