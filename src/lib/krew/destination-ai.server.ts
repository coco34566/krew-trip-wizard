/**
 * Shortlist destinations via LLM — budget tokens minimal.
 *
 * Stratégie anti-tokens :
 *  - 1 seul appel par génération
 *  - prompt système court + user = JSON compact (pas de prose)
 *  - sortie = 6–8 noms de villes + 1 motif court
 *  - cache mémoire par empreinte des critères (évite de rappeler pour le même groupe)
 *  - modèle cheap (gpt-4o-mini / llama / grok selon env)
 *
 * Env (mêmes que rationale-llm) :
 *  OPENAI_API_KEY | GROQ_API_KEY | XAI_API_KEY | LLM_API_KEY
 *  LLM_RATIONALE_MODEL / LLM_RATIONALE_BASE_URL
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

function getLlmConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.LLM_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (
    process.env.LLM_DISCOVERY_BASE_URL ||
    process.env.LLM_RATIONALE_BASE_URL ||
    (process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : null) ||
    (process.env.XAI_API_KEY ? "https://api.x.ai/v1" : null) ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.LLM_DISCOVERY_MODEL ||
    process.env.LLM_RATIONALE_MODEL ||
    (process.env.GROQ_API_KEY ? "llama-3.1-8b-instant" : null) ||
    (process.env.XAI_API_KEY ? "grok-2-latest" : null) ||
    "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

/** Empreinte stable pour cache (même critères → pas de 2e appel). */
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
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 h

function compactUser(input: AiDiscoveryInput): string {
  // JSON minimal — chaque caractère compte
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
 * Shortlist IA (ou null si pas de clé / échec → caller fait fallback local).
 */
export async function discoverDestinationsWithAi(
  input: AiDiscoveryInput,
): Promise<{ cities: AiCandidate[]; usedLlm: boolean; error?: string; cached?: boolean }> {
  const cfg = getLlmConfig();
  if (!cfg) return { cities: [], usedLlm: false, error: "no_llm_key" };

  const fp = fingerprint(input);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { cities: hit.cities, usedLlm: true, cached: true };
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
        max_tokens: 280, // sortie courte volontaire
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
        error: `llm_http_${res.status}:${errText.slice(0, 120)}`,
      };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cities = parseCities(content);
    if (!cities.length) {
      return { cities: [], usedLlm: false, error: "llm_empty_parse" };
    }
    cache.set(fp, { at: Date.now(), cities });
    return { cities, usedLlm: true };
  } catch (e) {
    return {
      cities: [],
      usedLlm: false,
      error: String(e).slice(0, 160),
    };
  }
}
