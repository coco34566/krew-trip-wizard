import type { StayConcept } from "./stay-profiles";

export type VerificationState = "confirmed" | "inferred" | "unknown";

export function onsiteActivityCategories(
  activities: Array<{ value: string; state: VerificationState }>,
): string[] {
  const categories = new Set<string>();
  for (const activity of activities.filter((item) => item.state === "confirmed")) {
    const value = activity.value.toLowerCase();
    if (/tennis|padel|salle de sport|fitness|petanque|pétanque|billard/.test(value))
      categories.add("sport");
    if (
      /velo|vélo|cycl|randon|trail|kayak|canoe|canoë|voile|surf|lac|riviere|rivière|nautique/.test(
        value,
      )
    )
      categories.add("sport");
    if (/spa|sauna|jacuzzi|bien.etre/.test(value)) categories.add("detente");
  }
  return [...categories];
}

export function resolvePropertyDestination(
  property: Pick<PropertyCandidate, "region" | "locality" | "country">,
) {
  const name = property.region?.trim() || property.locality?.trim() || null;
  return name ? { name, country: property.country?.trim() || null } : null;
}
export type PropertyCandidate = {
  source: string;
  sourceUrl: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  latitude?: number;
  longitude?: number;
  capacity?: { value: number; state: VerificationState };
  bedrooms?: { value: number; state: VerificationState };
  price?: { value: number; currency: string; priceType: string; state: VerificationState };
  amenities: Array<{ value: string; state: VerificationState }>;
  onsiteActivities: Array<{ value: string; state: VerificationState }>;
  propertyType?: { value: string; state: VerificationState };
  imageUrl?: string;
  availabilityVerified: boolean;
  priceVerified: boolean;
  fetchedAt: string;
};

export type PropertyDiscoveryInput = {
  concepts: StayConcept[];
  participants: number;
  territories?: string[];
  amenities?: string[];
  activities?: string[];
  environment?: string[];
  localMobility?: string | null;
  accommodationRole?: string | null;
};
const cache = new Map<string, { at: number; value: PropertyCandidate[] }>();
const TIMEOUT_MS = 4_500;

export function shouldDiscoverProperties(input: PropertyDiscoveryInput): boolean {
  return (
    input.accommodationRole === "centerpiece" ||
    input.concepts.some(
      (c) => c.profiles.includes("house_together") || c.profiles.includes("exceptional_experience"),
    )
  );
}

export function buildPropertyQueries(input: PropertyDiscoveryInput): string[] {
  if (!shouldDiscoverProperties(input)) return [];
  const place = input.territories?.slice(0, 2).join(" OR ") || "France";
  const needs = [
    ...(input.amenities ?? []),
    ...(input.activities ?? []),
    ...(input.environment ?? []),
  ]
    .slice(0, 5)
    .join(" ");
  const propertyKinds = input.concepts.some((c) => c.profiles.includes("exceptional_experience"))
    ? "domaine lieu exceptionnel villa chalet"
    : "grand gîte maison de groupe villa chalet";
  return [
    `${propertyKinds} ${input.participants} personnes ${needs} ${place}`
      .replace(/\s+/g, " ")
      .trim(),
    `site:gites.fr OR site:grandsgites.com OR site:gites-de-france.com OR site:greengo.voyage ${input.participants} personnes ${needs} ${place}`
      .replace(/\s+/g, " ")
      .trim(),
  ].slice(0, 2);
}

function inferredNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match ? { value: Number(match[1]), state: "inferred" as const } : undefined;
}

export function normalizePropertySearchResult(
  result: { title?: string; link?: string; snippet?: string },
  fetchedAt: string,
): PropertyCandidate | null {
  if (!result.link || !result.title) return null;
  const host = new URL(result.link).hostname.replace(/^www\./, "");
  const text = `${result.title} ${result.snippet ?? ""}`;
  const priceMatch = text.match(/(\d[\d\s]{1,6})\s*€\s*(?:\/|par)?\s*(nuit|week-end|semaine)?/i);
  const locationMatch = text.match(
    /(?:à|près de|situé à)\s+([A-ZÀ-ÖØ-Þ][\p{L}'’ -]{2,40}?)(?=\s+-\s+\d|[,.]|$)/u,
  );
  const knownAmenities = [
    "piscine",
    "spa",
    "sauna",
    "jacuzzi",
    "tennis",
    "padel",
    "pétanque",
    "billard",
    "baby-foot",
    "vélos",
    "lac",
    "rivière",
    "randonnée",
  ].filter((a) => text.toLowerCase().includes(a));
  const onsite = knownAmenities.filter((a) =>
    [
      "tennis",
      "padel",
      "pétanque",
      "billard",
      "baby-foot",
      "vélos",
      "lac",
      "rivière",
      "randonnée",
    ].includes(a),
  );
  const capacity = inferredNumber(text, /(\d{1,2})\s*(?:personnes|pers\.?)/i);
  const bedrooms = inferredNumber(text, /(\d{1,2})\s*(?:chambres?|couchages?)/i);
  return {
    source: host,
    sourceUrl: result.link,
    name: result.title.slice(0, 160),
    ...(locationMatch ? { locality: locationMatch[1]!.trim() } : {}),
    ...(capacity ? { capacity } : {}),
    ...(bedrooms ? { bedrooms } : {}),
    ...(priceMatch
      ? {
          price: {
            value: Number(priceMatch[1]!.replace(/\s/g, "")),
            currency: "EUR",
            priceType: priceMatch[2]?.toLowerCase() || "unknown",
            state: "inferred" as const,
          },
        }
      : {}),
    amenities: knownAmenities.map((value) => ({ value, state: "inferred" })),
    onsiteActivities: onsite.map((value) => ({ value, state: "inferred" })),
    availabilityVerified: false,
    priceVerified: false,
    fetchedAt,
  };
}

/** Recherche ciblée via l'API documentée de Serper. Aucun site n'est crawlé directement. */
export async function discoverProperties(
  _input: PropertyDiscoveryInput,
): Promise<PropertyCandidate[]> {
  // Property-led destination discovery now asks Gemini for plausible territories;
  // it never searches or implies availability of an individual property.
  return [];
}

export function propertyToAccommodationRow(
  property: PropertyCandidate,
  destinationId: string,
  participants: number,
  nights: number,
) {
  if (
    !property.capacity ||
    property.capacity.value < participants ||
    !property.price ||
    !property.priceVerified ||
    !property.availabilityVerified ||
    property.price.state !== "confirmed"
  )
    return null;
  if (!["nuit", "semaine", "week-end"].includes(property.price.priceType)) return null;
  const divisor =
    property.price.priceType === "semaine"
      ? 7
      : property.price.priceType === "nuit"
        ? 1
        : property.price.priceType === "week-end"
          ? Math.max(1, nights)
          : 0;
  if (!divisor) return null;
  const perNight = property.price.value / divisor;
  return {
    destination_id: destinationId,
    name: property.name,
    type: property.propertyType?.value ?? "property_web",
    description: `Source publique : ${property.source}`,
    capacity: property.capacity.value,
    price_per_night_per_person: Math.round((perNight / participants) * 100) / 100,
    rating: 0,
    distance_center_km: 0,
    image_url: property.imageUrl ?? null,
    booking_url: property.sourceUrl,
    amenities: [...new Set(property.amenities.map((item) => item.value))],
    onsite_activity_categories: onsiteActivityCategories(property.onsiteActivities),
    source: `property_web:${property.source}`,
    external_id: property.sourceUrl,
    availability_verified: property.availabilityVerified,
    price_verified: property.priceVerified,
    verification_state: property.price.state,
    bedrooms: property.bedrooms?.value ?? null,
  };
}
