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

import { reportServerError } from "@/lib/server-error-reporting.server";

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
};

export type AiCandidate = {
  name: string;
  country?: string;
  affinity: number;
  reason: string;
  /** Coût journalier moyen €/pers estimé par le LLM (villes hors catalogue). */
  dailyCost?: number | undefined;
  /** Distance approximative km depuis la ville de départ. */
  distanceKm?: number | undefined;
  /** 2-3 mois idéaux (1-12) estimés par le LLM. */
  bestMonths?: number[] | undefined;
};

const SYSTEM = `Tu proposes des destinations de voyage et week-ends de groupe en Europe (notamment depuis la France) adaptées aux critères du groupe.
Réponds UNIQUEMENT en JSON valide:
{"cities":[{"name":"Ville","country":"Pays","why":"motif court","cost":70,"km":1200,"months":[5,6,9]}]}

Règles de sélection strictes :
- Propose 6 à 8 villes max, réalistes pour le budget total et la distance maximale.
- Intègre l'âge du groupe (18-25/25-35: axer sur ambiance festive, activités de soirées, bon rapport qualité/prix; 45-60+: axer sur le confort, culture, gastronomie, détente).
- Respecte impérativement le cadre géographique recherché ("env": ex. si "Nature / pleine nature" ou "Village de charme" est demandé, propose des destinations rurales/naturelles/villages et pas uniquement des grandes métropoles).
- Respecte les contraintes dures : pas d'avion si "noPlane" est vrai, respecte la distance max "maxKm", et respecte le temps de trajet maximal "maxH".
- Parmi les propositions, inclus 2 à 3 destinations d'une originalité surprenante / hors des sentiers battus qui collent quand même parfaitement aux contraintes.
- Ne propose pas de destinations dans la liste des pays/villes exclus "no".
- cost = estimation du coût journalier moyen sur place par personne (€, hébergement + repas, hors transport long-courrier).
- km = distance approximative depuis la ville de départ.
- months = liste de 2 à 3 mois idéaux (de 1 à 12).
- why = justification courte en français de moins de 8 mots.`;

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "lovable" | "openai" | "groq" | "xai" | "custom";
};

function getLlmConfig(): LlmConfig | null {
  // 1) Lovable AI natif (Cloud)
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      apiKey: lovableKey,
      baseUrl: (
        process.env["LOVABLE_AI_BASE_URL"] || "https://ai.gateway.lovable.dev/v1"
      ).replace(/\/$/, ""),
      model:
        process.env["LLM_DISCOVERY_MODEL"] ||
        process.env["LOVABLE_AI_MODEL"] ||
        "google/gemini-2.5-flash",
      provider: "lovable",
    };
  }

  // 2) Providers externes (optionnel)
  if (process.env["GROQ_API_KEY"]) {
    return {
      apiKey: process.env["GROQ_API_KEY"],
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env["LLM_DISCOVERY_MODEL"] || "llama-3.1-8b-instant",
      provider: "groq",
    };
  }
  if (process.env["XAI_API_KEY"]) {
    return {
      apiKey: process.env["XAI_API_KEY"],
      baseUrl: "https://api.x.ai/v1",
      model: process.env["LLM_DISCOVERY_MODEL"] || "grok-2-latest",
      provider: "xai",
    };
  }
  if (process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"]) {
    return {
      apiKey: (process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"]) as string,
      baseUrl: (process.env["LLM_RATIONALE_BASE_URL"] || "https://api.openai.com/v1").replace(
        /\/$/,
        "",
      ),
      model: process.env["LLM_DISCOVERY_MODEL"] || process.env["LLM_RATIONALE_MODEL"] || "gpt-4o-mini",
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
    env: [...(input.wantedEnvTypes || [])].sort().slice(0, 4),
    starEnv: input.starWantedEnvType ?? null,
    age: input.groupAgeRange ?? null,
  });
}

const cache = new Map<string, { at: number; cities: AiCandidate[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function compactUser(input: AiDiscoveryInput): string {
  const o: Record<string, unknown> = {
    "event": (input.eventType || "groupe").slice(0, 20),
    "n": input.participants,
    "nights": input.nights,
    "budget": Math.round(input.budgetPerPerson),
    "from": (input.departureCity || "Paris").slice(0, 24),
    "maxKm": Math.round(input.maxDistanceKm),
    "month": input.startMonth,
  };
  if (input.ambiances?.length) o["vibe"] = input.ambiances.slice(0, 5);
  if (input.activityCategories?.length) o["acts"] = input.activityCategories.slice(0, 6);
  if (input.excludedCountries?.length) o["no"] = input.excludedCountries.slice(0, 6);
  if (input.planeRefused) o["noPlane"] = true;
  if (input.maxTravelHours) o["maxH"] = input.maxTravelHours;
  if (input.starWanted?.length) o["star"] = input.starWanted.slice(0, 4);
  if (input.starDealBreakers?.length) o["starNo"] = input.starDealBreakers.slice(0, 4);
  if (input.wantedEnvTypes?.length) o["env"] = input.wantedEnvTypes.slice(0, 4);
  if (input.starWantedEnvType) o["starEnv"] = input.starWantedEnvType;
  if (input.groupAgeRange) o["age"] = input.groupAgeRange;
  return JSON.stringify(o);
}

function parseCities(raw: string): AiCandidate[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as {
      cities?: {
        name?: string;
        country?: string;
        why?: string;
        cost?: number;
        km?: number;
        months?: number[];
      }[];
    };
    const list = Array.isArray(data.cities) ? data.cities : [];
    return list
      .map((c, i) => {
        const cost = Number(c.cost);
        const km = Number(c.km);
        const months = Array.isArray(c.months)
          ? c.months.map((m) => Number(m)).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
          : [];
        const candidate: any = {
          name: String(c.name || "").trim(),
          affinity: Math.max(10, 100 - i * 8),
          reason: String(c.why || "suggéré par Krew IA").slice(0, 80),
        };
        if (c.country) candidate.country = String(c.country).trim();
        if (Number.isFinite(cost) && cost > 0) candidate.dailyCost = cost;
        if (Number.isFinite(km) && km > 0) candidate.distanceKm = km;
        if (months.length) candidate.bestMonths = months;
        return candidate as AiCandidate;
      })
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
        max_tokens: 520,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      reportServerError(new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 120)}`), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
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
      reportServerError(new Error("LLM returned empty or unparseable destination shortlist JSON"), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
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
    reportServerError(e, {
      provider: cfg.provider,
      kind: "destination-ai",
      departureCity: input.departureCity,
    });
    return {
      cities: [],
      usedLlm: false,
      provider: cfg.provider,
      error: String(e).slice(0, 160),
    };
  }
}
