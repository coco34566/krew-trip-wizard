/* eslint-disable @typescript-eslint/no-explicit-any -- Gemini payloads are normalized before entering KREW */
import { reportServerError } from "@/lib/server-error-reporting.server";

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
  verifiedAt: string;
  groundingSources: { title: string; url: string }[];
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
  forceRefresh?: boolean | undefined;
};

type CacheEntry = { expiresAt: number; candidates: ActivityCandidate[] };
const discoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MODEL = "gemini-2.5-flash";

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
  if (/nature|sport|aventure|outdoor|montagne|lac|mer/.test(signal)) {
    return [
      "activité outdoor locale",
      "sport de plein air",
      "activité nautique ou randonnée",
      "prestataire aventure groupe",
    ];
  }
  if (/maison|villa|chill|cocoon|detente|détente/.test(signal)) {
    return [
      "brunch de groupe",
      "traiteur barbecue",
      "spa ou bien-être",
      "activité douce proche du logement",
    ];
  }
  if (/culture|urbain|ville|decouverte|découverte/.test(signal)) {
    return [
      "visite culturelle originale",
      "expérience locale",
      "restaurant de groupe",
      "bar local",
    ];
  }
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
  const season = input.startDate?.slice(0, 7) ?? "any";
  return norm(
    [input.destination, season, input.tripProfile, input.eventType, ...queries].join("|"),
  );
}

async function callGemini(apiKey: string, prompt: string): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }, { google_maps: {} }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok)
    throw new Error(`gemini_discovery_http_${response.status}:${text.slice(0, 180)}`);
  return JSON.parse(text);
}

function responseText(payload: any): string {
  return (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part: any) => part?.text ?? "")
    .join("");
}

function groundingSources(payload: any): { title: string; url: string }[] {
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((chunk: any) => ({
      title: String(chunk?.web?.title ?? chunk?.maps?.title ?? "Source"),
      url: String(chunk?.web?.uri ?? chunk?.maps?.uri ?? ""),
    }))
    .filter((source: any) => isSafeActivityUrl(source.url));
  return [...new Map(sources.map((source: any) => [source.url, source])).values()] as {
    title: string;
    url: string;
  }[];
}

function score(raw: any, input: ActivityDiscoveryInput): { profileFit: number; eventFit: number } {
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
    /outdoor|kayak|paddle|randon|velo|vélo|rafting|canyon|escalade|voile|ski/.test(blob)
      ? 35
      : 0;
  const event = norm(input.eventType);
  const eventFit = /evg|evjf/.test(event)
    ? /groupe|evg|evjf|signature|festif|soir/.test(blob)
      ? 85
      : 45
    : event === "anniversaire"
      ? /anniversaire|special|spécial|festif/.test(blob)
        ? 85
        : 50
      : 55;
  return {
    profileFit: Math.min(100, 35 + categoryHits * 15 + starHits * 22 + outdoorBoost),
    eventFit,
  };
}

function normalizeCandidates(payload: any, input: ActivityDiscoveryInput): ActivityCandidate[] {
  let parsed: any;
  try {
    parsed = JSON.parse(responseText(payload));
  } catch {
    return [];
  }
  const rawCandidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const grounded = groundingSources(payload);
  const now = new Date().toISOString();
  const result: ActivityCandidate[] = [];
  for (const raw of rawCandidates) {
    const name = String(raw?.name ?? "").trim();
    const sourceUrl = isSafeActivityUrl(raw?.sourceUrl) ? raw.sourceUrl : null;
    if (!name || !sourceUrl) continue; // Un lieu externe n'est « vérifié » que s'il a une source HTTPS.
    const fit = score(raw, input);
    const mapsUrl = isSafeActivityUrl(raw?.mapsUrl) ? raw.mapsUrl : null;
    result.push({
      id: `${norm(name).replace(/[^a-z0-9]+/g, "-")}:${result.length}`,
      name: name.slice(0, 120),
      type: "external",
      category: String(raw.category ?? "activite").slice(0, 60),
      description: raw.description ? String(raw.description).slice(0, 260) : null,
      destination: input.destination,
      address: raw.address ? String(raw.address).slice(0, 180) : null,
      latitude: Number.isFinite(Number(raw.latitude)) ? Number(raw.latitude) : null,
      longitude: Number.isFinite(Number(raw.longitude)) ? Number(raw.longitude) : null,
      sourceUrl,
      mapsUrl,
      source: String(raw.source ?? new URL(sourceUrl).hostname).slice(0, 80),
      priceHint: Number.isFinite(Number(raw.priceHint)) ? Math.max(0, Number(raw.priceHint)) : null,
      priceRange: raw.priceRange ? String(raw.priceRange).slice(0, 80) : null,
      durationMinutes: Number.isFinite(Number(raw.durationMinutes))
        ? Math.max(15, Number(raw.durationMinutes))
        : null,
      openingHours: Array.isArray(raw.openingHours)
        ? raw.openingHours.map(String).slice(0, 14)
        : [],
      rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : null,
      reviewCount: Number.isFinite(Number(raw.reviewCount)) ? Number(raw.reviewCount) : null,
      environment: ["indoor", "outdoor", "mixed"].includes(raw.environment)
        ? raw.environment
        : null,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 12) : [],
      ...fit,
      seasonality: raw.seasonality ? String(raw.seasonality).slice(0, 120) : null,
      verifiedAt: now,
      groundingSources: grounded
        .filter((source) => source.url === sourceUrl || source.url === mapsUrl)
        .slice(0, 5),
    });
  }
  const deduped = [
    ...new Map(result.map((candidate) => [norm(candidate.name), candidate])).values(),
  ];
  return deduped
    .sort(
      (a, b) =>
        b.profileFit +
        b.eventFit +
        (b.rating ?? 0) * 4 -
        (a.profileFit + a.eventFit + (a.rating ?? 0) * 4),
    )
    .slice(0, 24);
}

export async function discoverActivities(
  input: ActivityDiscoveryInput,
): Promise<{ candidates: ActivityCandidate[]; cached: boolean; error?: string }> {
  const queries = buildDiscoveryQueries(input);
  const key = cacheKey(input, queries);
  const cached = discoveryCache.get(key);
  if (!input.forceRefresh && cached && cached.expiresAt > Date.now())
    return { candidates: cached.candidates, cached: true };
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return { candidates: [], cached: false, error: "no_gemini_key" };
  const prompt = `Tu fais la discovery factuelle KREW. Recherche des lieux et prestataires ACTUELS répondant à ces requêtes: ${JSON.stringify(queries)}. Profil: ${input.tripProfile ?? input.ambiances.join(", ")}; événement: ${input.eventType ?? "weekend"}; budget total/pers: ${input.budgetPerPerson} EUR. Utilise Google Search et Google Maps. Ne retourne que des établissements réellement identifiés et vérifiables. N'invente jamais prix ni horaires: null/[] si inconnus. JSON strict {"candidates":[{"name":"","category":"","description":"","address":null,"latitude":null,"longitude":null,"sourceUrl":"https://source officielle ou résultat fiable","mapsUrl":null,"source":"","priceHint":null,"priceRange":null,"durationMinutes":null,"openingHours":[],"rating":null,"reviewCount":null,"environment":"indoor|outdoor|mixed|null","tags":[],"seasonality":null}]}.`;
  try {
    const payload = await callGemini(apiKey, prompt);
    const candidates = normalizeCandidates(payload, input);
    discoveryCache.set(key, { candidates, expiresAt: Date.now() + CACHE_TTL_MS });
    return { candidates, cached: false };
  } catch (error) {
    reportServerError(error, {
      provider: "gemini",
      model: MODEL,
      kind: "activity-discovery",
      search: true,
      maps: true,
      destination: input.destination,
    });
    return { candidates: [], cached: false, error: String(error).slice(0, 180) };
  }
}
