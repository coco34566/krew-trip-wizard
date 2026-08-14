import { reportServerError } from "@/lib/server-error-reporting.server";

/**
 * IA de découverte : AIMLAPI en priorité, OpenAI en fallback.
 * L'IA explore largement les possibilités ; le moteur KREW reste responsable
 * des contraintes dures, du scoring final et de la diversification.
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
  freeNotes?: string[];
  scoringSignals?: {
    desiredDestination?: string | null;
    letKrewDecide?: boolean;
    starWeight?: number | null;
    scoringWeights?: Record<string, number> | null;
    individualPreferences?: Array<Record<string, unknown>>;
    hardConstraints?: Record<string, unknown> | null;
    softPreferences?: Record<string, unknown> | null;
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

const SYSTEM = `Tu es le moteur d'exploration de destinations de KREW.

Ta mission est d'explorer très largement l'espace des destinations possibles pour ce groupe à partir de TOUTES les données de son profil.
Tu es un moteur de découverte, pas le décideur final.

Le moteur déterministe KREW applique ensuite les contraintes dures, le scoring individuel et collectif, le poids de la Star et la diversification. Ne remplace jamais ce calcul par ton propre classement.

Réponds UNIQUEMENT en JSON valide :
{"cities":[{"name":"Ville","country":"Pays","why":"motif court","cost":70,"km":1200,"months":[5,6,9]}]}

Règles de découverte :
- Génère idéalement 30 à 50 destinations candidates différentes lorsque le profil le permet.
- Explore des profils variés : grandes villes, villes secondaires, littoral, nature, montagne, villages, destinations culturelles, festives, premium, abordables et options originales.
- Ne te limite jamais au catalogue historique de KREW et ne favorise pas artificiellement les capitales.
- Utilise toutes les préférences individuelles fournies pour rechercher des destinations susceptibles de satisfaire différents membres du groupe.
- Tiens compte des pondérations et du profil de la Star pour orienter la recherche, sans transformer une préférence souple en veto.
- Une destination souhaitée est un signal de préférence ; si KREW décide, elle ne doit pas rendre les autres destinations exclusives.
- Cherche aussi des compromis intelligents lorsque les préférences des participants sont différentes ou contradictoires.
- Inclue plusieurs options moins évidentes lorsqu'elles sont plausiblement compatibles, afin que KREW puisse ensuite sélectionner une véritable "pépite".
- Les contraintes explicitement identifiées comme dures doivent être respectées autant que possible pendant la génération, mais KREW reste l'autorité finale pour les vérifier.
- Ne rejette pas une candidate uniquement à cause d'une estimation incertaine : une estimation IA de coût, distance ou saison n'est jamais une vérité et pourra être vérifiée ensuite.
- cost = estimation du coût journalier moyen par personne en euros, hébergement + repas, hors transport longue distance.
- km = distance approximative depuis la ville de départ.
- months = 2 à 4 mois idéaux (1 à 12).
- why = justification courte en français, moins de 12 mots.
- Ne fabrique pas de données de précision artificielle.

Qualité attendue : la liste doit être réellement influencée par le profil du groupe. Deux groupes avec des préférences très différentes doivent obtenir des listes sensiblement différentes.`;

type LlmConfig = { apiKey: string; baseUrl: string; model: string; provider: "aimlapi" | "openai" };

function getLlmConfigs(): LlmConfig[] {
  const configs: LlmConfig[] = [];
  const aimlapiKey = process.env["AIMLAPI_API_KEY"];
  if (aimlapiKey) {
    configs.push({
      apiKey: aimlapiKey,
      baseUrl: (process.env["AIMLAPI_BASE_URL"] || "https://api.aimlapi.com/v1").replace(/\/$/, ""),
      model: process.env["AIMLAPI_MODEL"] || "google/gemini-2.5-flash",
      provider: "aimlapi",
    });
  }
  const openaiKey = process.env["OPENAI_API_KEY"] || process.env["LLM_API_KEY"];
  if (openaiKey) {
    configs.push({
      apiKey: openaiKey,
      baseUrl: (process.env["LLM_RATIONALE_BASE_URL"] || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env["LLM_DISCOVERY_MODEL"] || "gpt-4o-mini",
      provider: "openai",
    });
  }
  return configs;
}

function fingerprint(input: AiDiscoveryInput): string {
  return JSON.stringify({
    e: input.eventType || "",
    a: [...input.ambiances].sort(),
    c: [...input.activityCategories].sort(),
    b: Math.round(Number(input.budgetPerPerson) / 50) * 50,
    d: Math.round(Number(input.maxDistanceKm) / 100) * 100,
    n: input.nights,
    m: input.startMonth,
    o: input.departureCity.toLowerCase().slice(0, 24),
    p: input.participants,
    x: [...input.excludedCountries].sort(),
    plane: Boolean(input.planeRefused),
    h: input.maxTravelHours ?? null,
    sw: [...(input.starWanted || [])].sort(),
    env: [...(input.wantedEnvTypes || [])].sort(),
    starEnv: input.starWantedEnvType ?? null,
    age: input.groupAgeRange ?? null,
    scoring: input.scoringSignals ?? null,
  });
}

const cache = new Map<string, { at: number; cities: AiCandidate[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function compactUser(input: AiDiscoveryInput): string {
  const o: Record<string, unknown> = {
    event: input.eventType || "groupe",
    participants: input.participants,
    nights: input.nights,
    budgetPerPerson: input.budgetPerPerson,
    departureCity: input.departureCity || null,
    maxDistanceKm: input.maxDistanceKm,
    startMonth: input.startMonth,
    ambiances: input.ambiances,
    activityCategories: input.activityCategories,
    excludedCountries: input.excludedCountries,
    planeRefused: Boolean(input.planeRefused),
    maxTravelHours: input.maxTravelHours ?? null,
    starWanted: input.starWanted || [],
    starDealBreakers: input.starDealBreakers || [],
    wantedEnvTypes: input.wantedEnvTypes || [],
    starWantedEnvType: input.starWantedEnvType ?? null,
    groupAgeRange: input.groupAgeRange ?? null,
    freeNotes: input.freeNotes || [],
  };

  if (input.scoringSignals) {
    o.scoringProfile = {
      desiredDestination: input.scoringSignals.desiredDestination ?? null,
      letKrewDecide: input.scoringSignals.letKrewDecide ?? true,
      starWeight: input.scoringSignals.starWeight ?? null,
      scoringWeights: input.scoringSignals.scoringWeights ?? null,
      hardConstraints: input.scoringSignals.hardConstraints ?? null,
      softPreferences: input.scoringSignals.softPreferences ?? null,
      individualPreferences: input.scoringSignals.individualPreferences ?? [],
    };
  }

  return JSON.stringify(o);
}

function parseCities(raw: string): AiCandidate[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as {
      cities?: Array<{ name?: string; country?: string; why?: string; cost?: number; km?: number; months?: number[] }>;
    };
    return (Array.isArray(data.cities) ? data.cities : []).map((c, i) => {
      const out: AiCandidate = {
        name: String(c.name || "").trim(),
        affinity: Math.max(10, 100 - i * 1.5),
        reason: String(c.why || "suggéré par Krew IA").slice(0, 120),
      };
      if (c.country) out.country = String(c.country).trim();
      if (Number.isFinite(Number(c.cost)) && Number(c.cost) > 0) out.dailyCost = Number(c.cost);
      if (Number.isFinite(Number(c.km)) && Number(c.km) > 0) out.distanceKm = Number(c.km);
      if (Array.isArray(c.months)) out.bestMonths = c.months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
      return out;
    }).filter((c) => c.name.length >= 2).slice(0, 50);
  } catch {
    return [];
  }
}

export async function discoverDestinationsWithAi(input: AiDiscoveryInput): Promise<{ cities: AiCandidate[]; usedLlm: boolean; provider?: string; error?: string; cached?: boolean }> {
  const configs = getLlmConfigs();
  if (!configs.length) return { cities: [], usedLlm: false, error: "no_llm_key" };
  const fp = fingerprint(input);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { cities: hit.cities, usedLlm: true, provider: configs[0].provider, cached: true };

  let lastError = "";
  for (const cfg of configs) {
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0.55,
          max_tokens: 5000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: compactUser(input) },
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `llm_http_${res.status}:${errText.slice(0, 160)}`;
        reportServerError(new Error(lastError), { provider: cfg.provider, kind: "destination-ai", departureCity: input.departureCity });
        continue;
      }
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const cities = parseCities(json.choices?.[0]?.message?.content ?? "");
      if (!cities.length) {
        lastError = "llm_empty_parse";
        reportServerError(new Error(lastError), { provider: cfg.provider, kind: "destination-ai", departureCity: input.departureCity });
        continue;
      }
      cache.set(fp, { at: Date.now(), cities });
      return { cities, usedLlm: true, provider: cfg.provider };
    } catch (e) {
      lastError = String(e).slice(0, 160);
      reportServerError(e, { provider: cfg.provider, kind: "destination-ai", departureCity: input.departureCity });
    }
  }
  return { cities: [], usedLlm: false, provider: configs[0].provider, error: lastError || "llm_failed" };
}
