/* eslint-disable @typescript-eslint/no-explicit-any -- external API payloads are normalized at boundary */
import { reportServerError } from "@/lib/server-error-reporting.server";

export type GeoapifyPlace = {
  id: string;
  name: string;
  category: string;
  categories: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  website: string | null;
  openingHours?: string | null;
  openingStatus?: "open" | "closed" | "unknown";
  wheelchair?: boolean | null;
  source: "geoapify";
  verified: boolean;
};

export type GeoapifySearchOptions = {
  categories: string[];
  longitude: number;
  latitude: number;
  radiusMeters?: number;
  limit?: number;
  conditions?: string[];
};

export type PlaceRequirements = {
  canonicalFamily: string;
  categories: string[];
  subtype?: string | null;
  dietary?: string[] | null;
  accessibility?: string[] | null;
  experienceTags?: string[];
};

const placeDetailsCache = new Map<string, any>();

export function mapVenueFamilyToGeoapifyCategories(family?: string, type?: string): string[] {
  const norm = String(family || type || "").toLowerCase().trim();
  if (norm.includes("cafe") || norm.includes("brunch") || norm.includes("petit-dejeuner") || norm.includes("petit-déjeuner")) {
    return ["catering.cafe", "catering.restaurant"];
  }
  if (
    norm.includes("restaurant") ||
    norm.includes("diner") ||
    norm.includes("dîner") ||
    norm.includes("dejeuner") ||
    norm.includes("déjeuner") ||
    norm.includes("gastro") ||
    norm === "resto"
  ) {
    return ["catering.restaurant"];
  }
  if (norm.includes("bar") || norm.includes("apero") || norm.includes("pub") || norm.includes("nightlife") || norm.includes("club") || norm.includes("soiree") || norm.includes("fete")) {
    return ["catering.bar", "catering.pub"];
  }
  if (norm.includes("sport") || norm.includes("outdoor") || norm.includes("nature") || norm.includes("rando") || norm.includes("velo")) {
    return ["sport", "entertainment.activity_park", "tourism.attraction"];
  }
  if (norm.includes("culture") || norm.includes("visite") || norm.includes("musee") || norm.includes("monument") || norm.includes("patrimoine")) {
    return ["tourism.sights", "tourism.attraction", "entertainment.museum", "entertainment.culture"];
  }
  if (norm.includes("relax") || norm.includes("spa") || norm.includes("bien_etre") || norm.includes("relaxation") || norm.includes("spa_wellness")) {
    return ["leisure.spa", "service.beauty.spa", "service.beauty.massage"];
  }
  if (norm.includes("shopping") || norm.includes("boutique") || norm.includes("marché") || norm.includes("market")) {
    return ["commercial.shopping_mall", "commercial.marketplace", "commercial.clothing"];
  }
  return ["catering.restaurant", "tourism.attraction", "entertainment"];
}

export function convertIntentToPlaceRequirements(
  family: string,
  momentType: string,
  searchIntent?: string,
  dietaryConstraints: string[] = [],
  accessibilityRequired = false,
  userNotes: string[] = [],
): PlaceRequirements {
  const normIntent = String(searchIntent || "").toLowerCase();
  const categories = mapVenueFamilyToGeoapifyCategories(family, momentType);
  let subtype: string | null = null;

  if (normIntent.includes("winery") || normIntent.includes("dégustation") || normIntent.includes("cave") || normIntent.includes("vin")) {
    subtype = "production.winery";
  } else if (normIntent.includes("market") || normIntent.includes("marché")) {
    subtype = "commercial.marketplace";
  } else if (normIntent.includes("cafe") || normIntent.includes("brunch") || normIntent.includes("petit-déjeuner")) {
    subtype = "catering.cafe";
  } else if (normIntent.includes("restaurant") || normIntent.includes("dîner") || normIntent.includes("déjeuner")) {
    subtype = "catering.restaurant";
  } else if (normIntent.includes("bar") || normIntent.includes("pub")) {
    subtype = "catering.bar";
  } else if (normIntent.includes("spa") || normIntent.includes("massage")) {
    subtype = "leisure.spa";
  }

  const effectiveCategories = subtype ? Array.from(new Set([subtype, ...categories])) : categories;
  const dietary = dietaryConstraints.length > 0 ? dietaryConstraints : null;
  const accessibility = mapAccessibilityToGeoapifyConditions(accessibilityRequired, userNotes);

  return {
    canonicalFamily: family,
    categories: effectiveCategories,
    subtype,
    dietary,
    accessibility: accessibility.length ? accessibility : null,
  };
}

export function buildPoolKey(req: PlaceRequirements): string {
  const parts = [
    req.canonicalFamily,
    ...req.categories.slice().sort(),
    req.subtype || "",
    (req.dietary || []).slice().sort().join(","),
    (req.accessibility || []).slice().sort().join(","),
  ];
  return parts.filter(Boolean).join("::");
}

export function mapAccessibilityToGeoapifyConditions(accessibilityRequired?: boolean, userNotes?: string[]): string[] {
  const text = String(userNotes?.join(" ") || "").toLowerCase();
  if (accessibilityRequired || text.includes("pmr") || text.includes("fauteuil") || text.includes("wheelchair")) {
    return ["wheelchair"];
  }
  return [];
}

export function determineSearchRadiusMeters(mobility?: string | null, profile?: string | null): number {
  if (!mobility) {
    return 10000;
  }

  const m = String(mobility).toLowerCase();
  const p = String(profile || "").toLowerCase();

  if (m === "walk_transit" || p.includes("city") || p.includes("urbain")) {
    return 3500;
  }
  if (m === "car_if_worth_it" || p.includes("maison") || p.includes("chill")) {
    return 12000;
  }
  if (m === "car_ok" || p.includes("outdoor") || p.includes("montagne") || p.includes("nature")) {
    return 25000;
  }
  return 10000;
}

export function mergeUniquePlacesById(existing: GeoapifyPlace[] = [], incoming: GeoapifyPlace[] = []): GeoapifyPlace[] {
  const seen = new Set<string>();
  const merged: GeoapifyPlace[] = [];

  for (const item of existing) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  for (const item of incoming) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}

export async function searchGeoapifyPlaces(options: GeoapifySearchOptions): Promise<GeoapifyPlace[]> {
  const apiKey = process.env["GEOAPIFY_API_KEY"];
  if (!apiKey) {
    console.warn("[geoapify] GEOAPIFY_API_KEY missing - returning empty pool");
    return [];
  }

  const { categories, longitude, latitude, radiusMeters = 10000, limit = 20 } = options;
  if (!categories.length || longitude == null || latitude == null) {
    return [];
  }

  const categoriesParam = categories.join(",");
  const filterParam = `circle:${longitude},${latitude},${radiusMeters}`;
  const biasParam = `proximity:${longitude},${latitude}`;

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categoriesParam);
  url.searchParams.set("filter", filterParam);
  url.searchParams.set("bias", biasParam);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", apiKey);

  if (options.conditions && options.conditions.length > 0) {
    url.searchParams.set("conditions", options.conditions.join(","));
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`geoapify_places_http_${response.status}:${text.slice(0, 160)}`);
    }

    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];

    const places: GeoapifyPlace[] = [];
    const seenNames = new Set<string>();

    for (const feature of features) {
      const props = feature?.properties;
      if (!props) continue;

      const name = String(props.name || props.title || props.address_line1 || "").trim();
      if (!name) continue;

      const normName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (seenNames.has(normName)) continue;
      seenNames.add(normName);

      const lat =
        typeof props.lat === "number"
          ? props.lat
          : typeof feature.geometry?.coordinates?.[1] === "number"
            ? feature.geometry.coordinates[1]
            : null;
      const lon =
        typeof props.lon === "number"
          ? props.lon
          : typeof feature.geometry?.coordinates?.[0] === "number"
            ? feature.geometry.coordinates[0]
            : null;

      const rawId = props.place_id || props.id;
      const stableId = rawId
        ? String(rawId)
        : lat != null && lon != null
          ? `geo_place_${normName.replace(/[^a-z0-9]+/g, "-")}_${lat.toFixed(4)}_${lon.toFixed(4)}`
          : null;

      if (!stableId) continue;

      const rawCategories: string[] = Array.isArray(props.categories)
        ? props.categories.map(String)
        : [String(props.category || categories[0])];

      places.push({
        id: stableId,
        name,
        category: rawCategories.join(", "),
        categories: rawCategories,
        address: props.formatted || props.address_line2 || null,
        latitude: lat,
        longitude: lon,
        distanceMeters: typeof props.distance === "number" ? props.distance : null,
        website: typeof props.website === "string" && props.website.startsWith("http") ? props.website : null,
        openingHours: props.opening_hours || null,
        wheelchair: props.wheelchair != null ? Boolean(props.wheelchair) : null,
        source: "geoapify",
        verified: true,
      });

      if (places.length >= 15) break;
    }

    return places;
  } catch (error) {
    reportServerError(error, {
      provider: "geoapify",
      kind: "places_search",
      categories: categoriesParam,
      fallback: "empty_pool",
    });
    return [];
  }
}

export async function fetchPlaceDetails(
  placeId: string,
  telemetryCounter?: { detailsCalls: number },
): Promise<any | null> {
  if (!placeId) return null;
  if (placeDetailsCache.has(placeId)) {
    return placeDetailsCache.get(placeId);
  }

  const apiKey = process.env["GEOAPIFY_API_KEY"];
  if (!apiKey) return null;

  try {
    if (telemetryCounter) telemetryCounter.detailsCalls++;
    const url = `https://api.geoapify.com/v2/place-details?id=${encodeURIComponent(placeId)}&apiKey=${apiKey}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.features?.[0]?.properties || null;
    placeDetailsCache.set(placeId, props);
    return props;
  } catch {
    return null;
  }
}

export function rankGeoapifyCandidates(
  candidates: GeoapifyPlace[],
  req: PlaceRequirements,
  lastCoords: { latitude?: number | null; longitude?: number | null } | null,
  usedCandidateIdsSet: Set<string>,
): GeoapifyPlace[] {
  const normSubtype = String(req.subtype || "").toLowerCase();

  const haversine = (
    a: { latitude?: number | null; longitude?: number | null },
    b: { latitude?: number | null; longitude?: number | null },
  ) => {
    if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return 99999;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  return candidates.slice().sort((a, b) => {
    // 1. Unused candidate first
    const usedA = usedCandidateIdsSet.has(a.id) ? 1 : 0;
    const usedB = usedCandidateIdsSet.has(b.id) ? 1 : 0;
    if (usedA !== usedB) return usedA - usedB;

    // 2. Subtype match using categories array
    if (normSubtype) {
      const matchA = (a.categories || []).some((c) => c.toLowerCase().includes(normSubtype)) ? 0 : 1;
      const matchB = (b.categories || []).some((c) => c.toLowerCase().includes(normSubtype)) ? 0 : 1;
      if (matchA !== matchB) return matchA - matchB;
    }

    // 3. Distance
    if (lastCoords?.latitude != null && lastCoords?.longitude != null) {
      const distA = haversine(lastCoords, a);
      const distB = haversine(lastCoords, b);
      return distA - distB;
    }

    return 0;
  });
}
