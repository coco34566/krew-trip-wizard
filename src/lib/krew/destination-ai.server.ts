/**
 * Shortlist destinations via LLM — priorite Lovable AI (peu de tokens).
 *
 * 1) Lovable AI gateway : LOVABLE_API_KEY (injecte auto Cloud / Edge)
 *    POST https://ai.gateway.lovable.dev/v1/chat/completions
 *    modele cheap : google/gemini-2.5-flash (override LLM_DISCOVERY_MODEL)
 * 2) Sinon OpenAI / Groq / xAI si cles presentes
 * 3) Sinon caller → scoring local
 *
 * Anti-tokens : JSON compact, max_tokens 280, cache 6h.
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
};

export type AiCandidate = {
  name: string;
  country?: string;
  affinity: number;
  reason: string;
};

const SYSTEM = `Tu proposes des destinations week-end/groupe depuis l'Europe (surtout depuis la France).
Réponds UNIQUEMENT en JSON valide:
{"cities":[{"name":"Ville","country":"Pays","why":"motif court"}]}
Règles:
- 6 à 8 villes max, réalistes pour le budget et la distance
- Pas d'invention de prix exacts
- Respecte refus avion / distance si indiqués
- Diversifie (pas 3 villes du même pays)
- why ≤ 8 mots`;

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "lovable" | "openai" | "groq" | "xai" | "custom";
};

function getLlmConfig(): LlmConfig | null {
  // 1) Lovable AI natif (Cloud)
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return {
      apiKey: lovableKey,
      baseUrl: (
        process.env.LOVABLE_AI_BASE_URL || "https://ai.gateway.lovable.dev/v1"
      ).replace(/\/$/, ""),
      model:
        process.env.LLM_DISCOVERY_MODEL ||
        process.env.LOVABLE_AI_MODEL ||
        "google/gemini-2.5-flash",
      provider: "lovable",
    };
  }

  // 2) Providers externes (optionnel)
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.LLM_DISCOVERY_MODEL || "llama-3.1-8b-instant",
      provider: "groq",
    };
  }
  if (process.env.XAI_API_KEY) {
    return {
      apiKey: process.env.XAI_API_KEY,
      baseUrl: "https://api.x.ai/v1",
      model: process.env.LLM_DISCOVERY_MODEL || "grok-2-latest",
      provider: "xai",
    };
  }
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
    return {
      apiKey: (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) as string,
      baseUrl: (process.env.LLM_RATIONALE_BASE_URL || "https://api.openai.com/v1").replace(
        /\/$/,
        "",
      ),
      model: process.env.LLM_DISCOVERY_MODEL || process.env.LLM_RATIONALE_MODEL || "gpt-4o-mini",
      provider: "openai",
    };
  }
  return null;
}

function fingerprint(input: AiDiscoveryInput): string {
  return JSON.stringify({
    e: input.eventType || "",
    a: [...(input.ambiances || [])].sort(),
    c: [...(input.activityCategories || [])].sort(),
    b: Math.round(Number(input.budgetPerPerson) / 50) * 50,
    d: Math.round(Number(input.maxDistanceKm) / 100) * 100,
    n: input.nights,
    m: input.startMonth,
    o: (input.departureCity || "").toLowerCase().slice(0, 24),
    p: input.participants,
    x: [...(input.excludedCountries || [])].sort(),
    plane: Boolean(input.planeRefused),
    h: input.maxTravelHours ?? null,
    sw: [...(input.starWanted || [])].sort().slice(0, 6),
  });
}

const cache = new Map<string, { at: number; cities: AiCandidate[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function compactUser(input: AiDiscoveryInput): string {
  const o: Record<string, unknown> = {
    event: (input.eventType || "groupe").slice(0, 20),
    n: input.participants,
    nights: input.nights,
    budget: Math.round(input.budgetPerPerson),
    from: (input.departureCity || "Paris").slice(0, 24),
    maxKm: Math.round(input.maxDistanceKm),
    month: input.startMonth,
  };
  if (input.ambiances?.length) o.vibe = input.ambiances.slice(0, 5);
  if (input.activityCategories?.length) o.acts = input.activityCategories.slice(0, 6);
  if (input.excludedCountries?.length) o.no = input.excludedCountries.slice(0, 6);
  if (input.planeRefused) o.noPlane = true;
  if (input.maxTravelHours) o.maxH = input.maxTravelHours;
  if (input.starWanted?.length) o.star = input.starWanted.slice(0, 4);
  if (input.starDealBreakers?.length) o.starNo = input.starDealBreakers.slice(0, 4);
  return JSON.stringify(o);
}

function parseCities(raw: string): AiCandidate[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as {
      cities?: { name?: string; country?: string; why?: string }[];
    };
    const list = Array.isArray(data.cities) ? data.cities : [];
    return list
      .map((c, i) => ({
        name: String(c.name || "").trim(),
        country: c.country ? String(c.country).trim() : undefined,
        affinity: Math.max(10, 100 - i * 8),
        reason: String(c.why || "suggéré par Krew IA").slice(0, 80),
      }))
      .filter((c) => c.name.length >= 2)
      .slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Shortlist IA — Lovable AI en premier.
 */
export async function discoverDestinationsWithAi(
  input: AiDiscoveryInput,
): Promise<{
  cities: AiCandidate[];
  usedLlm: boolean;
  provider?: string;
  error?: string;
  cached?: boolean;
}> {
  const cfg = getLlmConfig();
  if (!cfg) return { cities: [], usedLlm: false, error: "no_llm_key" };

  const fp = fingerprint(input);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { cities: hit.cities, usedLlm: true, provider: cfg.provider, cached: true };
  }

  const user = compactUser(input);

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.4,
        max_tokens: 280,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        cities: [],
        usedLlm: false,
        provider: cfg.provider,
        error: `llm_http_${res.status}:${errText.slice(0, 120)}`,
      };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cities = parseCities(content);
    if (!cities.length) {
      return {
        cities: [],
        usedLlm: false,
        provider: cfg.provider,
        error: "llm_empty_parse",
      };
    }
    cache.set(fp, { at: Date.now(), cities });
    return { cities, usedLlm: true, provider: cfg.provider };
  } catch (e) {
    return {
      cities: [],
      usedLlm: false,
      provider: cfg.provider,
      error: String(e).slice(0, 160),
    };
  }
}
