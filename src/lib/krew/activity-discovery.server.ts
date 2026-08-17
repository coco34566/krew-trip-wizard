/* eslint-disable @typescript-eslint/no-explicit-any -- Gemini payloads are normalized before entering KREW */
import { reportServerError } from "@/lib/server-error-reporting.server";

export type GroundingSource = { title: string; url: string; kind?: "search" | "maps" };
export type ActivityCandidate = {
  id: string;
  name: string;
  type: "external";
  category: string;
  description: string | null;
  destination: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string;
  mapsUrl: string | null;
  source: string;
  priceHint: number | null;
  priceRange: string | null;
  durationMinutes: number | null;
  openingHours: string[];
  rating: number | null;
  reviewCount: number | null;
  environment: "indoor" | "outdoor" | "mixed" | null;
  tags: string[];
  profileFit: number;
  eventFit: number;
  seasonality: string | null;
  verified: boolean;
  verifiedAt: string;
  groundingSources: GroundingSource[];
};

export type ActivityDiscoveryInput = {
  destination: string;
  country?: string | null | undefined;
  startDate?: string | null | undefined;
  eventType?: string | null | undefined;
  tripProfile?: string | null | undefined;
  ambiances: string[];
  activityCategories: string[];
  starWanted?: string[] | undefined;
  individualPreferences?:
    { activityCategories?: string[]; isStar?: boolean; weight?: number }[] | undefined;
  budgetPerPerson: number;
  travelPace?: string | null | undefined;
  endDate?: string | null;
  nights?: number;
  participants?: number;
  groupAgeRange?: string | null;
  dietaryConstraints?: string[];
  preferredTimeSlots?: string[];
  wantedEnvTypes?: string[];
  starWantedEnvType?: string | null;
  matchReasons?: string[];
  arrivalReady?: string | null;
  latestReturnHome?: string | null;
  latestDestinationDeparture?: string | null;
  transportPicksSummary?: unknown[];
  forceRefresh?: boolean | undefined;
};

type CacheEntry = { expiresAt: number; candidates: ActivityCandidate[]; days: any[] };
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MODEL = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";

const norm = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function isSafeActivityUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !/^(example\.com|localhost)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function profileTerms(input: ActivityDiscoveryInput): string[] {
  const signal = norm(
    [input.tripProfile, ...input.ambiances, ...input.activityCategories].join(" "),
  );
  if (/nature|sport|aventure|outdoor|montagne|lac|mer/.test(signal))
    return [
      "activité outdoor locale",
      "sport de plein air",
      "activité nautique ou randonnée",
      "prestataire aventure groupe",
    ];
  if (/maison|villa|chill|cocoon|detente/.test(signal))
    return [
      "brunch de groupe",
      "traiteur barbecue",
      "spa ou bien-être",
      "activité douce proche du logement",
    ];
  if (/culture|urbain|ville|decouverte/.test(signal))
    return [
      "visite culturelle originale",
      "expérience locale",
      "restaurant de groupe",
      "bar local",
    ];
  return [
    "expérience locale groupe",
    "activité caractéristique",
    "restaurant de groupe",
    "bar ou soirée",
  ];
}

export function buildDiscoveryQueries(input: ActivityDiscoveryInput): string[] {
  const event = norm(input.eventType);
  const terms = [
    ...profileTerms(input),
    ...input.activityCategories.slice(0, 4),
    ...(input.starWanted ?? []).slice(0, 3),
  ];
  if (/evg|evjf/.test(event))
    terms.push(
      `activité ${event} groupe`,
      "activité signature groupe",
      "brunch groupe",
      "bar cocktails groupe",
    );
  else if (event === "anniversaire")
    terms.push("activité anniversaire groupe", "restaurant anniversaire", "soirée anniversaire");
  return [
    ...new Set(
      terms.map(
        (term) => `${term} ${input.destination}${input.country ? ` ${input.country}` : ""}`,
      ),
    ),
  ].slice(0, 10);
}

function cacheKey(input: ActivityDiscoveryInput, queries: string[]) {
  return norm(JSON.stringify({ ...input, forceRefresh: false, queries }));
}

async function callGemini(apiKey: string, prompt: string): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // REST uses the protobuf JSON field names. Grounded calls deliberately do not
        // request responseMimeType: structured output is reserved for composition.
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok)
    throw new Error(`gemini_discovery_search_http_${response.status}:${text.slice(0, 180)}`);
  return JSON.parse(text);
}

function responseText(payload: any): string {
  return (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part: any) => part?.text ?? "")
    .join("");
}

function parseJson(raw: string): any {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function extractGroundingSources(
  payload: any,
  kind: "search" | "maps" = "search",
): GroundingSource[] {
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((chunk: any) => ({
      title: String(
        chunk?.web?.title ??
          chunk?.maps?.title ??
          chunk?.maps?.placeAnswerSources?.[0]?.reviewSnippets?.[0]?.title ??
          "Source",
      ),
      url: String(chunk?.web?.uri ?? chunk?.maps?.uri ?? ""),
      kind,
    }))
    .filter((source: GroundingSource) => isSafeActivityUrl(source.url));
  return [
    ...new Map(sources.map((source: GroundingSource) => [source.url, source])).values(),
  ] as GroundingSource[];
}

function relatedSources(raw: any, sources: GroundingSource[]): GroundingSource[] {
  const name = norm(raw?.name);
  const rawUrls = [raw?.sourceUrl, raw?.mapsUrl].filter(isSafeActivityUrl) as string[];
  return sources
    .filter((source) => {
      if (rawUrls.includes(source.url)) return true;
      const title = norm(source.title);
      let sourceHost = "";
      try {
        sourceHost = new URL(source.url).hostname.replace(/^www\./, "");
      } catch {
        return false;
      }
      const rawHostMatch = rawUrls.some((url) => {
        try {
          return new URL(url).hostname.replace(/^www\./, "") === sourceHost;
        } catch {
          return false;
        }
      });
      const words = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
      return (
        rawHostMatch ||
        (words.length > 0 &&
          words.filter((word) => title.includes(word)).length >= Math.min(2, words.length))
      );
    })
    .slice(0, 5);
}

function score(raw: any, input: ActivityDiscoveryInput) {
  const blob = norm([raw.name, raw.category, raw.description, ...(raw.tags ?? [])].join(" "));
  const profile = norm(
    [input.tripProfile, ...input.ambiances, ...input.activityCategories].join(" "),
  );
  const starHits = (input.starWanted ?? []).filter((wanted) => blob.includes(norm(wanted))).length;
  const categoryHits = input.activityCategories.filter((wanted) =>
    blob.includes(norm(wanted)),
  ).length;
  const outdoorBoost =
    /nature|sport|aventure/.test(profile) &&
    /outdoor|kayak|paddle|randon|velo|rafting|canyon|escalade|voile|ski/.test(blob)
      ? 35
      : 0;
  const event = norm(input.eventType);
  const eventFit = /evg|evjf/.test(event)
    ? /groupe|evg|evjf|signature|festif|soir/.test(blob)
      ? 85
      : 45
    : event === "anniversaire"
      ? /anniversaire|special|festif/.test(blob)
        ? 85
        : 50
      : 55;
  return {
    profileFit: Math.min(100, 35 + categoryHits * 15 + starHits * 22 + outdoorBoost),
    eventFit,
  };
}

export function normalizeSearchCandidates(
  payload: any,
  input: ActivityDiscoveryInput,
): ActivityCandidate[] {
  const parsed = parseJson(responseText(payload));
  const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const grounded = extractGroundingSources(payload, "search");
  const now = new Date().toISOString();
  const result: ActivityCandidate[] = [];
  for (const raw of rawCandidates) {
    const name = String(raw?.name ?? "").trim();
    const linked = relatedSources(raw, grounded);
    const sourceUrl = linked.some((source) => source.url === raw?.sourceUrl)
      ? raw.sourceUrl
      : linked[0]?.url;
    if (!name || !sourceUrl || !linked.length) continue;
    const fit = score(raw, input);
    result.push({
      id: String(raw?.id || `${norm(name).replace(/[^a-z0-9]+/g, "-")}:${result.length}`),
      name: name.slice(0, 120),
      type: "external",
      category: String(raw.category ?? "activite").slice(0, 60),
      description: raw.description ? String(raw.description).slice(0, 260) : null,
      destination: input.destination,
      address: null,
      latitude: null,
      longitude: null,
      sourceUrl,
      mapsUrl: null,
      source: String(raw.source ?? new URL(sourceUrl).hostname).slice(0, 80),
      // Search prose is not a reliable structured price/opening-hours source.
      priceHint: null,
      priceRange: null,
      durationMinutes: Number.isFinite(Number(raw.durationMinutes))
        ? Math.max(15, Number(raw.durationMinutes))
        : null,
      openingHours: [],
      rating: null,
      reviewCount: null,
      environment: ["indoor", "outdoor", "mixed"].includes(raw.environment)
        ? raw.environment
        : null,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
      ...fit,
      seasonality: raw.seasonality ? String(raw.seasonality).slice(0, 120) : null,
      verified: true,
      verifiedAt: now,
      groundingSources: linked,
    });
  }
  return [...new Map(result.map((candidate) => [norm(candidate.name), candidate])).values()]
    .sort((a, b) => b.profileFit + b.eventFit - (a.profileFit + a.eventFit))
    .slice(0, 24);
}

function applyMapsPayload(candidate: ActivityCandidate, payload: any): ActivityCandidate {
  const parsed = parseJson(responseText(payload));
  const raw = parsed?.place ?? parsed;
  const sources = relatedSources(
    { name: candidate.name, mapsUrl: raw?.mapsUrl, sourceUrl: raw?.sourceUrl },
    extractGroundingSources(payload, "maps"),
  );
  if (!raw || !sources.length) return candidate;
  const mapsUrl = isSafeActivityUrl(raw.mapsUrl) ? raw.mapsUrl : (sources[0]?.url ?? null);
  return {
    ...candidate,
    address: raw.address ? String(raw.address).slice(0, 180) : candidate.address,
    latitude: Number.isFinite(Number(raw.latitude)) ? Number(raw.latitude) : candidate.latitude,
    longitude: Number.isFinite(Number(raw.longitude)) ? Number(raw.longitude) : candidate.longitude,
    mapsUrl,
    openingHours: Array.isArray(raw.openingHours) ? raw.openingHours.map(String).slice(0, 14) : [],
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
    reviewCount: Number.isFinite(Number(raw.reviewCount)) ? Number(raw.reviewCount) : null,
    // Prices remain unknown unless discovery supplied an explicitly grounded price (not requested here).
    priceHint: null,
    priceRange: null,
    verified: true,
    groundingSources: [
      ...new Map(
        [...candidate.groundingSources, ...sources].map((source) => [source.url, source]),
      ).values(),
    ].slice(0, 6),
  };
}

export async function discoverActivities(
  input: ActivityDiscoveryInput,
): Promise<{ candidates: ActivityCandidate[]; days: any[]; cached: boolean; error?: string }> {
  const queries = buildDiscoveryQueries(input);
  const key = cacheKey(input, queries);
  const cached = discoveryCache.get(key);
  if (!input.forceRefresh && cached && cached.expiresAt > Date.now())
    return { candidates: cached.candidates, days: cached.days, cached: true };
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return { candidates: [], days: [], cached: false, error: "no_gemini_key" };
  const searchPrompt = `Discovery ET composition grounded KREW en un seul résultat. Spécification=${JSON.stringify({ ...input, queries, expectedDays: (input.nights ?? 0) + 1 })}. Retourne {"candidates":[{"id":"stable","name":"","category":"","description":"","sourceUrl":"URL réellement trouvée","source":"","durationMinutes":null,"environment":"indoor|outdoor|mixed|null","tags":[],"seasonality":null}],"days":[{"day":1,"date":null,"slots":[{"time":"HH:mm","endTime":"HH:mm","type":"activite","category":"culture","label":"","durationMinutes":90,"candidateId":"id candidat ou null","internal":false}]}]}. Tout slot externe référence exclusivement un candidateId de candidates. Moments internes: internal=true et category moment_maison|jeu_groupe|evenement|temps_libre|transport. Respecte arrivalReady et latestDestinationDeparture. N'invente aucun fait; null/[] si inconnu.`;
  try {
    const searchPayload = await callGemini(apiKey, searchPrompt);
    const candidates = normalizeSearchCandidates(searchPayload, input);
    const parsed = parseJson(responseText(searchPayload));
    const days = Array.isArray(parsed?.days) ? parsed.days : [];
    console.info("activity-discovery-search", {
      candidateCount: candidates.length,
      destination: input.destination,
      fallback: false,
    });
    discoveryCache.set(key, { candidates, days, expiresAt: Date.now() + CACHE_TTL_MS });
    return { candidates, days, cached: false };
  } catch (error) {
    reportServerError(error, {
      provider: "gemini",
      model: MODEL,
      kind: "activity-discovery-search",
      destination: input.destination,
      fallback: true,
    });
    console.info("activity-discovery-search", {
      candidateCount: 0,
      destination: input.destination,
      fallback: true,
    });
    return { candidates: [], days: [], cached: false, error: String(error).slice(0, 180) };
  }
}
