import type { AccommodationConceptId, AccommodationLocationIntent } from "./accommodation-concepts";

export type AccommodationSearchSpecification = {
  destination: { name: string; country: string };
  dates: { checkIn: string; checkOut: string; nights: number };
  group: { size: number; targetBedrooms: number; singleRooms: number; sharedRoomsOrEquivalent: number };
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
  locationIntent: { mode: AccommodationLocationIntent; priority: "required" | "preferred"; carAccepted: boolean };
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

export type AccommodationGenerationStatus = "success" | "empty" | "rate_limited" | "provider_unavailable" | "error";
export type AccommodationGenerationMeta = {
  status: AccommodationGenerationStatus;
  requestHash: string;
  attemptedAt: string;
  completedAt?: string | null;
  userMessage?: string | null;
};

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const paramsToKeep = new URLSearchParams();
    parsed.searchParams.forEach((val, key) => {
      const k = key.toLowerCase();
      if (!k.startsWith("utm_") && !["gclid", "fbclid", "ref", "source", "mc_cid", "mc_eid"].includes(k)) paramsToKeep.append(key, val);
    });
    parsed.search = paramsToKeep.toString();
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) parsed.pathname = parsed.pathname.slice(0, -1);
    return parsed.toString().toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function buildCanonicalAccommodationExternalId(
  destinationName: string,
  hotel: { name: string; url?: string | null; source?: string | null },
): string {
  const normDest = destinationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const normName = hotel.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const normSource = (hotel.source || "gemini").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (hotel.url && hotel.url.startsWith("https://")) {
    const canonUrl = canonicalizeUrl(hotel.url);
    let urlHash = 0;
    for (let i = 0; i < canonUrl.length; i++) {
      urlHash = (urlHash << 5) - urlHash + canonUrl.charCodeAt(i);
      urlHash |= 0;
    }
    return `acc_${normSource}_${Math.abs(urlHash).toString(36)}`;
  }
  return `acc_${normDest}_${normName}_${normSource}`;
}

export function computeAccommodationRequestHash(tripId: string, specification: AccommodationSearchSpecification): string {
  const payload = {
    tripId,
    destination: specification.destination,
    dates: specification.dates,
    group: specification.group,
    budget: specification.budget,
    searchStrategies: specification.searchStrategies.map((s) => ({ concept: s.concept, propertyTypes: s.propertyTypes })),
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
  const isFailure = meta && ["rate_limited", "error", "provider_unavailable"].includes(meta.status);
  const existingHotels = Array.isArray(previous.hotels) ? previous.hotels : [];
  const finalHotels = isFailure && existingHotels.length > 0 ? existingHotels : hotels;
  return {
    ...previous,
    hotels: finalHotels,
    hotelVotes: Array.isArray(previous.hotelVotes)
      ? previous.hotelVotes.filter((vote: any) => finalHotels.some((hotel: any) => hotel.id === vote.hotelId))
      : [],
    selectedHotelId: finalHotels.some((hotel: any) => hotel.id === previous.selectedHotelId) ? previous.selectedHotelId : null,
    hotelProviderErrors: providerErrors,
    hotelsGeneratedAt: isFailure ? previous.hotelsGeneratedAt ?? new Date().toISOString() : new Date().toISOString(),
    accommodationGeneration: meta ?? previous.accommodationGeneration ?? null,
  };
}

const safeHttps = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};
const responseText = (payload: any) => (payload?.candidates?.[0]?.content?.parts ?? []).map((part: any) => part?.text ?? "").join("");
const jsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
};

// Legacy grounded normalizer kept for existing tests/compatibility while this branch validates Tavily.
export function normalizeAccommodationCandidates(payload: any, specification: AccommodationSearchSpecification): AccommodationCandidate[] {
  const parsed = jsonObject(responseText(payload));
  const groundedUrls = new Set(
    (payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []).map((chunk: any) => chunk?.web?.uri).filter(safeHttps),
  );
  const concepts = new Set(specification.searchStrategies.map((strategy) => strategy.concept));
  const seen = new Set<string>();
  return (Array.isArray(parsed?.properties) ? parsed.properties : []).flatMap((raw: any) => {
    const url = safeHttps(raw?.url) ? raw.url : null;
    const source = String(raw?.source ?? "").trim();
    const name = String(raw?.name ?? "").trim();
    const concept = raw?.krewConcept as AccommodationConceptId;
    if (!url || !source || !name || !concepts.has(concept)) return [];
    const host = new URL(url).hostname;
    if (![...groundedUrls].some((grounded) => new URL(grounded).hostname === host)) return [];
    const dedupe = `${name.toLowerCase()}|${host}`;
    if (seen.has(dedupe)) return [];
    seen.add(dedupe);
    const capacity = Number.isFinite(Number(raw.capacity)) ? Number(raw.capacity) : null;
    const bedrooms = Number.isFinite(Number(raw.bedrooms)) ? Number(raw.bedrooms) : null;
    const rating = Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null;
    const pricePerPerson = Number.isFinite(Number(raw.pricePerPerson)) ? Number(raw.pricePerPerson) : null;
    const priceStatus = ["verified", "estimated", "unknown"].includes(raw.priceStatus) ? raw.priceStatus : "unknown";
    if (capacity != null && capacity < specification.group.size) return [];
    if (bedrooms != null && bedrooms < specification.group.targetBedrooms) return [];
    if (rating != null && specification.minimumRating != null && rating < specification.minimumRating) return [];
    if (pricePerPerson != null && priceStatus !== "unknown" && specification.budget.hardMaxPerPersonStay != null && pricePerPerson > specification.budget.hardMaxPerPersonStay) return [];
    const amenities = Array.isArray(raw.amenities) ? raw.amenities.map(String) : [];
    if (specification.requiredAmenities.some((required) => !amenities.some((item) => item.toLowerCase().includes(required.toLowerCase())))) return [];
    return [{
      id: String(raw.id || `${concept}-${seen.size}`),
      name,
      propertyType: String(raw.propertyType ?? "unknown"),
      krewConcept: concept,
      location: { city: raw.location?.city ? String(raw.location.city) : null, area: raw.location?.area ? String(raw.location.area) : null, address: raw.location?.address ? String(raw.location.address) : null },
      capacity,
      bedrooms,
      roomConfiguration: raw.roomConfiguration ? String(raw.roomConfiguration) : null,
      rating,
      reviewCount: Number.isFinite(Number(raw.reviewCount)) ? Number(raw.reviewCount) : null,
      amenities,
      totalStayPrice: Number.isFinite(Number(raw.totalStayPrice)) ? Number(raw.totalStayPrice) : null,
      pricePerPerson,
      priceStatus,
      availabilityStatus: ["verified", "unverified", "unknown"].includes(raw.availabilityStatus) ? raw.availabilityStatus : "unknown",
      url,
      source,
      imageUrl: safeHttps(raw.imageUrl) && groundedUrls.has(raw.imageUrl) ? raw.imageUrl : null,
      imageSource: safeHttps(raw.imageUrl) && groundedUrls.has(raw.imageUrl) && raw.imageSource ? String(raw.imageSource) : null,
      matchReasons: Array.isArray(raw.matchReasons) ? raw.matchReasons.map(String).slice(0, 3) : [],
    }];
  }).slice(0, 6);
}

type TavilyResult = { title?: string; url?: string; content?: string; score?: number };

function words(value: string): string[] {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isExplicitlyOutsideDestination(
  blob: string,
  specification: AccommodationSearchSpecification,
): boolean {
  const normBlob = normalizeText(blob);
  const normDest = normalizeText(specification.destination.name);

  if (normBlob.includes(normDest)) {
    return false;
  }

  const stopWords = new Set([
    "louer", "partir", "proximite", "cote", "coteau", "la", "le", "les", "des", "du",
    "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "pied", "vapeur", "manger", "traiter", "venir", "savoir", "privatif", "seul",
    "partager", "plusieurs", "moins", "disposition", "souhait", "volonte"
  ]);

  if (/\b\d{5}\b/.test(normBlob)) {
    return true;
  }

  const locMatches = normBlob.matchAll(/\b(?:a|à|in|en|situe a|situee a|situé à|située à)\s+([a-z0-9'-]{3,})/gi);
  for (const match of locMatches) {
    const locality = match[1]?.toLowerCase();
    if (locality && !stopWords.has(locality) && locality !== normDest) {
      return true;
    }
  }

  const locWithArticleMatches = normBlob.matchAll(/\b(?:a|à|in|en)\s+(?:la|le|les|l'|d'|du)\s+([a-z0-9'-]{3,})/gi);
  for (const match of locWithArticleMatches) {
    const locality = match[1]?.toLowerCase();
    if (locality && !stopWords.has(locality) && locality !== normDest) {
      return true;
    }
  }

  return false;
}

function pickStrategy(result: TavilyResult, specification: AccommodationSearchSpecification) {
  const blob = words(`${result.title ?? ""} ${result.content ?? ""}`).join(" ");
  return [...specification.searchStrategies].sort((a, b) => {
    const signal = (s: AccommodationSearchSpecification["searchStrategies"][number]) =>
      s.score + [...s.propertyTypes, ...s.mustHave, ...s.preferred].reduce((sum, term) => sum + (words(term).some((w) => blob.includes(w)) ? 8 : 0), 0);
    return signal(b) - signal(a);
  })[0] ?? null;
}

function parseCapacity(blob: string): number | null {
  const match = blob.match(/(?:sleeps?|accommodates?|for)\s+(\d{1,2})\s+(?:guests?|people|persons?)/i) || blob.match(/(\d{1,2})\s+(?:guests?|people|persons?)/i);
  return match ? Number(match[1]) : null;
}
function parseBedrooms(blob: string): number | null {
  const match = blob.match(/(\d{1,2})\s+(?:bedrooms?|bed rooms?|chambres?)/i);
  return match ? Number(match[1]) : null;
}
function parseRating(blob: string): number | null {
  const match10 = blob.match(/(?:rated?|rating|note)\s*[:\-]?\s*(\d(?:\.\d+)?)\s*\/\s*10/i);
  if (match10) return Number(match10[1]);
  const match5 = blob.match(/(?:rated?|rating|note)\s*[:\-]?\s*(\d(?:\.\d+)?)\s*\/\s*5/i);
  return match5 ? Number(match5[1]) : null;
}

export function normalizeTavilyAccommodationResults(payload: any, specification: AccommodationSearchSpecification): AccommodationCandidate[] {
  const results = Array.isArray(payload?.results) ? payload.results as TavilyResult[] : [];
  const seen = new Set<string>();
  return results
    .filter((result) => safeHttps(result.url) && String(result.title ?? "").trim() && Number(result.score ?? 0) >= 0.2)
    .flatMap((result) => {
      const url = result.url!;
      const host = new URL(url).hostname.replace(/^www\./, "");
      const name = String(result.title).split(/\s+[|–—-]\s+/)[0]!.trim().slice(0, 140);
      const dedupe = `${name.toLowerCase()}|${host}`;
      if (seen.has(dedupe)) return [];
      seen.add(dedupe);
      const strategy = pickStrategy(result, specification);
      if (!strategy) return [];
      const blob = `${result.title ?? ""} ${result.content ?? ""}`;
      if (isExplicitlyOutsideDestination(blob, specification)) return [];
      const capacity = parseCapacity(blob);
      const bedrooms = parseBedrooms(blob);
      const rating = parseRating(blob);
      const explicitAmenities = [...new Set([...specification.requiredAmenities, ...strategy.mustHave, ...strategy.preferred])]
        .filter((term) => words(term).some((w) => words(blob).includes(w)));
      if (capacity != null && capacity < specification.group.size) return [];
      if (bedrooms != null && bedrooms < specification.group.targetBedrooms) return [];
      if (rating != null && specification.minimumRating != null) {
        const normalizedRating = rating <= 5 ? rating : rating / 2;
        if (normalizedRating < specification.minimumRating) return [];
      }
      if (specification.requiredAmenities.some((required) => !explicitAmenities.some((found) => words(found).some((w) => words(required).includes(w) || words(required).some((rw) => rw === w))))) return [];
      const propertyType = strategy.propertyTypes.find((type) => words(type).some((w) => words(blob).includes(w))) ?? strategy.propertyTypes[0] ?? "unknown";
      return [{
        id: buildCanonicalAccommodationExternalId(specification.destination.name, { name, url, source: host }),
        name,
        propertyType,
        krewConcept: strategy.concept,
        location: { city: null, area: null, address: null },
        capacity,
        bedrooms,
        roomConfiguration: null,
        rating,
        reviewCount: null,
        amenities: explicitAmenities,
        totalStayPrice: null,
        pricePerPerson: null,
        priceStatus: "unknown" as const,
        availabilityStatus: "unverified" as const,
        url,
        source: host,
        imageUrl: null,
        imageSource: null,
        matchReasons: [
          `Recherche web Tavily ${(Number(result.score ?? 0) * 100).toFixed(0)}%`,
          `Concept ${strategy.concept}`,
          ...strategy.preferred.filter((term) => words(term).some((w) => words(blob).includes(w))).slice(0, 1),
        ].slice(0, 3),
      }];
    })
    .slice(0, 6);
}

async function generateTavilyQuery(specification: AccommodationSearchSpecification, apiKey: string): Promise<string> {
  const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
  const prompt = `KREW a déjà calculé/scoré la stratégie d'hébergement. Tu NE cherches PAS sur le Web et tu NE proposes PAS d'établissement.
Transforme uniquement la spécification ci-dessous en UNE requête Tavily très performante, naturelle et concise, de maximum 380 caractères.
RÈGLES DE PRIORITÉ ABSOLUES :
1. GÉOGRAPHIE D'ABORD.
La requête DOIT toujours contenir explicitement destination.name.
Ajoute destination.country seulement si cela aide à désambiguïser.
Ne remplace jamais une destination précise par un pays ou une zone trop large.
Exemple :
destination = Annecy
BON : "Annecy lac d'Annecy Haute-Savoie chalet 5 personnes"
MAUVAIS : "chalet nature 5 personnes France"
MAUVAIS : "chalet Alpes françaises 5 personnes"
2. Respecte locationIntent :
- hyper_central : cherche dans la ville exacte, centre / centre-ville.
- central : cherche dans la ville exacte ou son immédiate proximité urbaine.
- near_activity_hub : garde destination.name comme ancre obligatoire et autorise seulement son bassin immédiat pertinent.
- regional_flexible : garde destination.name comme ancre obligatoire et peux ajouter son territoire local directement associé : lac, vallée, massif, département ou communes voisines. N'élargis jamais à une autre région touristique sans lien direct.
- remote_desired : cherche un logement plus isolé autour du territoire de destination, mais conserve toujours une ancre géographique explicite vers destination.name ou son territoire immédiat.
regional_flexible et remote_desired ne signifient JAMAIS "n'importe où dans le pays".
3. Ensuite, privilégie les types de logements des searchStrategies les mieux scorées.
Utilise les propertyTypes fournies. Ne crée aucun nouveau concept.
4. Ensuite seulement, ajoute les contraintes les plus discriminantes si elles tiennent dans la limite :
taille du groupe, dates, chambres, mustHave, budget, note minimale et autres contraintes dures.
5. Ne dilue jamais la destination pour ajouter des critères secondaires.
Si tu dois raccourcir, conserve dans cet ordre :
destination / territoire acceptable > type de logement > taille du groupe > dates > contraintes dures > critères secondaires.
6. La requête doit ressembler à une vraie recherche Web.
Évite la prose marketing ou conceptuelle.
BON : "Annecy lac d'Annecy Haute-Savoie chalet gîte 5 personnes 28-30 août"
MAUVAIS : "hébergement nature convivial parfait pour un groupe sportif"
7. Ne mets aucun commentaire, aucune explication et aucun établissement.
Retourne strictement :
{"searchQuery":"..."}
Spécification=${JSON.stringify(specification)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
  });
  const body = await response.text();
  if (!response.ok) {
    if (response.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(body)) throw new Error("gemini_accommodation_429:rate_limited");
    throw new Error(`gemini_accommodation_query_http_${response.status}:${body.slice(0, 160)}`);
  }
  const parsed = jsonObject(responseText(JSON.parse(body)));
  const query = String(parsed?.searchQuery ?? "").replace(/\s+/g, " ").trim();
  if (!query) throw new Error("gemini_accommodation_empty_query");
  return query.slice(0, 380);
}

export async function searchAccommodationsWithGemini(specification: AccommodationSearchSpecification): Promise<AccommodationCandidate[]> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  const tavilyKey = process.env["TAVILY_API_KEY"];
  if (!geminiKey) throw new Error("no_gemini_key");
  if (!tavilyKey) throw new Error("no_tavily_key");

  const searchQuery = await generateTavilyQuery(specification, geminiKey);
  const tavilyResponse = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
    body: JSON.stringify({
      query: searchQuery,
      search_depth: "basic",
      auto_parameters: false,
      topic: "general",
      max_results: 20,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_usage: true,
    }),
  });
  const body = await tavilyResponse.text();
  if (!tavilyResponse.ok) {
    if (tavilyResponse.status === 429) throw new Error("tavily_accommodation_429:rate_limited");
    throw new Error(`tavily_accommodation_http_${tavilyResponse.status}:${body.slice(0, 160)}`);
  }
  const payload = JSON.parse(body);
  console.info("accommodation-web-search", {
    destination: specification.destination.name,
    geminiCalls: 1,
    webSearchCalls: 1,
    tavilyCredits: Number(payload?.usage?.credits ?? 1),
    resultCount: Array.isArray(payload?.results) ? payload.results.length : 0,
    queryLength: searchQuery.length,
  });
  return normalizeTavilyAccommodationResults(payload, specification);
}
