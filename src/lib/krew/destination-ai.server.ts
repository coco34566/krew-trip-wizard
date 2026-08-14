import { reportServerError } from "@/lib/server-error-reporting.server";

/**
 * IA de découverte : AIMLAPI en priorité, puis anciens providers en fallback.
 * L'IA propose des candidates ; le moteur KREW reste responsable du scoring final.
 */
export type AiDiscoveryInput = {
  eventType?: string | null;
  ambiances: string[];
  activityCategories: string[];
  budgetPerPerson: number;
  maxDistanceKm: number;
  nights: number;
  startMonth: number;
  departureCity: string;
  participants: number;
  excludedCountries: string[];
  planeRefused?: boolean;
  maxTravelHours?: number | null;
  starWanted?: string[];
  starDealBreakers?: string[];
  wantedEnvTypes?: string[];
  starWantedEnvType?: string | null;
  groupAgeRange?: string | null;
  scoringSignals?: {
    desiredDestination?: string | null;
    letKrewDecide?: boolean;
    starWeight?: number | null;
    scoringWeights?: Record<string, number> | null;
    individualPreferences?: Array<{
      ambiances?: string[];
      activityCategories?: string[];
      budgetMax?: number | null;
      budgetPriority?: string | null;
      dealBreakerAmbiances?: string[];
      dealBreakerDestinations?: string[];
      desiredDestination?: string | null;
      isStar?: boolean;
      weight?: number;
      wantedEnvType?: string | null;
      groupAgeRange?: string | null;
    }>;
  };
};

export type AiCandidate = {
  name: string;
  country?: string;
  affinity: number;
  reason: string;
  dailyCost?: number;
  distanceKm?: number;
  bestMonths?: number[];
};

const SYSTEM = `Tu es le module de découverte de destinations de KREW.
Tu génères une shortlist large de destinations pertinentes pour un groupe.
Tu ne décides PAS du classement final : le moteur déterministe KREW applique ensuite les contraintes dures, le scoring individuel/collectif, le poids de la Star et la diversification.

Réponds UNIQUEMENT en JSON valide :
{"cities":[{"name":"Ville","country":"Pays","why":"motif court","cost":70,"km":1200,"months":[5,6,9]}]}

Règles :
- Propose 8 à 10 destinations différentes quand suffisamment de candidates compatibles existent.
- Ne te limite pas aux capitales ou au catalogue historique : cherche aussi villes secondaires, littoral, nature, villages et destinations originales.
- Respecte les contraintes dures fournies : exclusions, absence d'avion, distance et temps maximal.
- Les préférences souples et le scoring servent à orienter la découverte, pas à éliminer toutes les alternatives.
- Une destination souhaitée est une préférence ; si KREW décide, elle ne doit pas rendre les autres exclusives.
- Les préférences de la Star sont importantes selon son poids, mais ne transforme pas une préférence en veto sauf si elle est explicitement un deal-breaker.
- Inclus 2 à 3 options originales lorsque compatibles.
- cost = estimation du coût journalier moyen par personne en euros, hébergement + repas, hors transport longue distance.
- km = distance approximative depuis la ville de départ.
- months = 2 à 3 mois idéaux.
- why = justification courte en français.`;

type LlmConfig = { apiKey: string; baseUrl: string; model: string; provider: "aimlapi" | "lovable" | "groq" | "xai" | "openai" };

function getLlmConfig(): LlmConfig | null {
  const key = process.env["AIMLAPI_API_KEY"];
  if (key) return {
    apiKey: key,
    baseUrl: (process.env["AIMLAPI_BASE_URL"] || "https://api.aimlapi.com/v1").replace(/\/$/, ""),
    model: process.env["AIMLAPI_MODEL"] || "google/gemini-2.5-flash",
    provider: "aimlapi",
  };

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) return {
    apiKey: lovableKey,
    baseUrl: (process.env["LOVABLE_AI_BASE_URL"] || "https://ai.gateway.lovable.dev/v1").replace(/\/$/, ""),
    model: process.env["LLM_DISCOVERY_MODEL"] || process.env["LOVABLE_AI_MODEL"] || "google/gemini-2.5-flash",
    provider: "lovable",
  };
  if (process.env["GROQ_API_KEY"]) return { apiKey: process.env["GROQ_API_KEY"], baseUrl: "https://api.groq.com/openai/v1", model: process.env["LLM_DISCOVERY_MODEL"] || "llama-3.1-8b-instant", provider: "groq" };
  if (process.env["XAI_API_KEY"]) return { apiKey: process.env["XAI_API_KEY"], baseUrl: "https://api.x.ai/v1", model: process.env["LLM_DISCOVERY_MODEL"] || "grok-2-latest", provider: "xai" };
  if (process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"]) return { apiKey: (process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"]) as string, baseUrl: (process.env["LLM_RATIONALE_BASE_URL"] || "https://api.openai.com/v1").replace(/\/$/, ""), model: process.env["LLM_DISCOVERY_MODEL"] || process.env["LLM_RATIONALE_MODEL"] || "gpt-4o-mini", provider: "openai" };
  return null;
}

function fingerprint(input: AiDiscoveryInput): string {
  return JSON.stringify({
    e: input.eventType || "", a: [...input.ambiances].sort(), c: [...input.activityCategories].sort(),
    b: Math.round(Number(input.budgetPerPerson) / 50) * 50, d: Math.round(Number(input.maxDistanceKm) / 100) * 100,
    n: input.nights, m: input.startMonth, o: input.departureCity.toLowerCase().slice(0, 24), p: input.participants,
    x: [...input.excludedCountries].sort(), plane: Boolean(input.planeRefused), h: input.maxTravelHours ?? null,
    sw: [...(input.starWanted || [])].sort(), env: [...(input.wantedEnvTypes || [])].sort(), starEnv: input.starWantedEnvType ?? null,
    age: input.groupAgeRange ?? null, scoring: input.scoringSignals ?? null,
  });
}

const cache = new Map<string, { at: number; cities: AiCandidate[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function compactUser(input: AiDiscoveryInput): string {
  const o: Record<string, unknown> = {
    event: (input.eventType || "groupe").slice(0, 20), n: input.participants, nights: input.nights,
    budget: Math.round(input.budgetPerPerson), from: (input.departureCity || "Paris").slice(0, 24),
    maxKm: Math.round(input.maxDistanceKm), month: input.startMonth,
    vibe: input.ambiances.slice(0, 6), acts: input.activityCategories.slice(0, 8),
    no: input.excludedCountries.slice(0, 8), noPlane: Boolean(input.planeRefused), maxH: input.maxTravelHours ?? null,
    star: (input.starWanted || []).slice(0, 6), starNo: (input.starDealBreakers || []).slice(0, 6),
    env: (input.wantedEnvTypes || []).slice(0, 6), starEnv: input.starWantedEnvType ?? null, age: input.groupAgeRange ?? null,
  };
  if (input.scoringSignals) o.scoring = {
    desiredDestination: input.scoringSignals.desiredDestination ?? null,
    letKrewDecide: input.scoringSignals.letKrewDecide ?? true,
    starWeight: input.scoringSignals.starWeight ?? null,
    scoringWeights: input.scoringSignals.scoringWeights ?? null,
    individualPreferences: (input.scoringSignals.individualPreferences || []).slice(0, 25),
  };
  return JSON.stringify(o);
}

function parseCities(raw: string): AiCandidate[] {
  const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as { cities?: Array<{ name?: string; country?: string; why?: string; cost?: number; km?: number; months?: number[] }> };
    return (Array.isArray(data.cities) ? data.cities : []).map((c, i) => {
      const out: AiCandidate = { name: String(c.name || "").trim(), affinity: Math.max(10, 100 - i * 6), reason: String(c.why || "suggéré par Krew IA").slice(0, 80) };
      if (c.country) out.country = String(c.country).trim();
      if (Number.isFinite(Number(c.cost)) && Number(c.cost) > 0) out.dailyCost = Number(c.cost);
      if (Number.isFinite(Number(c.km)) && Number(c.km) > 0) out.distanceKm = Number(c.km);
      if (Array.isArray(c.months)) out.bestMonths = c.months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
      return out;
    }).filter((c) => c.name.length >= 2).slice(0, 10);
  } catch { return []; }
}

export async function discoverDestinationsWithAi(input: AiDiscoveryInput): Promise<{ cities: AiCandidate[]; usedLlm: boolean; provider?: string; error?: string; cached?: boolean }> {
  const cfg = getLlmConfig();
  if (!cfg) return { cities: [], usedLlm: false, error: "no_llm_key" };
  const fp = fingerprint(input); const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { cities: hit.cities, usedLlm: true, provider: cfg.provider, cached: true };
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, temperature: 0.4, max_tokens: 1000, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: compactUser(input) }] }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      reportServerError(new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 160)}`), { provider: cfg.provider, kind: "destination-ai", departureCity: input.departureCity });
      return { cities: [], usedLlm: false, provider: cfg.provider, error: `llm_http_${res.status}:${errText.slice(0, 160)}` };
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const cities = parseCities(json.choices?.[0]?.message?.content ?? "");
    if (!cities.length) return { cities: [], usedLlm: false, provider: cfg.provider, error: "llm_empty_parse" };
    cache.set(fp, { at: Date.now(), cities });
    return { cities, usedLlm: true, provider: cfg.provider };
  } catch (e) {
    reportServerError(e, { provider: cfg.provider, kind: "destination-ai", departureCity: input.departureCity });
    return { cities: [], usedLlm: false, provider: cfg.provider, error: String(e).slice(0, 160) };
  }
}
