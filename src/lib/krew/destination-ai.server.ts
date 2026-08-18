import { reportServerError } from "@/lib/server-error-reporting.server";
import type { DestinationType } from "./destination-discovery.server";
import type { ProfileAffinity, StayConcept } from "./stay-profiles";

/**
 * IA de découverte : Gemini uniquement.
 * Si Gemini est indisponible, le moteur appelant retombe immédiatement sur
 * la discovery locale KREW sans tenter d'autres fournisseurs LLM.
 */
export type AiDiscoveryInput = {
  eventType?: string | null;
  ambiances: string[];
  activityCategories: string[];
  budgetPerPerson: number;
  maxDistanceKm: number;
  nights: number;
  startMonth: number;
  startDate?: string | null;
  endDate?: string | null;
  departureCity: string;
  departureOrigins?: Array<{ origin: string; participants: number }>;
  acceptedTransportModes?: string[];
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
  stayProfiles?: ProfileAffinity[];
  selectedConcepts?: StayConcept[];
  discoveryBranches?: Array<"urban" | "regional" | "outdoor" | "property_led">;
  localMobility?: string | null;
  accommodationRole?: string | null;
  relevantIndividualPreferences?: Array<Record<string, unknown>>;
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

export type AiTransportMap = Record<
  string,
  {
    modes: string[];
    approxHours: number;
  }
>;

export type AiCandidate = {
  name: string;
  country?: string;
  region?: string;
  destinationType: DestinationType;
  anchorPlaces: string[];
  why?: string;
  reason: string;
  affinity: number;
  dailyCost?: number;
  distanceKm?: number;
  bestMonths?: number[];
  transport?: AiTransportMap;
  budgetLevel?: "low" | "medium" | "high";
  activityFit?: string[];
  environmentFit?: string[];
  accommodationFit?: string[];
  seasonFit?: "good" | "acceptable" | "poor";
};

const SYSTEM = `Tu es le moteur d'exploration de destinations de KREW.

Ta mission est d'explorer très largement l'espace des destinations possibles pour ce groupe à partir de TOUTES les données de son profil.
Tu es un moteur de découverte, pas le décideur final.

Le moteur déterministe KREW applique ensuite les contraintes dures, le scoring individuel et collectif, le poids de la Star et la diversification. Ne remplace jamais ce calcul par ton propre classement.

Réponds UNIQUEMENT en JSON valide :
{"destinations":[{"name":"Luberon","country":"France","region":"Provence","destinationType":"region_territory","anchorPlaces":["Gordes","Lourmarin"],"why":"Nature, villages et séjour collectif","km":700,"months":[5,6,9],"transport":{"Paris":{"modes":["train","car"],"approxHours":4}},"budgetLevel":"medium","activityFit":["nature","gastronomie"],"environmentFit":["village","nature"],"accommodationFit":["house_together"],"seasonFit":"good"}]}

Règles de découverte :
- Génère idéalement 30 à 50 destinations candidates différentes lorsque le profil le permet.
- Respecte les branches demandées : urban produit des city ; regional produit réellement town_village ou region_territory ; outdoor produit des outdoor_area liées aux activités, pas une ville simplement étiquetée nature.
- Pour une région ou zone outdoor, fournis 2 à 5 anchorPlaces réels utilisables pour rechercher logements et activités.
- Ne te limite jamais au catalogue historique de KREW et ne favorise pas artificiellement les capitales.
- Utilise toutes les préférences individuelles fournies pour rechercher des destinations susceptibles de satisfaire différents membres du groupe.
- Tiens compte des pondérations et du profil de la Star pour orienter la recherche, sans transformer une préférence souple en veto.
- Une destination souhaitée est un signal de préférence ; si KREW décide, elle ne doit pas rendre les autres destinations exclusives.
- Cherche aussi des compromis intelligents lorsque les préférences des participants sont différentes ou contradictoires.
- Inclue plusieurs options moins évidentes lorsqu'elles sont plausiblement compatibles, afin que KREW puisse ensuite sélectionner une véritable "pépite".
- Les contraintes explicitement identifiées comme dures doivent être respectées autant que possible pendant la génération, mais KREW reste l'autorité finale pour les vérifier.
- Ne rejette pas une candidate uniquement à cause d'une estimation incertaine.
- km = distance approximative depuis la ville de départ.
- months = 2 à 4 mois idéaux (1 à 12).
- why = justification courte en français, moins de 12 mots.
- transport = dictionnaire par origine (ex: "Paris") avec modes ("train", "car", "flight", etc.) et approxHours (durée approximative en heures).
- budgetLevel = "low" (économique), "medium" (modéré), "high" (élevé).
- activityFit = liste de catégories d'activités pertinentes présentes sur la destination.
- environmentFit = liste d'environnements pertinents (ex: ["nature", "village"], ["urban", "nightlife"], ["sea", "outdoor"]).
- accommodationFit = liste de concepts logement cohérents avec le territoire (ex: ["house_together"], ["hotel_central"], ["exceptional_experience"]).
- seasonFit = "good" | "acceptable" | "poor".
- Pour property_led, house_together, exceptional_experience ou un logement centerpiece, propose des territoires où l'expérience logement est plausible, jamais une propriété précise.

Qualité attendue : la liste doit être réellement influencée par le profil du groupe. Deux groupes avec des préférences très différentes doivent obtenir des listes sensiblement différentes.`;

type GeminiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: "gemini";
};

type InteractionResponse = {
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function getGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.info("[Gemini env diagnostic]", {
      processEnvPresent: false,
      geminiEnvNames: Object.keys(process.env).filter((key) => key.startsWith("GEMINI")),
      vercelEnv: process.env["VERCEL_ENV"] ?? null,
      vercelGitCommitRef: process.env["VERCEL_GIT_COMMIT_REF"] ?? null,
    });
    return null;
  }
  console.info("[Gemini env diagnostic]", {
    processEnvPresent: true,
    geminiEnvNames: Object.keys(process.env).filter((key) => key.startsWith("GEMINI")),
    vercelEnv: process.env["VERCEL_ENV"] ?? null,
    vercelGitCommitRef: process.env["VERCEL_GIT_COMMIT_REF"] ?? null,
  });
  return {
    apiKey,
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/interactions",
    model: process.env["GEMINI_MODEL"] || "gemini-3.6-flash",
    provider: "gemini",
  };
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
    profiles: input.stayProfiles ?? [],
    concepts: input.selectedConcepts ?? [],
    branches: input.discoveryBranches ?? ["urban"],
    mobility: input.localMobility ?? null,
    accommodation: input.accommodationRole ?? null,
    individual: input.relevantIndividualPreferences ?? [],
  });
}

const cache = new Map<string, { at: number; candidates: AiCandidate[]; provider: string }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const REQUEST_TIMEOUT_MS = 60_000;

export function clearDestinationAiCacheForTests() {
  cache.clear();
}

function compactUser(input: AiDiscoveryInput): string {
  const o: Record<string, unknown> = {
    event: input.eventType || "groupe",
    participants: input.participants,
    nights: input.nights,
    dates: input.startDate && input.endDate ? { startDate: input.startDate, endDate: input.endDate } : null,
    budgetPerPerson: input.budgetPerPerson,
    departureCity: input.departureCity || null,
    departureOrigins: input.departureOrigins ?? [
      { origin: input.departureCity, participants: input.participants },
    ],
    acceptedTransportModes: input.acceptedTransportModes ?? [],
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
    stayProfiles: input.stayProfiles || [],
    selectedConcepts: input.selectedConcepts || [],
    discoveryBranches: input.discoveryBranches || ["urban"],
    localMobility: input.localMobility ?? null,
    accommodationRole: input.accommodationRole ?? null,
    individualPreferences: input.relevantIndividualPreferences || [],
  };

  if (input.scoringSignals) {
    o["scoringProfile"] = {
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

function extractInteractionText(json: InteractionResponse): string {
  const modelOutputs = (json.steps ?? []).filter((step) => step.type === "model_output");
  const lastOutput = modelOutputs.at(-1);
  if (!lastOutput?.content?.length) return "";
  return lastOutput.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("");
}

export function parseDiscoveryCandidates(raw: string): AiCandidate[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as {
      destinations?: Array<{
        name?: string;
        title?: string;
        country?: string;
        region?: string;
        destinationType?: string;
        anchorPlaces?: string[];
        why?: string;
        reason?: string;
        cost?: number;
        km?: number;
        months?: number[];
        transport?: Record<string, { modes?: string[]; approxHours?: number }>;
        budgetLevel?: "low" | "medium" | "high";
        activityFit?: string[] | Array<{ category?: string }>;
        environmentFit?: string[];
        accommodationFit?: string[];
        seasonFit?: "good" | "acceptable" | "poor";
      }>;
      cities?: Array<{
        name?: string;
        country?: string;
        why?: string;
        cost?: number;
        km?: number;
        months?: number[];
      }>;
    };

    const values = (
      Array.isArray(data.destinations) ? data.destinations : (data.cities ?? [])
    ) as Array<{
      name?: string;
      title?: string;
      country?: string;
      region?: string;
      destinationType?: string;
      anchorPlaces?: string[];
      why?: string;
      reason?: string;
      cost?: number;
      km?: number;
      months?: number[];
      transport?: Record<string, { modes?: string[]; approxHours?: number }>;
      budgetLevel?: "low" | "medium" | "high";
      activityFit?: string[] | Array<{ category?: string }>;
      environmentFit?: string[];
      accommodationFit?: string[];
      seasonFit?: "good" | "acceptable" | "poor";
    }>;

    return values
      .map((c, i) => {
        const rawType = String(c.destinationType ?? "city");
        const destinationType: DestinationType = [
          "city",
          "town_village",
          "region_territory",
          "outdoor_area",
        ].includes(rawType)
          ? (rawType as DestinationType)
          : "city";
        const name = String(c.name || c.title || "").trim();
        const whyStr = String(c.why || c.reason || "suggéré par Krew IA").slice(0, 120);
        const out: AiCandidate = {
          name,
          affinity: Math.max(10, 100 - i * 1.5),
          why: whyStr,
          reason: whyStr,
          destinationType,
          anchorPlaces:
            destinationType === "city"
              ? [name]
              : (c.anchorPlaces ?? [])
                  .map(String)
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .slice(0, 5),
        };
        if (c.country) out.country = String(c.country).trim();
        if (c.region) out.region = String(c.region).trim();

        if (c.transport && typeof c.transport === "object") {
          const transportMap: AiTransportMap = {};
          for (const [origin, info] of Object.entries(c.transport)) {
            if (info && typeof info === "object") {
              transportMap[origin] = {
                modes: Array.isArray(info.modes) ? info.modes.map(String) : [],
                approxHours: Number.isFinite(Number(info.approxHours))
                  ? Number(info.approxHours)
                  : 0,
              };
            }
          }
          if (Object.keys(transportMap).length > 0) {
            out.transport = transportMap;
          }
        }

        if (["low", "medium", "high"].includes(String(c.budgetLevel))) {
          out.budgetLevel = c.budgetLevel as "low" | "medium" | "high";
        }

        if (Number.isFinite(Number(c.cost)) && Number(c.cost) > 0) {
          out.dailyCost = Number(c.cost);
        } else if (out.budgetLevel) {
          out.dailyCost = out.budgetLevel === "low" ? 50 : out.budgetLevel === "medium" ? 85 : 130;
        }

        if (Array.isArray(c.activityFit)) {
          out.activityFit = c.activityFit
            .map((item) => (typeof item === "string" ? item : String(item?.category || "")))
            .filter(Boolean);
        }

        if (Array.isArray(c.environmentFit)) {
          out.environmentFit = c.environmentFit.map(String).filter(Boolean);
        }

        if (Array.isArray(c.accommodationFit)) {
          out.accommodationFit = c.accommodationFit.map(String).filter(Boolean);
        }

        if (["good", "acceptable", "poor"].includes(String(c.seasonFit))) {
          out.seasonFit = c.seasonFit as "good" | "acceptable" | "poor";
        }

        if (Number.isFinite(Number(c.km)) && Number(c.km) > 0) out.distanceKm = Number(c.km);
        if (Array.isArray(c.months)) {
          out.bestMonths = c.months
            .map(Number)
            .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
        }
        return out;
      })
      .filter((c) => c.name.length >= 2)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function discoverDestinationsWithAi(input: AiDiscoveryInput): Promise<{
  candidates: AiCandidate[];
  usedLlm: boolean;
  provider?: string;
  error?: string;
  cached?: boolean;
}> {
  const cfg = getGeminiConfig();
  if (!cfg) return { candidates: [], usedLlm: false, error: "no_gemini_key" };

  const fp = fingerprint(input);
  const hit = cache.get(fp);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return {
      candidates: hit.candidates,
      usedLlm: true,
      provider: hit.provider,
      cached: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(cfg.baseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-goog-api-key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        system_instruction: SYSTEM,
        input: compactUser(input),
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const error = `gemini_http_${res.status}:${errText.slice(0, 240)}`;
      reportServerError(new Error(error), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
      return { candidates: [], usedLlm: false, provider: cfg.provider, error };
    }

    const json = (await res.json()) as InteractionResponse;
    const raw = extractInteractionText(json);
    const candidates = parseDiscoveryCandidates(raw);
    if (!candidates.length) {
      const error = raw ? "gemini_empty_parse" : "gemini_empty_output";
      reportServerError(new Error(error), {
        provider: cfg.provider,
        kind: "destination-ai",
        departureCity: input.departureCity,
      });
      return { candidates: [], usedLlm: false, provider: cfg.provider, error };
    }

    cache.set(fp, { at: Date.now(), candidates, provider: cfg.provider });
    return { candidates, usedLlm: true, provider: cfg.provider };
  } catch (error) {
    clearTimeout(timeout);
    reportServerError(error, {
      provider: cfg.provider,
      kind: "destination-ai",
      departureCity: input.departureCity,
    });
    return {
      candidates: [],
      usedLlm: false,
      provider: cfg.provider,
      error: String(error).slice(0, 160) || "gemini_failed",
    };
  }
}
