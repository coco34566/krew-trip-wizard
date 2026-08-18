import type { AccommodationConceptId, AccommodationLocationIntent } from "./accommodation-concepts";

export type AccommodationSearchSpecification = {
  destination: { name: string; country: string };
  dates: { checkIn: string; checkOut: string; nights: number };
  group: {
    size: number;
    targetBedrooms: number;
    singleRooms: number;
    sharedRoomsOrEquivalent: number;
  };
  budget: { targetPerPersonStay: number; hardMaxPerPersonStay: number | null };
  searchStrategies: Array<{
    concept: AccommodationConceptId;
    score: number;
    priority: number;
    resultsWanted: number;
    propertyTypes: string[];
    mustHave: string[];
    preferred: string[];
  }>;
  locationIntent: {
    mode: AccommodationLocationIntent;
    priority: "required" | "preferred";
    carAccepted: boolean;
  };
  minimumRating: number | null;
  requiredAmenities: string[];
  accessibilityRequired: boolean;
};

export type AccommodationCandidate = {
  id: string;
  name: string;
  propertyType: string;
  krewConcept: AccommodationConceptId;
  location: { city: string | null; area: string | null; address: string | null };
  capacity: number | null;
  bedrooms: number | null;
  roomConfiguration: string | null;
  rating: number | null;
  reviewCount: number | null;
  amenities: string[];
  totalStayPrice: number | null;
  pricePerPerson: number | null;
  priceStatus: "verified" | "estimated" | "unknown";
  availabilityStatus: "verified" | "unverified" | "unknown";
  url: string;
  source: string;
  imageUrl: string | null;
  imageSource: string | null;
  matchReasons: string[];
};

export type AccommodationGenerationStatus =
  | "success"
  | "empty"
  | "rate_limited"
  | "provider_unavailable"
  | "error";

export type AccommodationGenerationMeta = {
  status: AccommodationGenerationStatus;
  requestHash: string;
  attemptedAt: string;
  completedAt?: string | null;
  userMessage?: string | null;
};

export function computeAccommodationRequestHash(
  tripId: string,
  specification: AccommodationSearchSpecification,
): string {
  const payload = {
    tripId,
    destination: specification.destination,
    dates: specification.dates,
    group: specification.group,
    budget: specification.budget,
    searchStrategies: specification.searchStrategies.map((s) => ({
      concept: s.concept,
      propertyTypes: s.propertyTypes,
    })),
    locationIntent: specification.locationIntent,
    minimumRating: specification.minimumRating,
    requiredAmenities: specification.requiredAmenities.slice().sort(),
    accessibilityRequired: specification.accessibilityRequired,
  };
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `acc_${Math.abs(hash).toString(36)}`;
}

export function mergeAccommodationLogistics(
  previous: Record<string, any>,
  hotels: AccommodationCandidate[],
  providerErrors: string[],
  meta?: AccommodationGenerationMeta,
): Record<string, any> {
  const isFailure = meta && (meta.status === "rate_limited" || meta.status === "error" || meta.status === "provider_unavailable");
  const existingHotels = Array.isArray(previous.hotels) ? previous.hotels : [];

  // If new generation failed or returned 0 hotels on rate limit / error, keep existing valid hotels
  const finalHotels = isFailure && existingHotels.length > 0 ? existingHotels : hotels;

  return {
    ...previous,
    hotels: finalHotels,
    hotelVotes: Array.isArray(previous.hotelVotes)
      ? previous.hotelVotes.filter((vote: any) => finalHotels.some((hotel: any) => hotel.id === vote.hotelId))
      : [],
    selectedHotelId: finalHotels.some((hotel: any) => hotel.id === previous.selectedHotelId)
      ? previous.selectedHotelId
      : null,
    hotelProviderErrors: providerErrors,
    hotelsGeneratedAt: isFailure ? previous.hotelsGeneratedAt ?? new Date().toISOString() : new Date().toISOString(),
    accommodationGeneration: meta ?? previous.accommodationGeneration ?? null,
  };
}

const safeHttps = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const text = (payload: any) =>
  (payload?.candidates?.[0]?.content?.parts ?? []).map((part: any) => part?.text ?? "").join("");
const jsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

export function normalizeAccommodationCandidates(
  payload: any,
  specification: AccommodationSearchSpecification,
): AccommodationCandidate[] {
  const parsed = jsonObject(text(payload));
  const groundedUrls = new Set(
    (payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk: any) => chunk?.web?.uri)
      .filter(safeHttps),
  );
  const concepts = new Set(specification.searchStrategies.map((strategy) => strategy.concept));
  const seen = new Set<string>();
  return (Array.isArray(parsed?.properties) ? parsed.properties : [])
    .flatMap((raw: any) => {
      const url = safeHttps(raw?.url) ? raw.url : null;
      const source = String(raw?.source ?? "").trim();
      const name = String(raw?.name ?? "").trim();
      const concept = raw?.krewConcept as AccommodationConceptId;
      if (!url || !source || !name || !concepts.has(concept)) return [];
      const host = new URL(url).hostname;
      if (![...groundedUrls].some((grounded) => new URL(grounded).hostname === host)) return [];
      const key = `${name.toLowerCase()}|${host}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const capacity = Number.isFinite(Number(raw.capacity)) ? Number(raw.capacity) : null;
      const bedrooms = Number.isFinite(Number(raw.bedrooms)) ? Number(raw.bedrooms) : null;
      const rating = Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null;
      const pricePerPerson = Number.isFinite(Number(raw.pricePerPerson))
        ? Number(raw.pricePerPerson)
        : null;
      const priceStatus = ["verified", "estimated", "unknown"].includes(raw.priceStatus)
        ? raw.priceStatus
        : "unknown";
      if (capacity != null && capacity < specification.group.size) return [];
      if (bedrooms != null && bedrooms < specification.group.targetBedrooms) return [];
      if (
        rating != null &&
        specification.minimumRating != null &&
        rating < specification.minimumRating
      )
        return [];
      if (
        pricePerPerson != null &&
        priceStatus !== "unknown" &&
        specification.budget.hardMaxPerPersonStay != null &&
        pricePerPerson > specification.budget.hardMaxPerPersonStay
      )
        return [];
      const amenities = Array.isArray(raw.amenities) ? raw.amenities.map(String) : [];
      if (
        specification.requiredAmenities.some(
          (required) =>
            !amenities.some((item) => item.toLowerCase().includes(required.toLowerCase())),
        )
      )
        return [];
      return [
        {
          id: String(raw.id || `${concept}-${seen.size}`),
          name,
          propertyType: String(raw.propertyType ?? "unknown"),
          krewConcept: concept,
          location: {
            city: raw.location?.city ? String(raw.location.city) : null,
            area: raw.location?.area ? String(raw.location.area) : null,
            address: raw.location?.address ? String(raw.location.address) : null,
          },
          capacity,
          bedrooms,
          roomConfiguration: raw.roomConfiguration ? String(raw.roomConfiguration) : null,
          rating,
          reviewCount: Number.isFinite(Number(raw.reviewCount)) ? Number(raw.reviewCount) : null,
          amenities,
          totalStayPrice: Number.isFinite(Number(raw.totalStayPrice))
            ? Number(raw.totalStayPrice)
            : null,
          pricePerPerson,
          priceStatus,
          availabilityStatus: ["verified", "unverified", "unknown"].includes(raw.availabilityStatus)
            ? raw.availabilityStatus
            : "unknown",
          url,
          source,
          imageUrl: safeHttps(raw.imageUrl) && groundedUrls.has(raw.imageUrl) ? raw.imageUrl : null,
          imageSource:
            safeHttps(raw.imageUrl) && groundedUrls.has(raw.imageUrl) && raw.imageSource
              ? String(raw.imageSource)
              : null,
          matchReasons: Array.isArray(raw.matchReasons)
            ? raw.matchReasons.map(String).slice(0, 3)
            : [],
        },
      ];
    })
    .slice(0, 6);
}

export async function searchAccommodationsWithGemini(
  specification: AccommodationSearchSpecification,
): Promise<AccommodationCandidate[]> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("no_gemini_key");
  const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
  const prompt = `Recherche grounded KREW. Spécification=${JSON.stringify(specification)}\nRetourne JSON {"properties":[{"id":"stable","name":"","propertyType":"","krewConcept":"","location":{"city":null,"area":null,"address":null},"capacity":null,"bedrooms":null,"roomConfiguration":null,"rating":null,"reviewCount":null,"amenities":[],"totalStayPrice":null,"pricePerPerson":null,"priceStatus":"verified|estimated|unknown","availabilityStatus":"verified|unverified|unknown","url":"https://source fiable","source":"","imageUrl":null,"imageSource":null,"matchReasons":[]}]}. Maximum 6. N'invente aucune donnée; null si inconnue. URL et source grounded obligatoires.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(body)) {
      throw new Error("gemini_accommodation_429:rate_limited");
    }
    throw new Error(`gemini_accommodation_http_${response.status}:${body.slice(0, 160)}`);
  }
  return normalizeAccommodationCandidates(JSON.parse(body), specification);
}
