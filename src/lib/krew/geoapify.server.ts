/* eslint-disable @typescript-eslint/no-explicit-any -- external API payloads are normalized at the boundary */
import { reportServerError } from "@/lib/server-error-reporting.server";

export type GeoapifyPlace = {
  id: string;
  name: string;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  website: string | null;
  source: "geoapify";
  verified: boolean;
};

export type GeoapifySearchOptions = {
  categories: string[];
  longitude: number;
  latitude: number;
  radiusMeters?: number;
  limit?: number;
};

export function mapVenueFamilyToGeoapifyCategories(family?: string, type?: string): string[] {
  const norm = String(family || type || "").toLowerCase().trim();
  if (norm.includes("cafe") || norm.includes("brunch") || norm.includes("petit-dejeuner")) {
    return ["catering.cafe", "catering.restaurant"];
  }
  if (norm.includes("restaurant") || norm.includes("diner") || norm.includes("dejeuner") || norm.includes("gastro") || norm === "resto") {
    return ["catering.restaurant"];
  }
  if (norm.includes("bar") || norm.includes("apero") || norm.includes("pub")) {
    return ["catering.bar", "catering.pub"];
  }
  if (norm.includes("nightlife") || norm.includes("club") || norm.includes("soiree") || norm.includes("fete")) {
    return ["catering.bar", "catering.pub", "entertainment.nightclub"];
  }
  if (norm.includes("sport") || norm.includes("outdoor") || norm.includes("nature") || norm.includes("rando") || norm.includes("velo")) {
    return ["sport", "entertainment.activity_park", "tourism.attraction"];
  }
  if (norm.includes("culture") || norm.includes("visite") || norm.includes("musee") || norm.includes("monument") || norm.includes("patrimoine")) {
    return ["tourism.sights", "tourism.attraction", "entertainment.museum", "entertainment.culture"];
  }
  if (norm.includes("relax") || norm.includes("spa") || norm.includes("bien_etre")) {
    return ["sport.fitness", "entertainment.theme_park", "tourism.attraction"];
  }
  return ["catering.restaurant", "tourism.attraction", "entertainment"];
}

export function determineSearchRadiusMeters(mobility?: string | null, profile?: string | null): number {
  const m = String(mobility || "").toLowerCase();
  const p = String(profile || "").toLowerCase();

  if (m === "walk_transit" || p.includes("city") || p.includes("urbain")) {
    return 3500; // 3.5 km
  }
  if (m === "car_if_worth_it" || p.includes("maison") || p.includes("chill")) {
    return 12000; // 12 km
  }
  if (m === "car_ok" || p.includes("outdoor") || p.includes("montagne") || p.includes("nature")) {
    return 25000; // 25 km
  }
  return 8000; // default 8 km
}

export async function searchGeoapifyPlaces(options: GeoapifySearchOptions): Promise<GeoapifyPlace[]> {
  const apiKey = process.env["GEOAPIFY_API_KEY"];
  if (!apiKey) {
    console.warn("[geoapify] GEOAPIFY_API_KEY missing - returning empty pool");
    return [];
  }

  const { categories, longitude, latitude, radiusMeters = 8000, limit = 20 } = options;
  if (!categories.length || longitude == null || latitude == null) {
    return [];
  }

  const categoriesParam = categories.join(",");
  // Geoapify filter format: circle:lon,lat,radiusMeters
  const filterParam = `circle:${longitude},${latitude},${radiusMeters}`;
  const biasParam = `proximity:${longitude},${latitude}`;

  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", categoriesParam);
  url.searchParams.set("filter", filterParam);
  url.searchParams.set("bias", biasParam);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", apiKey);

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

      const lat = typeof props.lat === "number" ? props.lat : typeof feature.geometry?.coordinates?.[1] === "number" ? feature.geometry.coordinates[1] : null;
      const lon = typeof props.lon === "number" ? props.lon : typeof feature.geometry?.coordinates?.[0] === "number" ? feature.geometry.coordinates[0] : null;

      places.push({
        id: String(props.place_id || props.id || `geo_${Math.random().toString(36).substring(2, 9)}`),
        name,
        category: Array.isArray(props.categories) ? props.categories.join(", ") : String(props.category || categories[0]),
        address: props.formatted || props.address_line2 || null,
        latitude: lat,
        longitude: lon,
        distanceMeters: typeof props.distance === "number" ? props.distance : null,
        website: typeof props.website === "string" && props.website.startsWith("http") ? props.website : null,
        source: "geoapify",
        verified: true,
      });

      if (places.length >= 12) break;
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
