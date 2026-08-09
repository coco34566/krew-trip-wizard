/**
 * Fournisseurs hôtels + activités via RapidAPI.
 *
 * Hosts par défaut = APIs souscrites côté Krew :
 * - booking-com15.p.rapidapi.com
 * - hotels-com6.p.rapidapi.com
 * - expedia13.p.rapidapi.com
 * - tripadvisor16.p.rapidapi.com
 *
 * Une seule clé : HOTELS_RAPIDAPI_KEY (RapidAPI Application Key).
 */

import { reportServerError } from "@/lib/server-error-reporting.server";

export type ProviderConfig = {
  rapidApiKey: string;
  hotelsHost?: string | undefined;
  bookingHost?: string | undefined;
  hotelsComHost?: string | undefined;
  expediaHost?: string | undefined;
  kayakHost?: string | undefined;
  tripadvisorHost?: string | undefined;
  klookHost?: string | undefined;
};

/** Hosts par défaut (surchargeables via env Lovable). */
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
  rooms?: number;
  requiredAmenities?: string[];
  roomTypePreferences?: string[];
};

async function rapid(host: string, key: string, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`${host}${path} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
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
    payload?.data,
    payload?.result,
    payload?.results,
    payload?.hotels,
    payload?.properties,
  ];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  return [];
}

function extractPrice(raw: any): number {
  const candidates = [
    raw?.priceBreakdown?.grossPrice,
    raw?.price_breakdown?.gross_price,
    raw?.composite_price_breakdown?.gross_amount_per_night?.value,
    raw?.composite_price_breakdown?.gross_amount?.value,
    raw?.price?.lead?.amount,
    raw?.priceForDisplay,
    raw?.min_total_price,
    raw?.property?.priceInfo?.displayPrice,
    raw?.price,
    raw?.gross_price,
    raw?.minRate,
  ];
  for (const c of candidates) {
    const p = num(c);
    if (p > 0) return p;
  }
  return 0;
}

function normalizeHotel(raw: any, provider: string): HotelOffer | null {
  const externalId = String(
    raw?.id ?? raw?.hotel_id ?? raw?.property_id ?? raw?.hotelId ?? raw?.propertyId ?? raw?.dest_id ?? "",
  );
  const name =
    raw?.name ?? raw?.hotel_name ?? raw?.property?.name ?? raw?.title ?? raw?.headline?.text ?? null;
  if (!externalId || !name) return null;

  const price = extractPrice(raw);
  if (price <= 0) return null;

  return {
    externalId: `${provider}:${externalId}`,
    name: String(name),
    type: String(
      raw?.accommodation_type_name ?? raw?.propertyType ?? raw?.accommodationType ?? "hotel",
    ).toLowerCase(),
    description: raw?.description ?? raw?.unit_configuration_label ?? null,
    rating: num(
      raw?.reviewScore ??
        raw?.review_score ??
        raw?.review?.score ??
        raw?.bubbleRating?.rating ??
        raw?.starRating ??
        0,
    ),
    distanceCenterKm: num(
      raw?.distanceFromCenter ?? raw?.distance_to_cc ?? raw?.distance ?? raw?.accessibilityLabel ?? 0,
    ),
    imageUrl:
      raw?.cardPhotos?.[0]?.sizes?.urlTemplate?.replace("{width}", "600").replace("{height}", "400") ??
      raw?.photoUrls?.[0] ??
      raw?.main_photo_url ??
      raw?.propertyImage?.image?.url ??
      raw?.photoUrl ??
      null,
    offers: [
      {
        provider,
        pricePerNight: Math.round(price),
        currency: String(raw?.currency ?? raw?.currencycode ?? raw?.currency_code ?? "EUR"),
        url: raw?.commerceInfo?.externalUrl ?? raw?.url ?? raw?.deeplink ?? raw?.booking_url ?? null,
      },
    ],
  };
}

type HotelSource = { provider: string; run: (p: SearchParams) => Promise<HotelOffer[]> };

function hotelSources(cfg: ProviderConfig): HotelSource[] {
  const key = cfg.rapidApiKey;
  const sources: HotelSource[] = [];

  const bookingHost = cfg.bookingHost || DEFAULT_RAPIDAPI_HOSTS.booking;
  const hotelsComHost = cfg.hotelsComHost || cfg.hotelsHost || DEFAULT_RAPIDAPI_HOSTS.hotelsCom;
  const expediaHost = cfg.expediaHost || DEFAULT_RAPIDAPI_HOSTS.expedia;

  // ——— Booking.com (principal) ———
  sources.push({
    provider: "booking.com",
    run: async (p) => {
      const destPayload = await rapid(bookingHost, key, "/api/v1/hotels/searchDestination", {
        query: p.destination,
      });
      const destList = Array.isArray(destPayload?.data)
        ? destPayload.data
        : Array.isArray(destPayload)
          ? destPayload
          : [];
      const dest =
        destList.find((d: any) => d.search_type === "city" || d.dest_type === "city") ?? destList[0];
      if (!dest?.dest_id) {
        throw new Error(`Booking: dest_id introuvable pour "${p.destination}"`);
      }

      const rooms = String(Math.max(1, p.rooms ?? Math.ceil(p.adults / 2)));
      const payload = await rapid(bookingHost, key, "/api/v1/hotels/searchHotels", {
        dest_id: String(dest.dest_id),
        search_type: String(dest.search_type ?? dest.dest_type ?? "city"),
        adults: String(Math.min(Math.max(1, p.adults), 8)),
        room_qty: rooms,
        currency_code: "EUR",
        languagecode: "fr",
        ...(p.checkin ? { arrival_date: p.checkin } : {}),
        ...(p.checkout ? { departure_date: p.checkout } : {}),
        ...(p.requiredAmenities?.length
          ? { categories_filter_ids: p.requiredAmenities.filter(x => x !== "peu_importe").join(",") }
          : {}),
      });

      return pickArray(payload)
        .map((h) => {
          const raw = h?.property
            ? { ...h.property, ...h, price: extractPrice(h) || extractPrice(h.property) }
            : h;
          return normalizeHotel(raw, "booking.com");
        })
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  // Booking secours : par coordonnées
  sources.push({
    provider: "booking.com-geo",
    run: async (p) => {
      const payload = await rapid(bookingHost, key, "/api/v1/hotels/searchHotelsByCoordinates", {
        latitude: String(p.latitude),
        longitude: String(p.longitude),
        adults: String(Math.min(Math.max(1, p.adults), 8)),
        room_qty: String(Math.max(1, p.rooms ?? Math.ceil(p.adults / 2))),
        currency_code: "EUR",
        languagecode: "fr",
        ...(p.checkin ? { arrival_date: p.checkin } : {}),
        ...(p.checkout ? { departure_date: p.checkout } : {}),
      });
      return pickArray(payload)
        .map((h) => {
          const raw = h?.property ? { ...h.property, ...h } : h;
          return normalizeHotel(raw, "booking.com");
        })
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  // ——— Hotels.com ———
  sources.push({
    provider: "hotels.com",
    run: async (p) => {
      // 1) résolution région / destination
      const locPayload = await rapid(hotelsComHost, key, "/hotels/search", {
        query: p.destination,
        locale: "fr_FR",
        ...(p.checkin ? { checkin_date: p.checkin } : {}),
        ...(p.checkout ? { checkout_date: p.checkout } : {}),
        adults_number: String(Math.min(Math.max(1, p.adults), 8)),
        domain: "FR",
        sort_order: "PRICE_LOW_TO_HIGH",
      }).catch(async () => {
        // Variante locations puis search
        const regions = await rapid(hotelsComHost, key, "/regions", {
          query: p.destination,
          locale: "fr_FR",
          domain: "FR",
        });
        const regionId =
          regions?.data?.[0]?.gaiaId ??
          regions?.data?.[0]?.id ??
          regions?.data?.[0]?.value ??
          regions?.suggestions?.[0]?.entities?.[0]?.destinationId;
        if (!regionId) throw new Error(`Hotels.com: région introuvable pour "${p.destination}"`);
        return rapid(hotelsComHost, key, "/hotels/search", {
          region_id: String(regionId),
          locale: "fr_FR",
          domain: "FR",
          adults_number: String(Math.min(Math.max(1, p.adults), 8)),
          sort_order: "PRICE_LOW_TO_HIGH",
          ...(p.checkin ? { checkin_date: p.checkin } : {}),
          ...(p.checkout ? { checkout_date: p.checkout } : {}),
        });
      });

      return pickArray(locPayload)
        .map((h) => normalizeHotel(h?.property ? { ...h.property, ...h } : h, "hotels.com"))
        .filter((h): h is HotelOffer => Boolean(h));
    },
  });

  // ——— Expedia ———
  sources.push({
    provider: "expedia",
    run: async (p) => {
      // Essais de paths courants sur expedia13 RapidAPI
      const attempts: Array<() => Promise<any>> = [
        () =>
          rapid(expediaHost, key, "/hotels/search", {
            query: p.destination,
            adults: String(Math.min(Math.max(1, p.adults), 8)),
            currency: "EUR",
            locale: "fr_FR",
            ...(p.checkin ? { checkin: p.checkin } : {}),
            ...(p.checkout ? { checkout: p.checkout } : {}),
          }),
        () =>
          rapid(expediaHost, key, "/api/v1/hotels/search", {
            destination: p.destination,
            adults: String(Math.min(Math.max(1, p.adults), 8)),
            currency: "EUR",
            ...(p.checkin ? { checkIn: p.checkin } : {}),
            ...(p.checkout ? { checkOut: p.checkout } : {}),
          }),
        () =>
          rapid(expediaHost, key, "/search_hotels", {
            destination: p.destination,
            adults: String(Math.min(Math.max(1, p.adults), 8)),
            ...(p.checkin ? { start_date: p.checkin } : {}),
            ...(p.checkout ? { end_date: p.checkout } : {}),
          }),
      ];

      let lastErr: unknown;
      for (const attempt of attempts) {
        try {
          const payload = await attempt();
          const hotels = pickArray(payload)
            .map((h) => normalizeHotel(h, "expedia"))
            .filter((h): h is HotelOffer => Boolean(h));
          if (hotels.length) return hotels;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error(`Expedia: aucun résultat pour "${p.destination}"`);
    },
  });

  return sources;
}

/** Fusionne les hôtels des sources et compare les prix par nom. */
export async function searchHotelsAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const sources = hotelSources(cfg);
  const results = await Promise.allSettled(sources.map((s) => s.run(params)));
  const errors: string[] = [];
  const merged = new Map<string, HotelOffer>();

  results.forEach((r, i) => {
    const provider = sources[i]?.provider ?? "inconnu";
    if (r.status === "rejected") {
      errors.push(`${provider}: ${String(r.reason).slice(0, 250)}`);
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

  if (hotels.length === 0 && errors.length > 0) {
    reportServerError(new Error(`Toutes les sources d'hôtels ont échoué ou n'ont renvoyé aucun résultat: ${errors.join(" | ")}`), {
      provider: "rapidapi/hotels",
      kind: "hotels",
      destination: params.destination,
    });
  }

  return { hotels, errors };
}

/** Activités via TripAdvisor uniquement. */
export async function searchActivitiesAllProviders(cfg: ProviderConfig, params: SearchParams) {
  const key = cfg.rapidApiKey;
  const errors: string[] = [];
  const activities: ActivityOffer[] = [];

  if (!key) {
    return { activities, errors: ["Aucune clé RapidAPI pour les activités"] };
  }

  const normalize = (raw: any, provider: string): ActivityOffer | null => {
    const externalId = String(raw?.id ?? raw?.location_id ?? raw?.locationId ?? raw?.productCode ?? "");
    const name = raw?.name ?? raw?.title ?? raw?.activity_name ?? null;
    if (!externalId || !name) return null;
    const price = Math.round(
      num(raw?.price?.amount ?? raw?.fromPrice ?? raw?.offerGroup?.lowestPrice ?? raw?.price ?? 0),
    );
    return {
      externalId: `${provider}:${externalId}`,
      name: String(name),
      category: guessCategory(
        String(name) + " " + String(raw?.category?.name ?? raw?.subcategory?.[0]?.name ?? ""),
      ),
      description: raw?.description ?? raw?.shortDescription ?? null,
      pricePerPerson: price > 0 ? price : 0,
      durationHours: num(raw?.duration ?? raw?.length ?? 3) || 3,
      rating: num(raw?.rating ?? raw?.reviewScore ?? raw?.bubbleRating?.rating ?? 0),
      imageUrl:
        raw?.photo?.images?.large?.url ?? raw?.image ?? raw?.imageUrl ?? raw?.thumbnail ?? null,
      bookingUrl: raw?.web_url ?? raw?.url ?? raw?.webUrl ?? null,
      provider,
    };
  };

  const tripadvisorHost = cfg.tripadvisorHost || DEFAULT_RAPIDAPI_HOSTS.tripadvisor;
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
    reportServerError(err, {
      provider: "tripadvisor",
      kind: "activities",
      destination: params.destination,
    });
  }

  return { activities, errors };
}

/** Déduit une catégorie Krew à partir du libellé fourni par le provider. */
export function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/(bar|club|night|soir|party|pub)/.test(t)) return "soirees";
  if (/(spa|massage|wellness|détente|detente|hammam|thermal)/.test(t)) return "bien_etre";
  if (/(surf|kayak|quad|karting|jet|rafting|paintball|escalade|sport|bike|vélo|velo)/.test(t))
    return "sports";
  if (/(museum|musée|musee|histor|monument|tour|visite|walking)/.test(t)) return "culture";
  if (/(food|gastro|tapas|wine|vin|cuisine|dégustation|degustation|restaurant)/.test(t))
    return "gastronomie";
  if (/(boat|bateau|plage|beach|catamaran|croisière|croisiere)/.test(t)) return "nautique";
  return "insolite";
}