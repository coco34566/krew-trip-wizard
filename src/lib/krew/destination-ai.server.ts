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
  departureCity: string;
  departureOrigins?: Array<{ city: string; count: number }>;
  startDate?: string | null;
  endDate?: string | null;
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
  transportModes?: string[];
  preferredTransportMode?: string | null;
  refusedTransportModes?: string[];
  budgetMedian?: number | null;
  budgetMinimum?: number | null;
  budgetVeto?: number | null;
  rhythm?: Record<string, unknown>;
  accommodationSignals?: Record<string, unknown>;
  historySignals?: Array<Record<string, unknown>>;
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

export type AiCandidate = {
  name: string;
  country?: string;
  affinity: number;
  reason: string;
  dailyCost?: number;
  distanceKm?: number;
  bestMonths?: number[];
  region?: string;
  destinationType: DestinationType;
  anchorPlaces: string[];
  candidateClass: "strong_match" | "smart_compromise" | "gem";
  matchedSignals: string[];
  compromiseFor: string[];
  strongMatches: string[];
  groupsSatisfied: string[];
  starMatches: string[];
  potentialWeaknesses: string[];
  hardConstraintAssessment?: Record<string, string>;
  confidence?: number;
};

export type KrewDiscoveryBrief = {
  context: Record<string, unknown>;
  hardConstraints: Record<string, unknown>;
  priorities: Record<string, unknown>;
  collectiveProfiles: ProfileAffinity[];
  validatedConcepts: StayConcept[];
  star: Record<string, unknown>;
  groupDynamics: {
    strongConsensus: string[];
    majority: string[];
    divergences: string[];
    importantMinorities: string[];
  };
  individualSignals: Array<Record<string, unknown>>;
  branches: Array<"urban" | "regional" | "outdoor" | "property_led">;
};

const SYSTEM = `Tu es le moteur d'exploration de destinations de KREW.

Ta mission est d'explorer très largement l'espace des destinations possibles pour ce groupe à partir de TOUTES les données de son profil.
Tu es un moteur de découverte, pas le décideur final.

KREW appliquera ensuite ses contraintes dures, son scoring déterministe individuel et collectif, le poids de la Star et la diversification. Utilise les signaux fournis pour explorer des candidats susceptibles de satisfaire le groupe, mais ne calcule pas le score final à la place de KREW. Tu n'es ni un moteur de réservation, ni un moteur hôtel ou activité.

Réponds UNIQUEMENT en JSON valide :
{"destinations":[{"name":"Luberon","country":"France","region":"Provence","destinationType":"region_territory","anchorPlaces":["Gordes","Lourmarin"],"candidateClass":"smart_compromise","why":"villages, gastronomie et nature accessibles","strongMatches":["gastronomie","nature"],"groupsSatisfied":["majorité nature","minorité culture"],"starMatches":["gastronomie"],"potentialWeaknesses":["mobilité locale"],"hardConstraintAssessment":{"transport":"plausible depuis les origines","budget":"estimation compatible","dates":"bonne saison"},"estimatedDailyCost":70,"estimatedDistanceKm":700,"bestMonths":[5,6,9],"confidence":0.8}]}

Règles de découverte :
- Génère idéalement 30 à 50 destinations candidates différentes lorsque le profil le permet.
- Compose environ 50 à 70 % de strong_match directement alignés avec le consensus, 20 à 30 % de smart_compromise qui réconcilient les divergences, et 10 à 20 % de gem moins évidentes mais compatibles. Ces proportions sont indicatives : privilégie la pertinence.
- Respecte les branches demandées : urban produit des city ; regional produit réellement town_village ou region_territory ; outdoor produit des outdoor_area liées aux activités, pas une ville simplement étiquetée nature.
- Pour une région ou zone outdoor, fournis 2 à 5 anchorPlaces réels utilisables pour rechercher logements et activités.
- property_led est uniquement un signal territorial lié au rôle du logement ; ne recherche et ne propose aucune propriété réelle.
- Ne te limite jamais au catalogue historique de KREW et ne favorise pas artificiellement les capitales.
- Utilise toutes les préférences individuelles fournies pour rechercher des destinations susceptibles de satisfaire différents membres du groupe.
- Tiens compte des pondérations et du profil de la Star pour orienter la recherche, sans transformer une préférence souple en veto.
- Une destination souhaitée est un signal de préférence ; si KREW décide, elle ne doit pas rendre les autres destinations exclusives.
- Cherche aussi des compromis intelligents lorsque les préférences des participants sont différentes ou contradictoires.
- Inclue plusieurs options moins évidentes lorsqu'elles sont plausiblement compatibles, afin que KREW puisse ensuite sélectionner une véritable "pépite".
- Les contraintes explicitement identifiées comme dures doivent être respectées autant que possible pendant la génération, mais KREW reste l'autorité finale pour les vérifier.
- The following hard constraints will be deterministically verified by KREW after your response. Do not waste candidates on destinations that clearly violate them.
- Ne rejette pas une candidate uniquement à cause d'une estimation incertaine : une estimation IA de coût, distance ou saison n'est jamais une vérité et pourra être vérifiée ensuite.
- cost = estimation du coût journalier moyen par personne en euros, hébergement + repas, hors transport longue distance.
- km = distance approximative depuis la ville de départ.
- months = 2 à 4 mois idéaux (1 à 12).
- why = justification courte en français, moins de 12 mots.
- Ne fabrique pas de données de précision artificielle.

Qualité attendue : la liste doit être réellement influencée par le profil du groupe. Deux groupes avec des préférences très différentes doivent obtenir des listes sensiblement différentes.`;

const compactValues = (values: unknown[] | undefined) =>
  [...new Set((values ?? []).filter((value) => value != null && value !== "").map(String))].slice(
    0,
    12,
  );

export function buildKrewDiscoveryBrief(input: AiDiscoveryInput): KrewDiscoveryBrief {
  const individuals = (input.relevantIndividualPreferences ?? []).slice(0, 12).map((preference) => {
    const compact = Object.fromEntries(
      Object.entries(preference).filter(([, value]) =>
        Array.isArray(value) ? value.length > 0 : value != null && value !== false && value !== "",
      ),
    );
    return compact;
  });
  const signalCounts = new Map<string, number>();
  for (const preference of individuals) {
    for (const field of ["ambiances", "activities", "environment"] as const) {
      const values = Array.isArray(preference[field]) ? preference[field] : [preference[field]];
      for (const value of compactValues(values)) {
        const key = `${field}:${value}`;
        signalCounts.set(key, (signalCounts.get(key) ?? 0) + 1);
      }
    }
  }
  const threshold = Math.max(2, Math.ceil(individuals.length * 0.6));
  const consensus = [...signalCounts].filter(([, count]) => count >= threshold).map(([key]) => key);
  const minorities = [...signalCounts]
    .filter(([, count]) => count > 0 && count < threshold)
    .map(([key, count]) => `${key} (${count}/${Math.max(1, individuals.length)})`);
  const dimensions = new Map<string, Set<string>>();
  for (const key of signalCounts.keys()) {
    const [field, value] = key.split(":");
    if (field && value)
      (dimensions.get(field) ?? dimensions.set(field, new Set()).get(field)!).add(value);
  }

  return {
    context: {
      event: input.eventType || "groupe",
      participants: input.participants,
      nights: input.nights,
      departure: input.departureCity,
      departureOrigins: input.departureOrigins,
      month: input.startMonth,
      startDate: input.startDate ?? undefined,
      endDate: input.endDate ?? undefined,
      ageRange: input.groupAgeRange ?? undefined,
    },
    hardConstraints: {
      excludedDestinations: compactValues(input.excludedCountries),
      maxDistanceKm: input.maxDistanceKm,
      planeRefused: input.planeRefused || undefined,
      maxTravelHours: input.maxTravelHours ?? undefined,
      acceptedTransportModes: compactValues(input.transportModes),
      refusedTransportModes: compactValues(input.refusedTransportModes),
      starDealBreakers: compactValues(input.starDealBreakers),
      ...(input.scoringSignals?.hardConstraints ?? {}),
    },
    priorities: {
      ambiances: compactValues(input.ambiances),
      activities: compactValues(input.activityCategories),
      environments: compactValues(input.wantedEnvTypes),
      targetBudgetPerPerson: input.budgetPerPerson,
      medianBudgetPerPerson: input.budgetMedian ?? undefined,
      mostConstrainedBudget: input.budgetMinimum ?? undefined,
      budgetVeto: input.budgetVeto ?? undefined,
      maxDistanceKm: input.maxDistanceKm,
      localMobility: input.localMobility,
      accommodationRole: input.accommodationRole,
      rhythm: input.rhythm,
      accommodation: input.accommodationSignals,
      history: input.historySignals,
      notes: compactValues(input.freeNotes).slice(0, 6),
      ...(input.scoringSignals?.softPreferences ?? {}),
      scoringWeights: input.scoringSignals?.scoringWeights ?? undefined,
      desiredDestination: input.scoringSignals?.desiredDestination ?? undefined,
    },
    collectiveProfiles: (input.stayProfiles ?? []).slice(0, 6),
    validatedConcepts: (input.selectedConcepts ?? []).slice(0, 3),
    star: {
      weight: input.scoringSignals?.starWeight ?? 1,
      wanted: compactValues(input.starWanted),
      environment: input.starWantedEnvType ?? undefined,
      dealBreakers: compactValues(input.starDealBreakers),
    },
    groupDynamics: {
      strongConsensus: consensus,
      majority: [...signalCounts]
        .filter(([, count]) => count >= Math.ceil(individuals.length / 2))
        .map(([key]) => key),
      divergences: [...dimensions]
        .filter(([, values]) => values.size > 1)
        .map(([field, values]) => `${field}:${[...values].join(" vs ")}`),
      importantMinorities: minorities.slice(0, 10),
    },
    individualSignals: individuals,
    branches: input.discoveryBranches?.length ? input.discoveryBranches : ["urban"],
  };
}

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
  if (!apiKey) return null;
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
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof requestGeminiCandidates>>>>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const REQUEST_TIMEOUT_MS = 60_000;

export function clearDestinationAiCacheForTests() {
  cache.clear();
  inFlight.clear();
}

export const serializeKrewDiscoveryBrief = (input: AiDiscoveryInput) =>
  JSON.stringify(buildKrewDiscoveryBrief(input));

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
        estimatedDailyCost?: number;
        km?: number;
        estimatedDistanceKm?: number;
        months?: number[];
        bestMonths?: number[];
        candidateClass?: string;
        matchedSignals?: string[];
        compromiseFor?: string[];
        strongMatches?: string[];
        groupsSatisfied?: string[];
        starMatches?: string[];
        potentialWeaknesses?: string[];
        hardConstraintAssessment?: Record<string, string>;
        confidence?: number;
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
      bestMonths?: number[];
      estimatedDailyCost?: number;
      estimatedDistanceKm?: number;
      candidateClass?: string;
      matchedSignals?: string[];
      compromiseFor?: string[];
      strongMatches?: string[];
      groupsSatisfied?: string[];
      starMatches?: string[];
      potentialWeaknesses?: string[];
      hardConstraintAssessment?: Record<string, string>;
      confidence?: number;
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
        const out: AiCandidate = {
          name,
          affinity: Math.max(10, 100 - i * 1.5),
          reason: String(c.why || c.reason || "suggéré par Krew IA").slice(0, 120),
          destinationType,
          anchorPlaces:
            destinationType === "city"
              ? [name]
              : (c.anchorPlaces ?? [])
                  .map(String)
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .slice(0, 5),
          candidateClass: ["strong_match", "smart_compromise", "gem"].includes(
            String(c.candidateClass),
          )
            ? (c.candidateClass as AiCandidate["candidateClass"])
            : "strong_match",
          matchedSignals: compactValues(c.matchedSignals).slice(0, 8),
          compromiseFor: compactValues(c.compromiseFor).slice(0, 6),
          strongMatches: compactValues(c.strongMatches ?? c.matchedSignals).slice(0, 8),
          groupsSatisfied: compactValues(c.groupsSatisfied).slice(0, 8),
          starMatches: compactValues(c.starMatches).slice(0, 6),
          potentialWeaknesses: compactValues(c.potentialWeaknesses).slice(0, 6),
        };
        if (c.hardConstraintAssessment && typeof c.hardConstraintAssessment === "object") {
          out.hardConstraintAssessment = Object.fromEntries(
            Object.entries(c.hardConstraintAssessment)
              .slice(0, 3)
              .map(([key, value]) => [key, String(value).slice(0, 100)]),
          );
        }
        if (c.country) out.country = String(c.country).trim();
        if (c.region) out.region = String(c.region).trim();
        const cost = c.estimatedDailyCost ?? c.cost;
        const distance = c.estimatedDistanceKm ?? c.km;
        if (Number.isFinite(Number(cost)) && Number(cost) > 0) out.dailyCost = Number(cost);
        if (Number.isFinite(Number(distance)) && Number(distance) > 0)
          out.distanceKm = Number(distance);
        const months = c.bestMonths ?? c.months;
        if (Array.isArray(months)) {
          out.bestMonths = months
            .map(Number)
            .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
        }
        if (Number.isFinite(Number(c.confidence)))
          out.confidence = Math.max(0, Math.min(1, Number(c.confidence)));
        return out;
      })
      .filter((c) => c.name.length >= 2)
      .slice(0, 50);
  } catch {
    return [];
  }
}

type AiDiscoveryResult = {
  candidates: AiCandidate[];
  usedLlm: boolean;
  provider?: string;
  error?: string;
  cached?: boolean;
};

async function requestGeminiCandidates(input: AiDiscoveryInput): Promise<AiDiscoveryResult> {
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
        input: serializeKrewDiscoveryBrief(input),
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
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[discovery] Gemini timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
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

export function discoverDestinationsWithAi(input: AiDiscoveryInput): Promise<AiDiscoveryResult> {
  if (process.env["GEMINI_ENABLED"] === "false") {
    return Promise.resolve({ candidates: [], usedLlm: false, error: "gemini_disabled" });
  }
  const fp = fingerprint(input);
  const pending = inFlight.get(fp);
  if (pending) return pending;
  const request = requestGeminiCandidates(input).finally(() => inFlight.delete(fp));
  inFlight.set(fp, request);
  return request;
}
