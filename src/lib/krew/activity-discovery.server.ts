/* eslint-disable @typescript-eslint/no-explicit-any -- external provider payloads are normalized at the boundary */
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
  country?: string | null;
  startDate?: string | null;
  eventType?: string | null;
  tripProfile?: string | null;
  ambiances: string[];
  activityCategories: string[];
  starWanted?: string[];
  individualPreferences?: { activityCategories?: string[]; isStar?: boolean; weight?: number }[];
  budgetPerPerson: number;
  travelPace?: string | null;
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
  forceRefresh?: boolean;
};

type CacheEntry = { expiresAt: number; candidates: ActivityCandidate[]; days: any[] };
type TavilyResult = { title?: string; url?: string; content?: string; score?: number };
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const getModel = () => process.env["GEMINI_GROUNDED_MODEL"] || "gemini-2.5-flash";

const norm = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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
  const signal = norm([input.tripProfile, ...input.ambiances, ...input.activityCategories].join(" "));
  if (/nature|sport|aventure|outdoor|montagne|lac|mer/.test(signal))
    return ["activité outdoor locale", "sport de plein air", "activité nautique ou randonnée", "prestataire aventure groupe"];
  if (/maison|villa|chill|cocoon|detente/.test(signal))
    return ["brunch de groupe", "traiteur barbecue", "spa ou bien-être", "activité douce proche du logement"];
  if (/culture|urbain|ville|decouverte/.test(signal))
    return ["visite culturelle originale", "expérience locale", "restaurant de groupe", "bar local"];
  return ["expérience locale groupe", "activité caractéristique", "restaurant de groupe", "bar ou soirée"];
}

/** Legacy helper kept because tests and diagnostics use it. Discovery itself now executes one Tavily query only. */
export function buildDiscoveryQueries(input: ActivityDiscoveryInput): string[] {
  const event = norm(input.eventType);
  const terms = [...profileTerms(input), ...input.activityCategories.slice(0, 4), ...(input.starWanted ?? []).slice(0, 3)];
  if (/evg|evjf/.test(event)) terms.push(`activité ${event} groupe`, "activité signature groupe", "brunch groupe", "bar cocktails groupe");
  else if (event === "anniversaire") terms.push("activité anniversaire groupe", "restaurant anniversaire", "soirée anniversaire");
  return [...new Set(terms.map((term) => `${term} ${input.destination}${input.country ? ` ${input.country}` : ""}`))].slice(0, 10);
}

function cacheKey(input: ActivityDiscoveryInput) {
  return norm(JSON.stringify({ ...input, forceRefresh: false }));
}

function responseText(payload: any): string {
  return (payload?.candidates?.[0]?.content?.parts ?? []).map((part: any) => part?.text ?? "").join("");
}
function parseJson(raw: string): any {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

/** Legacy Gemini-grounding normalizers retained only for backwards-compatible tests; production discovery no longer calls them. */
export function extractGroundingSources(payload: any, kind: "search" | "maps" = "search"): GroundingSource[] {
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks.map((chunk: any) => ({
    title: String(chunk?.web?.title ?? chunk?.maps?.title ?? "Source"),
    url: String(chunk?.web?.uri ?? chunk?.maps?.uri ?? ""),
    kind,
  })).filter((source: GroundingSource) => isSafeActivityUrl(source.url));
  return [...new Map(sources.map((source: GroundingSource) => [source.url, source])).values()] as GroundingSource[];
}

function relatedSources(raw: any, sources: GroundingSource[]): GroundingSource[] {
  const name = norm(raw?.name);
  const rawUrls = [raw?.sourceUrl, raw?.mapsUrl].filter(isSafeActivityUrl) as string[];
  return sources.filter((source) => {
    if (rawUrls.includes(source.url)) return true;
    const title = norm(source.title);
    let sourceHost = "";
    try { sourceHost = new URL(source.url).hostname.replace(/^www\./, ""); } catch { return false; }
    const rawHostMatch = rawUrls.some((url) => {
      try { return new URL(url).hostname.replace(/^www\./, "") === sourceHost; } catch { return false; }
    });
    const words = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 4);
    return rawHostMatch || (words.length > 0 && words.filter((word) => title.includes(word)).length >= Math.min(2, words.length));
  }).slice(0, 5);
}

function score(raw: any, input: ActivityDiscoveryInput) {
  const blob = norm([raw.name, raw.category, raw.description, ...(raw.tags ?? [])].join(" "));
  const profile = norm([input.tripProfile, ...input.ambiances, ...input.activityCategories].join(" "));
  const starHits = (input.starWanted ?? []).filter((wanted) => blob.includes(norm(wanted))).length;
  const categoryHits = input.activityCategories.filter((wanted) => blob.includes(norm(wanted))).length;
  const outdoorBoost = /nature|sport|aventure/.test(profile) && /outdoor|kayak|paddle|randon|velo|rafting|canyon|escalade|voile|ski/.test(blob) ? 35 : 0;
  const event = norm(input.eventType);
  const eventFit = /evg|evjf/.test(event) ? (/groupe|evg|evjf|signature|festif|soir/.test(blob) ? 85 : 45) : event === "anniversaire" ? (/anniversaire|special|festif/.test(blob) ? 85 : 50) : 55;
  return { profileFit: Math.min(100, 35 + categoryHits * 15 + starHits * 22 + outdoorBoost), eventFit };
}

export function normalizeSearchCandidates(payload: any, input: ActivityDiscoveryInput): ActivityCandidate[] {
  const parsed = parseJson(responseText(payload));
  const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const grounded = extractGroundingSources(payload, "search");
  const now = new Date().toISOString();
  const result: ActivityCandidate[] = [];
  for (const raw of rawCandidates) {
    const name = String(raw?.name ?? "").trim();
    const linked = relatedSources(raw, grounded);
    const sourceUrl = linked.some((source) => source.url === raw?.sourceUrl) ? raw.sourceUrl : linked[0]?.url;
    if (!name || !sourceUrl || !linked.length) continue;
    result.push({
      id: String(raw?.id || `${norm(name).replace(/[^a-z0-9]+/g, "-")}:${result.length}`), name: name.slice(0, 120), type: "external",
      category: String(raw.category ?? "activite").slice(0, 60), description: raw.description ? String(raw.description).slice(0, 260) : null,
      destination: input.destination, address: null, latitude: null, longitude: null, sourceUrl, mapsUrl: null,
      source: String(raw.source ?? new URL(sourceUrl).hostname).slice(0, 80), priceHint: null, priceRange: null,
      durationMinutes: Number.isFinite(Number(raw.durationMinutes)) ? Math.max(15, Number(raw.durationMinutes)) : null,
      openingHours: [], rating: null, reviewCount: null,
      environment: ["indoor", "outdoor", "mixed"].includes(raw.environment) ? raw.environment : null,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [], ...score(raw, input),
      seasonality: raw.seasonality ? String(raw.seasonality).slice(0, 120) : null, verified: true, verifiedAt: now, groundingSources: linked,
    });
  }
  return [...new Map(result.map((candidate) => [norm(candidate.name), candidate])).values()]
    .sort((a, b) => b.profileFit + b.eventFit - (a.profileFit + a.eventFit)).slice(0, 24);
}

function words(value: string): string[] {
  return norm(value).split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
}
function inferCategory(blob: string, input: ActivityDiscoveryInput): string {
  const n = norm(blob);
  if (/restaurant|brunch|gastronom|diner|dejeuner/.test(n)) return "restaurant";
  if (/bar|cocktail|club|nightlife|soiree/.test(n)) return "bar";
  const matched = input.activityCategories.find((category) => words(category).some((word) => n.includes(word)));
  return matched || (/kayak|paddle|randon|rafting|velo|canyon|voile/.test(n) ? "sport_outdoor" : "activite");
}
function inferEnvironment(blob: string): ActivityCandidate["environment"] {
  const n = norm(blob);
  if (/outdoor|plein air|randon|kayak|paddle|lac|montagne|rafting|voile/.test(n)) return "outdoor";
  if (/museum|musee|spa|restaurant|bar|indoor|atelier/.test(n)) return "indoor";
  return null;
}

export function normalizeTavilyActivityResults(payload: any, input: ActivityDiscoveryInput): ActivityCandidate[] {
  const results = Array.isArray(payload?.results) ? payload.results as TavilyResult[] : [];
  const now = new Date().toISOString();
  const seen = new Set<string>();
  return results.filter((result) => isSafeActivityUrl(result.url) && String(result.title ?? "").trim() && Number(result.score ?? 0) >= 0.2)
    .flatMap((result) => {
      const url = result.url!;
      const host = new URL(url).hostname.replace(/^www\./, "");
      const name = String(result.title).split(/\s+[|–—-]\s+/)[0]!.trim().slice(0, 120);
      const key = `${norm(name)}|${host}`;
      if (!name || seen.has(key)) return [];
      seen.add(key);
      const blob = `${result.title ?? ""} ${result.content ?? ""}`;
      const category = inferCategory(blob, input);
      const fit = score({ name, category, description: result.content, tags: [] }, input);
      return [{
        id: `act_${Math.abs([...`${url}|${name}`].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)).toString(36)}`,
        name, type: "external" as const, category, description: result.content ? String(result.content).slice(0, 260) : null,
        destination: input.destination, address: null, latitude: null, longitude: null, sourceUrl: url, mapsUrl: null, source: host,
        priceHint: null, priceRange: null, durationMinutes: null, openingHours: [], rating: null, reviewCount: null,
        environment: inferEnvironment(blob), tags: [], ...fit, seasonality: null, verified: true, verifiedAt: now,
        groundingSources: [{ title: String(result.title), url, kind: "search" as const }],
      }];
    })
    .sort((a, b) => (b.profileFit + b.eventFit) - (a.profileFit + a.eventFit)).slice(0, 24);
}

async function generateTavilyQuery(input: ActivityDiscoveryInput, apiKey: string): Promise<string> {
  const prompt = `KREW a déjà calculé le profil et les préférences du groupe. Tu NE cherches PAS sur le Web et tu NE proposes PAS de lieu. Transforme uniquement ce contexte en UNE requête Tavily très performante (max 380 caractères) pour trouver un corpus varié de vraies activités, restaurants et sorties adaptées au séjour. Priorise destination, profil, activités majoritaires, souhaits Star, type d'événement, âge, rythme, budget et contraintes alimentaires. Une seule requête, pas une liste. Retourne strictement JSON {"searchQuery":"..."}. Contexte=${JSON.stringify(input)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`gemini_activity_query_http_${response.status}:${body.slice(0, 160)}`);
  const parsed = parseJson(responseText(JSON.parse(body)));
  const query = String(parsed?.searchQuery ?? "").replace(/\s+/g, " ").trim();
  if (!query) throw new Error("gemini_activity_empty_query");
  return query.slice(0, 380);
}

export async function discoverActivities(input: ActivityDiscoveryInput): Promise<{ candidates: ActivityCandidate[]; days: any[]; cached: boolean; error?: string }> {
  const key = cacheKey(input);
  const cached = discoveryCache.get(key);
  if (!input.forceRefresh && cached && cached.expiresAt > Date.now()) return { candidates: cached.candidates, days: cached.days, cached: true };
  const geminiKey = process.env["GEMINI_API_KEY"];
  const tavilyKey = process.env["TAVILY_API_KEY"];
  if (!geminiKey) return { candidates: [], days: [], cached: false, error: "no_gemini_key" };
  // Tavily is decoupled from planning. Return empty candidates without error.
  if (!tavilyKey) return { candidates: [], days: [], cached: false };
  try {
    const searchQuery = await generateTavilyQuery(input, geminiKey);
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
      body: JSON.stringify({ query: searchQuery, search_depth: "basic", auto_parameters: false, topic: "general", max_results: 20, include_answer: false, include_raw_content: false, include_images: false, include_usage: true }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`tavily_activity_http_${response.status}:${body.slice(0, 160)}`);
    const payload = JSON.parse(body);
    const candidates = normalizeTavilyActivityResults(payload, input);
    const days: any[] = [];
    console.info("activity-web-search", { destination: input.destination, geminiCalls: 1, webSearchCalls: 1, tavilyCredits: Number(payload?.usage?.credits ?? 1), candidateCount: candidates.length, queryLength: searchQuery.length, cached: false });
    discoveryCache.set(key, { candidates, days, expiresAt: Date.now() + CACHE_TTL_MS });
    return { candidates, days, cached: false };
  } catch (error) {
    reportServerError(error, { provider: "tavily", model: getModel(), kind: "activity-discovery-search", destination: input.destination, fallback: true });
    return { candidates: [], days: [], cached: false, error: String(error).slice(0, 180) };
  }
}
