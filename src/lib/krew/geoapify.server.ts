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
  searchIntent?: string | null;
  momentType?: string | null;
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
    searchIntent: searchIntent ?? null,
    momentType: momentType ?? null,
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
    console.warn("[geoapify-diagnostic]", JSON.stringify({
      stage: "missing_key",
      keyPresent: false,
      categories: options.categories,
      latitude: options.latitude,
      longitude: options.longitude,
      radiusMeters: options.radiusMeters ?? 10000,
    }));
    return [];
  }

  const { categories, longitude, latitude, radiusMeters = 10000, limit = 20 } = options;
  if (!categories.length || longitude == null || latitude == null) {
    console.warn("[geoapify-diagnostic]", JSON.stringify({
      stage: "invalid_input",
      keyPresent: true,
      categories,
      latitude,
      longitude,
      radiusMeters,
    }));
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

  const diagnosticBase = {
    keyPresent: true,
    categories,
    latitude,
    longitude,
    radiusMeters,
    limit,
    conditions: options.conditions ?? [],
  };

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[geoapify-diagnostic]", JSON.stringify({
        ...diagnosticBase,
        stage: "http_error",
        httpStatus: response.status,
        responsePreview: text.slice(0, 160),
      }));
      throw new Error(`geoapify_places_http_${response.status}:${text.slice(0, 160)}`);
    }

    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];

    console.info("[geoapify-diagnostic]", JSON.stringify({
      ...diagnosticBase,
      stage: "success",
      httpStatus: response.status,
      featuresReturned: features.length,
    }));

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
      latitude,
      longitude,
      radiusMeters,
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

const weekdaysMap: Record<string, number> = {
  dimanche: 0,
  sunday: 0,
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
};

function toMinutes(t?: string | null): number | null {
  if (!t || typeof t !== "string") return null;
  const match = t.match(/([01]?\d|2[0-3])[:h]([0-5]\d)/i);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function geoapifyOpeningStatus(
  place: GeoapifyPlace | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
  durationMinutes = 90,
): "open" | "closed" | "unknown" {
  if (!place || !place.openingHours || !date || !time) return "unknown";

  const timeMins = toMinutes(time);
  if (timeMins == null) return "unknown";

  const raw = typeof place.openingHours === "string" ? place.openingHours : String(place.openingHours || "");
  if (!raw.trim()) return "unknown";

  const normRaw = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normRaw.includes("24/7") || normRaw.includes("open 24 hours") || normRaw.includes("24h/24")) {
    return "open";
  }

  const dateObj = new Date(`${date}T12:00:00Z`);
  if (isNaN(dateObj.getTime())) return "unknown";
  const weekday = dateObj.getUTCDay();

  const lines = normRaw.split(/[\n;]/);
  let matchingLine: string | null = null;

  for (const line of lines) {
    for (const [name, dayNum] of Object.entries(weekdaysMap)) {
      if (dayNum === weekday && line.includes(name)) {
        matchingLine = line;
        break;
      }
    }
    if (matchingLine) break;
  }

  const targetLine = matchingLine || normRaw;

  if (targetLine.includes("closed") || targetLine.includes("ferme")) {
    return "closed";
  }

  const ranges = [
    ...targetLine.matchAll(
      /([01]?\d|2[0-3])[:h]([0-5]\d)\s*(?:-|–|—|a|to)\s*([01]?\d|2[0-3])[:h]([0-5]\d)/gi,
    ),
  ];

  if (!ranges.length) return "unknown";

  const slotStart = timeMins;
  const slotEnd = slotStart + durationMinutes;

  for (const match of ranges) {
    const rStart = Number(match[1]) * 60 + Number(match[2]);
    let rEnd = Number(match[3]) * 60 + Number(match[4]);
    if (rEnd < rStart) rEnd += 1440;

    if (slotStart >= rStart && slotEnd <= rEnd) {
      return "open";
    }
  }

  return "closed";
}

export type SelectCandidateOptions = {
  candidates: GeoapifyPlace[];
  req: PlaceRequirements;
  usedCandidateIdsSet: Set<string>;
  avoidList?: string[];
  refCoords?: { latitude?: number | null; longitude?: number | null } | null;
  maxKm?: number;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number;
  accessibilityRequired?: boolean;
  telemetry?: {
    candidatesRejectedRequirements?: number;
    candidatesRejectedGeography?: number;
    candidatesRejectedOpeningHours?: number;
    detailsCalls?: number;
  };
};

export async function selectGeoapifyCandidate(
  options: SelectCandidateOptions,
): Promise<GeoapifyPlace | null> {
  const {
    candidates,
    req,
    usedCandidateIdsSet,
    avoidList = [],
    refCoords,
    maxKm = 50,
    date,
    time,
    durationMinutes = 90,
    accessibilityRequired = false,
    telemetry,
  } = options;

  const avoidSet = new Set(avoidList.map((s) => s.toLowerCase().trim()));

  const haversineKm = (
    a: { latitude?: number | null; longitude?: number | null },
    b: { latitude?: number | null; longitude?: number | null },
  ) => {
    if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.longitude - a.longitude);
    const dLon = rad(b.latitude - a.latitude);
    const h =
      Math.sin(dLon / 2) ** 2 +
      Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLat / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const ranked = rankGeoapifyCandidates(candidates, req, refCoords || null, usedCandidateIdsSet);

  for (const candidate of ranked) {
    if (!candidate || !candidate.id) continue;

    if (usedCandidateIdsSet.has(candidate.id)) continue;
    const normName = candidate.name.toLowerCase().trim();
    if (avoidSet.has(normName) || avoidSet.has(candidate.id.toLowerCase())) continue;

    if (!isCandidateCompatibleWithRequirements(candidate, req)) {
      if (telemetry?.candidatesRejectedRequirements != null) telemetry.candidatesRejectedRequirements++;
      continue;
    }

    if (accessibilityRequired && candidate.wheelchair === false) {
      if (telemetry?.candidatesRejectedRequirements != null) telemetry.candidatesRejectedRequirements++;
      continue;
    }

    if (refCoords?.latitude != null && refCoords?.longitude != null && candidate.latitude != null && candidate.longitude != null) {
      const dist = haversineKm(refCoords, candidate);
      if (dist != null && dist > maxKm) {
        if (telemetry?.candidatesRejectedGeography != null) telemetry.candidatesRejectedGeography++;
        continue;
      }
    }

    let status = geoapifyOpeningStatus(candidate, date, time, durationMinutes);

    if (status === "unknown" && candidate.id && date && time) {
      const details = await fetchPlaceDetails(candidate.id, telemetry);
      if (details) {
        if (details.opening_hours && typeof details.opening_hours === "string") {
          candidate.openingHours = details.opening_hours;
          status = geoapifyOpeningStatus(candidate, date, time, durationMinutes);
        }
        if (details.wheelchair != null) candidate.wheelchair = Boolean(details.wheelchair);
      }
    }

    if (status === "closed") {
      if (telemetry?.candidatesRejectedOpeningHours != null) telemetry.candidatesRejectedOpeningHours++;
      continue;
    }

    return candidate;
  }

  return null;
}

export function isCandidateCompatibleWithRequirements(
  candidate: GeoapifyPlace,
  req: PlaceRequirements,
): boolean {
  if (!candidate || !Array.isArray(candidate.categories) || candidate.categories.length === 0) {
    return false;
  }
  const candCats = candidate.categories.map((c) => String(c).toLowerCase().trim());
  const normFamily = String(req.canonicalFamily || "").toLowerCase().trim();

  let allowedCategories: string[] = [];

  if (normFamily.includes("cafe") || normFamily.includes("brunch")) {
    allowedCategories = ["catering.cafe", "catering.restaurant"];
  } else if (normFamily.includes("restaurant") || normFamily === "resto") {
    allowedCategories = ["catering.restaurant"];
  } else if (normFamily.includes("bar") || normFamily.includes("pub")) {
    allowedCategories = ["catering.bar", "catering.pub"];
  } else if (normFamily.includes("spa") || normFamily.includes("wellness")) {
    allowedCategories = ["leisure.spa", "service.beauty.spa", "service.beauty.massage"];
  } else if (normFamily.includes("shopping")) {
    allowedCategories = ["commercial.marketplace", "commercial.shopping_mall", "commercial.clothing"];
  } else if (normFamily.includes("culture")) {
    allowedCategories = ["tourism.sights", "tourism.attraction", "entertainment.museum", "entertainment.culture"];
  } else if (normFamily.includes("sport")) {
    allowedCategories = ["sport", "entertainment.activity_park", "tourism.attraction"];
  }

  const genericParents = new Set([
    "commercial",
    "tourism",
    "entertainment",
    "service",
    "service.beauty",
    "catering",
    "leisure",
  ]);

  for (const cat of req.categories || []) {
    const normC = String(cat).toLowerCase().trim();
    if (normC && !genericParents.has(normC) && !allowedCategories.includes(normC)) {
      allowedCategories.push(normC);
    }
  }

  return candCats.some((candCat) =>
    allowedCategories.some(
      (allowed) => candCat === allowed || candCat.startsWith(`${allowed}.`)
    )
  );
}

export function rankGeoapifyCandidates(
  candidates: GeoapifyPlace[],
  req: PlaceRequirements,
  lastCoords: { latitude?: number | null; longitude?: number | null } | null,
  usedCandidateIdsSet: Set<string>,
): GeoapifyPlace[] {
  const normSubtype = String(req.subtype || "").toLowerCase();
  const normIntent = String(req.searchIntent || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const haversineKm = (
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

  const calculateScore = (cand: GeoapifyPlace): number => {
    let score = 0;

    if (usedCandidateIdsSet.has(cand.id)) {
      score -= 10000;
    }

    const candCats = (cand.categories || []).map((c) => String(c).toLowerCase());
    const candName = String(cand.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const candAddr = String(cand.address || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    // A. Compatibilité famille métier
    if (isCandidateCompatibleWithRequirements(cand, req)) {
      score += 300;
    }

    // B. Compatibilité subtype exact
    if (normSubtype && candCats.some((c) => c.includes(normSubtype))) {
      score += 150;
    }

    // C. Correspondance sémantique searchIntent
    if (normIntent) {
      // restaurant local / traditionnel
      if (
        /local|locales|hongrois|hongroise|hungarian|traditionnel|traditionnelle|specialite|specialites|regional|typique/.test(
          normIntent,
        )
      ) {
        if (
          candCats.some((c) => c.includes("hungarian") || c.includes("regional")) ||
          /hungarian|hongrois|traditionnel|local|specialite|typique/.test(candName)
        ) {
          score += 200;
        }
      }

      // rooftop / panoramique / vue / terrasse
      if (/rooftop|panoramique|vue|terrace|terrasse|skybar|panorama/.test(normIntent)) {
        if (/rooftop|terrace|terrasse|viewpoint|panoramique|panorama|skybar/.test(candName) || candCats.some((c) => c.includes("rooftop") || c.includes("viewpoint"))) {
          score += 300;
        }
      }

      // brunch / café
      if (/brunch|petit-dejeuner|cafe|coffee/.test(normIntent)) {
        if (candCats.some((c) => c.includes("catering.cafe")) || /cafe|coffee|brunch/.test(candName)) {
          score += 200;
        }
      }

      // marché
      if (/marche|market|hall|couvert/.test(normIntent)) {
        if (candCats.some((c) => c.includes("commercial.marketplace")) || /marche|market|hall/.test(candName)) {
          score += 200;
        }
      }

      // thermes / bains
      if (/thermes|thermal|bains|bath/.test(normIntent)) {
        if (/therme|thermes|thermal|bain|bains|bath|baths|szechenyi|gellert|rudas|lukacs/.test(candName) || candCats.some((c) => c.includes("thermal"))) {
          score += 300;
        } else if (candCats.some((c) => c.includes("leisure.spa"))) {
          score += 100;
        } else if (candCats.some((c) => c.includes("service.beauty"))) {
          // Penalty for pure nail/beauty salon without thermal bath signals
          score -= 250;
        }
      }

      // Mot-clés significatifs de searchIntent
      const words = normIntent.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !["restaurant", "groupe", "budapest", "centre", "dans", "avec", "pour"].includes(w));
      for (const w of words) {
        if (candName.includes(w) || candAddr.includes(w)) {
          score += 30;
        }
      }
    }

    // E. Distance (critère secondaire)
    if (lastCoords?.latitude != null && lastCoords?.longitude != null && cand.latitude != null && cand.longitude != null) {
      const dist = haversineKm(lastCoords, cand);
      score -= dist * 5;
    }

    return score;
  };

  return candidates.slice().sort((a, b) => {
    const scoreA = calculateScore(a);
    const scoreB = calculateScore(b);
    return scoreB - scoreA;
  });
}
