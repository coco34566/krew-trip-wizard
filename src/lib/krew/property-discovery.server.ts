import type { StayConcept } from "./stay-profiles";

export type VerificationState = "confirmed" | "inferred" | "unknown";
export type PropertyCandidate = {
  source: string;
  sourceUrl: string;
  name: string;
  country?: string;
  region?: string;
  locality?: string;
  capacity?: { value: number; state: VerificationState };
  bedrooms?: { value: number; state: VerificationState };
  price?: { value: number; currency: string; priceType: string; state: VerificationState };
  amenities: Array<{ value: string; state: VerificationState }>;
  onsiteActivities: Array<{ value: string; state: VerificationState }>;
  propertyType?: { value: string; state: VerificationState };
  imageUrl?: string;
  availabilityVerified: false;
  priceVerified: false;
  fetchedAt: string;
};

export type PropertyDiscoveryInput = {
  concepts: StayConcept[];
  participants: number;
  territories?: string[];
  amenities?: string[];
  activities?: string[];
};
const cache = new Map<string, { at: number; value: PropertyCandidate[] }>();
const TIMEOUT_MS = 4_500;

export function shouldDiscoverProperties(input: PropertyDiscoveryInput): boolean {
  return input.concepts.some(
    (c) => c.profiles.includes("house_together") || c.profiles.includes("exceptional_experience"),
  );
}

export function buildPropertyQueries(input: PropertyDiscoveryInput): string[] {
  if (!shouldDiscoverProperties(input)) return [];
  const place = input.territories?.slice(0, 2).join(" OR ") || "France";
  const needs = [...(input.amenities ?? []), ...(input.activities ?? [])].slice(0, 4).join(" ");
  return [
    `grand gîte domaine villa ${input.participants} personnes ${needs} ${place}`
      .replace(/\s+/g, " ")
      .trim(),
  ].slice(0, 2);
}

/** Recherche ciblée via l'API documentée de Serper. Aucun site n'est crawlé directement. */
export async function discoverProperties(
  input: PropertyDiscoveryInput,
): Promise<PropertyCandidate[]> {
  const key = process.env["SERPER_API_KEY"];
  const queries = buildPropertyQueries(input);
  if (!key || !queries.length) return [];
  const fp = JSON.stringify(queries);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const responses = await Promise.all(
      queries.map((q) =>
        fetch("https://google.serper.dev/search", {
          method: "POST",
          signal: controller.signal,
          headers: { "X-API-KEY": key, "Content-Type": "application/json" },
          body: JSON.stringify({ q, gl: "fr", hl: "fr", num: 6 }),
        }),
      ),
    );
    clearTimeout(timer);
    const json = await Promise.all(
      responses
        .filter((r) => r.ok)
        .map(
          (r) =>
            r.json() as Promise<{
              organic?: Array<{ title?: string; link?: string; snippet?: string }>;
            }>,
        ),
    );
    const seen = new Set<string>();
    const fetchedAt = new Date().toISOString();
    const value = json
      .flatMap((j) => j.organic ?? [])
      .flatMap((r): PropertyCandidate[] => {
        if (!r.link || !r.title || seen.has(r.link)) return [];
        seen.add(r.link);
        const host = new URL(r.link).hostname.replace(/^www\./, "");
        const text = `${r.title} ${r.snippet ?? ""}`;
        const capacity = text.match(/(\d{1,2})\s*(?:personnes|pers\.?)/i);
        const knownAmenities = [
          "piscine",
          "spa",
          "sauna",
          "jacuzzi",
          "tennis",
          "pétanque",
          "billard",
          "baby-foot",
          "jardin",
        ].filter((a) => text.toLowerCase().includes(a));
        return [
          {
            source: host,
            sourceUrl: r.link,
            name: r.title.slice(0, 160),
            ...(capacity ? { capacity: { value: Number(capacity[1]), state: "inferred" } } : {}),
            amenities: knownAmenities.map((value) => ({ value, state: "inferred" })),
            onsiteActivities: [],
            availabilityVerified: false,
            priceVerified: false,
            fetchedAt,
          },
        ];
      })
      .slice(0, 8);
    cache.set(fp, { at: Date.now(), value });
    return value;
  } catch {
    return [];
  }
}
