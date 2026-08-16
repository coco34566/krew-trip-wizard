/**
 * Moteur de recommandation Krew.
 *
 * Fonctions pures : elles reçoivent un catalogue (base + APIs) et le contexte
 * du groupe, puis produisent des propositions scorées.
 */
import { AMBIANCE_SCORE_COLUMN, type Ambiance } from "./constants";
import { bestTransportOption, estimateOptionsByMode, isTransportCompatible, type TransportOption, normalizeTransportModes } from "./transport-compatibility";
import { estimateDistanceKm } from "./deep-links";

export type DestinationRecord = {
  id: string;
  slug: string;
  name: string;
  country: string;
  description: string | null;
  image_url: string | null;
  avg_daily_cost: number;
  distance_from_paris_km: number;
  popularity: number;
  rating: number;
  best_months: number[];
  score_fete: number;
  score_aventure: number;
  score_detente: number;
  score_luxe: number;
  score_insolite: number;
  score_sportif: number;
  score_culturel: number;
  /** Étiquettes de cadre : "Centre-ville / urbain", "Bord de mer", "Montagne"... */
  env_tags?: string[] | null;
};

export type ActivityRecord = {
  id: string;
  destination_id: string;
  name: string;
  category: string;
  description: string | null;
  price_per_person: number;
  duration_hours: number;
  rating: number;
  image_url: string | null;
};

export type AccommodationRecord = {
  id: string;
  destination_id: string;
  name: string;
  type: string;
  description: string | null;
  price_per_night_per_person: number;
  capacity: number;
  rating: number;
  distance_center_km: number;
  image_url: string | null;
  amenities?: string[];
  source?: string;
};

export type TravelCatalog = {
  destinations: DestinationRecord[];
  activities: ActivityRecord[];
  accommodations: AccommodationRecord[];
};

/** Origine de départ d'un sous-groupe de participants. */
export type DepartureOrigin = {
  city: string;
  count: number;
};

/** Préférences brutes d'un participant (pour satisfaction individuelle). */
export type IndividualPreference = {
  ambiances: string[];
  activityCategories: string[];
  budgetMax: number | null;
  budgetPriority?: string;
  dealBreakerAmbiances: string[];
  dealBreakerDestinations: string[];
  transportModes?: string[];
  maxTravelHours?: number | null;
  isStar?: boolean;
  weight?: number;
  desired_destination?: string;
  desiredDestination?: string;
  wantedEnvType?: string | null;
  groupAgeRange?: string | null;
  durationNightsMin?: number | null;
  durationNightsMax?: number | null;
  localMobility?: "walk_transit" | "car_if_worth_it" | "car_ok" | null;
  accommodationRole?: "base_only" | "part_of_stay" | "centerpiece" | null;
};

export type ScoringWeights = {
  ambiance: number;
  activities: number;
  budget: number;
  distance: number;
  season: number;
  quality: number;
  consensus: number;
  minSatisfaction: number;
  historique?: number;
  /** Poids du cadre recherché (urbain / nature / mer / montagne...). */
  environment?: number;
};

export type SubScores = {
  sAmbiance: number;
  sActivities: number;
  sBudget: number;
  sDistance: number;
  sTransport: number;
  sSeason: number;
  sWeather?: number;
  sQuality: number;
  sConsensus: number;
  sMinSatisfaction: number;
  sHistorique?: number;
  sEnvironment?: number;
};

export type ScoringContext = {
  participants: number;
  budgetPerPerson: number;
  nights: number;
  /** Type d'événement du voyage (poids dynamiques). */
  eventType?: string | null;
  /** Poids override (ex. depuis table scoring_weights). */
  scoringWeights?: ScoringWeights | null;
  ambiances: string[];
  activityCategories: string[];
  maxDistanceKm: number;
  excludedCountries: string[];
  desiredDestination?: string | null;
  letKrewDecide: boolean;
  needsCityCenter: boolean;
  startMonth: number;
  /**
   * Prix transport A/R moyen / pers par destination_id
   * (moyenne pondérée si plusieurs villes de départ).
   */
  transportByDestinationId?: Record<string, number>;
  /**
   * Coût transport total groupe par destination_id
   * (somme des cotations par ville de départ × effectif).
   */
  transportGroupByDestinationId?: Record<string, number>;
  /**
   * Détail par origine pour une destination (optionnel, pour affichage).
   * Clé = destination_id.
   */
  transportOriginsByDestinationId?: Record<
    string,
    { city: string; count: number; pricePerPerson: number }[]
  >;
  /** Villes de départ du groupe (agrégées). */
  departureOrigins?: DepartureOrigin[];
  /** Modes de transport acceptés par le groupe. */
  transportModes?: string[];
  /** Réponses individuelles brutes. */
  individualPreferences?: IndividualPreference[];
  /** Budget du participant le plus contraint. */
  minGroupBudget?: number | null;
  /** Ambiances refusées par au moins un participant (exclusion dure). */
  dealBreakerAmbiances?: string[];
  /** Destinations / pays exclus explicitement. */
  dealBreakerDestinations?: string[];
  /** Rythme de voyage agrégé: chill | equilibre | plein_programme */
  travelPace?: string | null;
  /** Flexibilité dates en jours (± autour du mois de départ). */
  dateFlexDays?: number | null;
  /** Note mini hébergement (filtre dur). */
  minAccommodationRating?: number | null;
  /** Plafond veto budget (ne jamais dépasser). */
  vetoBudgetMax?: number | null;
  hasBudgetVeto?: boolean;
  dietaryConstraints?: string[];
  dietaryConstraintsRatio?: number;
  preferredTimeSlots?: string[];
  acceptsSharedRoom?: boolean;
  roomTypePreferences?: string[];
  mostDemandedLodgingType?: string | null;
  requiredAmenities?: string[];
  needsAccessibility?: boolean;
  maxTravelDurationHours?: number | null;
  planeRefused?: boolean;
  blackoutDates?: string[];
  starWantedActivities?: string[];
  starDealBreakers?: string[];
  starWeight?: number;
  /** Cadres recherchés par le groupe (agrégés, triés par fréquence). */
  wantedEnvTypes?: string[];
  /** Cadre recherché par la Star (prioritaire). */
  starWantedEnvType?: string | null;
  /** Caractéristiques des destinations précédemment appréciées (trips validés passés). */
  pastDestinations?: { country: string; dominantAmbiance: string }[];
  /** Tranche d’âge majoritaire du groupe, issue des questionnaires participants. */
  groupAgeRange?: string | null;
  /** Préférence météo agrégée du groupe (0 = agnostique, 1 = neutre, 2 = prioritaire). */
  groupWeatherPreference?: number | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type ItineraryDay = {
  day: number;
  title: string;
  slots: { moment: string; label: string; detail?: string | undefined; price?: number | undefined }[];
};

export type BudgetBreakdown = {
  /** Transport A/R moyen par personne (moyenne pondérée des origines). */
  transport: number;
  /** Transport total groupe (somme des cotations par ville de départ). */
  transportGroup: number;
  accommodation: number;
  activities: number;
  food: number;
  totalPerPerson: number;
  totalGroup: number;
  budgetPerPerson: number;
  /** Compatible avec la médiane / budget agrégé du groupe. */
  fits: boolean;
  /** Compatible avec le budget du participant le plus serré. */
  hardBudgetFits: boolean;
  /** Nb de participants dont budgetMax >= totalPerPerson. */
  budgetFitCount: number;
  /** Nb de participants évalués pour le budget. */
  budgetFitTotal: number;
  /** Source de fraîcheur des prix ('api' si issu d'une cotation réelle ou 'estimate' si estimation). */
  priceSource?: {
    transport: 'api' | 'estimate';
    accommodation: 'api' | 'estimate';
  };
  /** Détail transport par ville de départ si multi-origines. */
  transportByOrigin?: { city: string; count: number; pricePerPerson: number }[];
};

export type Proposal = {
  destination: DestinationRecord;
  accommodation: AccommodationRecord | null;
  activities: ActivityRecord[];
  score: number;
  rationale: string;
  matchReasons: string[];
  itinerary: ItineraryDay[];
  budget: BudgetBreakdown;
  /** Moyenne des fits individuels (0–1). */
  consensusScore: number;
  /** Fit du participant le moins satisfait (0–1). */
  minSatisfaction: number;
  /** Participants avec fit >= 0.55. */
  satisfiedCount: number;
  participantsEvaluated: number;
  /** Sous-scores 0–1 exposés pour feedback / apprentissage. */
  subScores: SubScores;
  originPriceSpread?: number | null;
  transportOptions?: TransportOption[];
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Poids par défaut selon event_type (utilisés si pas de ligne scoring_weights). */
export const DEFAULT_WEIGHTS_BY_EVENT: Record<string, ScoringWeights> = {
  evg: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8, historique: 3, environment: 12 },
  evjf: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8, historique: 3, environment: 12 },
  anniversaire: { ambiance: 22, activities: 16, budget: 14, distance: 8, season: 10, quality: 6, consensus: 14, minSatisfaction: 10, historique: 3, environment: 12 },
  weekend: { ambiance: 14, activities: 12, budget: 28, distance: 12, season: 8, quality: 4, consensus: 12, minSatisfaction: 10, historique: 3, environment: 10 },
  voyage_groupe: { ambiance: 18, activities: 14, budget: 16, distance: 8, season: 8, quality: 5, consensus: 16, minSatisfaction: 15, historique: 3, environment: 12 },
  default: { ambiance: 18, activities: 12, budget: 16, distance: 8, season: 8, quality: 5, consensus: 18, minSatisfaction: 15, historique: 3, environment: 10 },
};

export function resolveWeights(eventType?: string | null, override?: ScoringWeights | null): ScoringWeights {
  if (override) return override;
  const key = (eventType ?? "default").toLowerCase().trim();
  const dict = DEFAULT_WEIGHTS_BY_EVENT as Record<string, ScoringWeights>;
  const val = dict[key] ?? dict["default"];
  if (!val) throw new Error("Missing default weights");
  return val;
}

export function dominantAmbiance(dest: DestinationRecord): string {
  const pairs: [string, number][] = [
    ["fete", dest.score_fete ?? 0],
    ["aventure", dest.score_aventure ?? 0],
    ["detente", dest.score_detente ?? 0],
    ["luxe", dest.score_luxe ?? 0],
    ["insolite", dest.score_insolite ?? 0],
    ["sportif", dest.score_sportif ?? 0],
    ["culturel", dest.score_culturel ?? 0],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0]?.[0] ?? "none";
}

/**
 * Génère une raison courte en français expliquant pourquoi la destination n'a pas été retenue dans le top final.
 */
export function generateRejectionReason(proposal: Proposal): string {
  const reasons: string[] = [];
  const subs = proposal.subScores;

  if (!proposal.budget.fits) {
    reasons.push("budget un peu serré");
  } else if (subs.sBudget < 0.5) {
    reasons.push("coût total élevé");
  }

  if (subs.sAmbiance < 0.55) {
    reasons.push("ambiance moins adaptée aux envies du groupe");
  }

  if (subs.sSeason < 0.6) {
    reasons.push("météo moins favorable sur cette période");
  }

  if (subs.sDistance < 0.4) {
    reasons.push("trajet un peu long");
  }

  if (subs.sConsensus < 0.55 || proposal.consensusScore < 0.55) {
    reasons.push("consensus plus faible au sein du groupe");
  }

  if (reasons.length === 0) {
    reasons.push("score global légèrement en retrait");
  }

  return reasons.slice(0, 2).join(", ");
}

/**
 * Calcule le score de l'historique de l'utilisateur ou du groupe pour une destination donnée.
 */
export function computeHistoriqueScore(
  dest: DestinationRecord,
  pastDestinations?: { country: string; dominantAmbiance: string }[]
): number {
  if (!pastDestinations || pastDestinations.length === 0) return 0;

  let countryMatch = false;
  let ambianceMatch = false;

  const destDom = dominantAmbiance(dest);

  for (const past of pastDestinations) {
    if (past.country && norm(past.country) === norm(dest.country)) {
      countryMatch = true;
    }
    if (past.dominantAmbiance && past.dominantAmbiance === destDom) {
      ambianceMatch = true;
    }
  }

  let score = 0;
  if (countryMatch) score += 0.5;
  if (ambianceMatch) score += 0.5;

  return score;
}


const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Coût transport estimé A/R par personne depuis la distance (fallback). */
export function estimateTransport(distanceKm: number): number {
  if (distanceKm <= 350) return 45;
  if (distanceKm <= 900) return 90;
  if (distanceKm <= 1600) return 130;
  return 130 + (distanceKm - 1600) * 0.05;
}

/** Cadres canoniques (mêmes libellés que les questionnaires). */
export const ENV_TYPES = [
  "Centre-ville / urbain",
  "Quartier animé",
  "Bord de mer",
  "Nature / pleine nature",
  "Village de charme",
  "Montagne",
  "Lac / rivière",
] as const;

/** Cadres considérés comme "nature / hors ville" → hébergement type maison/gîte. */
export const NATURE_ENVS = ["Nature / pleine nature", "Village de charme", "Montagne", "Lac / rivière"];

/**
 * Cadres d'une destination : priorité aux étiquettes stockées en base
 * (`destinations.env_tags`, alimentées par la découverte IA / le catalogue),
 * sinon heuristique sur le nom.
 */
export function getDestinationEnvironments(dest: DestinationRecord | string): string[] {
  if (typeof dest !== "string") {
    const tags = (dest.env_tags ?? []).filter(Boolean);
    if (tags.length) return tags as string[];
    return getDestinationEnvironments(dest.name);
  }
  const name = dest.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (["barcelone", "barcelona", "lisbonne", "lisbon", "porto", "nice", "valencia", "valence", "marseille", "split", "dubrovnik"].some(c => name.includes(c))) {
    return ["Bord de mer", "Quartier animé", "Centre-ville / urbain"];
  }
  if (["rome", "milan", "amsterdam", "berlin", "prague", "budapest", "vienne", "vienna", "londres", "london", "paris", "madrid", "bruxelles", "brussels", "bordeaux", "lyon"].some(c => name.includes(c))) {
    return ["Centre-ville / urbain", "Quartier animé"];
  }
  if (["luberon", "ardeche", "provence"].some(c => name.includes(c))) {
    return ["Nature / pleine nature", "Village de charme"];
  }
  if (["chamonix", "alpes", "montagne"].some(c => name.includes(c))) {
    return ["Nature / pleine nature", "Montagne"];
  }
  if (["annecy", "lac", "verdon", "riviere"].some(c => name.includes(c))) {
    return ["Nature / pleine nature", "Lac / rivière"];
  }
  if (["plage", "beach", "cote", "coast", "ile ", "island", "mer"].some(c => name.includes(c))) {
    return ["Bord de mer", "Nature / pleine nature"];
  }
  if (["campagne", "foret", "parc naturel", "vallee", "domaine", "gite"].some(c => name.includes(c))) {
    return ["Nature / pleine nature", "Village de charme"];
  }
  return ["Centre-ville / urbain"];
}


function ageBudgetMultiplier(groupAgeRange?: string | null): number {
  const age = norm(groupAgeRange ?? "");
  if (!age) return 1;
  if (age.includes("18-25") || age.includes("25-35") || age.includes("18") || age.includes("jeune")) return 0.85;
  if (age.includes("45-60") || age.includes("60+") || age.includes("60") || age.includes("senior")) return 1.18;
  if (age.includes("35-45")) return 1.05;
  return 1;
}

function normalizeEnvType(value: string): string | null {
  const n = norm(value);
  if (!n) return null;
  if (/champetre|campagne|rural|nature|pleine nature|foret|forêt|domaine|gite|gîte/.test(n)) return "Nature / pleine nature";
  if (/village|charme/.test(n)) return "Village de charme";
  if (/mer|plage|bord de mer|ocean|océan|cote|côte/.test(n)) return "Bord de mer";
  if (/montagne|alpes|ski/.test(n)) return "Montagne";
  if (/lac|riviere|rivière/.test(n)) return "Lac / rivière";
  if (/anime|animé|quartier|sortie/.test(n)) return "Quartier animé";
  if (/ville|urbain|centre/.test(n)) return "Centre-ville / urbain";
  return value.trim();
}

function splitEnvTypes(values: (string | null | undefined)[]): string[] {
  return values
    .flatMap((v) => String(v ?? "").split(/[,;|]/))
    .map((v) => normalizeEnvType(v.trim()))
    .filter((v): v is string => Boolean(v));
}

function environmentScore(destEnvs: string[], wantedEnvTypes: string[], starEnvTypes: string[]): number {
  const wanted = splitEnvTypes(wantedEnvTypes);
  const starWanted = splitEnvTypes(starEnvTypes);
  const destNorms = new Set(splitEnvTypes(destEnvs));
  if (!wanted.length && !starWanted.length) return 0.6;

  const groupScore = wanted.length
    ? wanted.filter((env) => destNorms.has(env)).length / wanted.length
    : 0.6;
  const starScore = starWanted.length
    ? starWanted.filter((env) => destNorms.has(env)).length / starWanted.length
    : groupScore;
  return clamp(groupScore * 0.72 + starScore * 0.28);
}

function ambianceScore(dest: DestinationRecord, ambiances: string[]): number {
  if (!ambiances.length) return 0.6;
  const values = ambiances.map((a) => {
    const col = AMBIANCE_SCORE_COLUMN[a as Ambiance];
    return col ? Number((dest as unknown as Record<string, number>)[col] ?? 0) : 0;
  });
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  // Destinations découvertes dynamiquement n'ont pas encore de scores seed → neutre
  if (avg === 0) return 0.55;
  return avg;
}

function seasonScore(dest: DestinationRecord, month: number): number {
  if (!dest.best_months?.length) return 0.6;
  if (dest.best_months.includes(month)) return 1;
  const distance = Math.min(
    ...dest.best_months.map((m) => Math.min(Math.abs(m - month), 12 - Math.abs(m - month))),
  );
  return clamp(1 - distance * 0.22, 0.15, 1);
}

/** Meilleur score saison sur la fenêtre [startMonth ± flexMonths]. */
function seasonScoreWithFlex(dest: DestinationRecord, startMonth: number, dateFlexDays?: number | null): number {
  const flexMonths = Math.max(0, Math.min(3, Math.ceil((dateFlexDays ?? 0) / 14)));
  let best = seasonScore(dest, startMonth);
  for (let d = -flexMonths; d <= flexMonths; d++) {
    if (d === 0) continue;
    const m = ((startMonth - 1 + d + 12) % 12) + 1;
    best = Math.max(best, seasonScore(dest, m));
  }
  return best;
}

/**
 * Calcule un weatherScore complémentaire :
 * - Si des dates précises avec données de prévisions réelles sont disponibles dans climate.forecast, on les utilise.
 * - Sinon, on utilise les normales historiques du ou des mois concernés dans climate.months.
 */
export function computeWeatherScore(
  dest: DestinationRecord,
  startDate?: string | null,
  endDate?: string | null,
  startMonth = 5
): number {
  const climate = (dest as any).climate;
  if (!climate || typeof climate !== "object") {
    return 0.6; // Fallback par défaut
  }

  // 1. Essai avec les données prévisionnelles réelles si disponibles
  const forecast = climate.forecast;
  if (Array.isArray(forecast) && forecast.length > 0 && startDate) {
    const startIso = startDate.slice(0, 10);
    const endIso = endDate ? endDate.slice(0, 10) : startIso;
    const relevantForecasts = forecast.filter((f: any) => f.date >= startIso && f.date <= endIso);

    if (relevantForecasts.length > 0) {
      const temps = relevantForecasts.map((f: any) => Number(f.tempMax ?? f.temperature_2m_max ?? 20));
      const rain = relevantForecasts.map((f: any) => Number(f.precipitationMm ?? f.precipitation_sum ?? 0));

      const tempAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
      const totalRain = rain.reduce((a, b) => a + b, 0);

      // On score par rapport à une température idéale (23°C) et l'absence de pluie
      const tempScore = 1.0 - Math.min(0.6, Math.abs(tempAvg - 23) * 0.05);
      const rainScore = 1.0 - Math.min(0.8, totalRain * 0.05);

      return clamp(tempScore * 0.6 + rainScore * 0.4, 0.1, 1.0);
    }
  }

  // 2. Sinon, données historiques adaptées à la période
  const months = climate.months;
  if (Array.isArray(months) && months.length > 0) {
    const mData = months.find((m: any) => m.month === startMonth);
    if (mData) {
      const tempMaxAvg = Number(mData.tempMaxAvg ?? mData.temp_max_avg ?? 18);
      const precipitationMm = Number(mData.precipitationMm ?? mData.precipitation_mm ?? 50);

      // Température idéale à 22°C, précipitation modérée à 150mm/mois max
      const tempScore = 1.0 - Math.min(0.6, Math.abs(tempMaxAvg - 22) * 0.04);
      const rainScore = 1.0 - Math.min(0.8, precipitationMm / 150);

      return clamp(tempScore * 0.6 + rainScore * 0.4, 0.15, 1.0);
    }
  }

  return 0.6; // Fallback
}

function activitiesPerDayForPace(travelPace?: string | null): number {
  const p = (travelPace ?? "equilibre").toLowerCase();
  if (p === "chill") return 1;
  if (p === "plein_programme" || p === "intense") return 3;
  return 2;
}

/**
 * Couverture de catégories d'abord : 1 activité min par wantedCategory si budget le permet,
 * puis complétion par note.
 */
function activityMatchScore(
  a: ActivityRecord,
  wantedCategories: string[],
  starWanted: string[],
  dietaryConstraintsRatio = 0,
  groupAgeRange?: string | null,
  preferredTimeSlots: string[] = [],
): number {
  let s = Number(a.rating ?? 0) * 0.15;
  if (wantedCategories.includes(a.category)) s += 1.2;
  const blob = `${a.name} ${a.category}`.toLowerCase();
  for (const w of starWanted) {
    const needle = String(w).toLowerCase().replace(/_/g, " ");
    if (!needle) continue;
    if (blob.includes(needle) || a.category === w) s += 2.0; // Star prioritaire
    else if (needle.split(" ").some((tok) => tok.length > 3 && blob.includes(tok))) s += 1.0;
  }

  // Tâche 10 : Ajustement ciblé sur les suggestions de restaurants/gastronomie en fonction de la proportion du groupe concernée par une contrainte alimentaire
  const isResto = /gastro|resto|food|cuisine/i.test(a.category + a.name);
  if (isResto && dietaryConstraintsRatio > 0) {
    s -= dietaryConstraintsRatio * 1.5; // Ajustement doux et proportionnel (jusqu'à -1.5 points de score)
  }

  // Tâche 5 : Ajustement ciblé selon la tranche d'âge du groupe
  if (groupAgeRange) {
    if (groupAgeRange === "18-25" || groupAgeRange === "25-35") {
      // Jeunes : Fête, sensations, soirées, bars
      if (/soirees|bars_clubs|sensations/i.test(a.category)) {
        s += 1.5;
      }
    } else if (groupAgeRange === "45-60" || groupAgeRange === "60+") {
      // Plus âgés : Culture, gastronomie, détente
      if (/culture|gastronomie|detente/i.test(a.category)) {
        s += 1.5;
      }
    }
  }

  // Rythme & créneaux horaires
  if (preferredTimeSlots.length > 0) {
    const normSlots = preferredTimeSlots.map((st) => st.toLowerCase());
    const isNight = /soirees|bars_clubs|night/i.test(a.category) || blob.includes("soir") || blob.includes("night");
    const isMorning = /culture|museum|visite/i.test(a.category) || blob.includes("matin") || blob.includes("balade");
    if (normSlots.some((st) => st.includes("soir") || st.includes("nuit")) && isNight) s += 0.8;
    if (normSlots.some((st) => st.includes("matin")) && isMorning) s += 0.8;
    if (normSlots.some((st) => st.includes("apres") || st.includes("midi")) && !isNight) s += 0.4;
  }

  return s;
}

/**
 * Phase 2 scoring — activités :
 * maximise la couverture des catégories groupe + boost des envies Star, dans le budget restant.
 */
function pickActivities(
  pool: ActivityRecord[],
  wantedCategories: string[],
  nights: number,
  budgetForActivities: number,
  travelPace?: string | null,
  starWantedActivities?: string[] | null,
  dietaryConstraintsRatio = 0,
  groupAgeRange?: string | null,
  preferredTimeSlots: string[] = [],
): ActivityRecord[] {
  const perDay = activitiesPerDayForPace(travelPace);
  const maxCount = Math.max(perDay, (nights + 1) * perDay - (travelPace === "chill" ? 1 : 0));
  const picked: ActivityRecord[] = [];
  let spent = 0;
  const used = new Set<string>();
  const starWanted = starWantedActivities ?? [];

  const rank = (a: ActivityRecord, b: ActivityRecord) =>
    activityMatchScore(b, wantedCategories, starWanted, dietaryConstraintsRatio, groupAgeRange, preferredTimeSlots) -
    activityMatchScore(a, wantedCategories, starWanted, dietaryConstraintsRatio, groupAgeRange, preferredTimeSlots);

  // 1) Priorité aux envies Star (si renseignées)
  for (const w of starWanted) {
    if (picked.length >= maxCount) break;
    const needle = String(w).toLowerCase().replace(/_/g, " ");
    const candidates = pool
      .filter((a) => !used.has(a.id))
      .filter((a) => {
        const blob = `${a.name} ${a.category}`.toLowerCase();
        return blob.includes(needle) || a.category === w;
      })
      .sort(rank);
    const best = candidates[0];
    if (!best) continue;
    if (spent + best.price_per_person > budgetForActivities && picked.length >= 1) continue;
    picked.push(best);
    used.add(best.id);
    spent += best.price_per_person;
  }

  // 2) Couverture des catégories d'activités du groupe
  for (const cat of wantedCategories) {
    if (picked.length >= maxCount) break;
    const candidates = pool
      .filter((a) => a.category === cat && !used.has(a.id))
      .sort(rank);
    const best = candidates[0];
    if (!best) continue;
    if (spent + best.price_per_person > budgetForActivities && picked.length >= 1) continue;
    picked.push(best);
    used.add(best.id);
    spent += best.price_per_person;
  }

  // 3) Complétion par score de match global
  const ranked = [...pool].filter((a) => !used.has(a.id)).sort(rank);
  for (const a of ranked) {
    if (picked.length >= maxCount) break;
    if (spent + a.price_per_person > budgetForActivities && picked.length >= 1) continue;
    picked.push(a);
    used.add(a.id);
    spent += a.price_per_person;
  }

  return picked;
}


function momentOrder(preferred?: string[] | null): string[] {
  const base = ["Matin", "Après-midi", "Soirée"];
  if (!preferred?.length) return base;
  const map: Record<string, string> = {
    matin: "Matin",
    apres_midi: "Après-midi",
    "après-midi": "Après-midi",
    soir: "Soirée",
    soiree: "Soirée",
    "soirée": "Soirée",
  };
  const ordered = preferred
    .map((p) => map[norm(p)] ?? map[p.toLowerCase()])
    .filter(Boolean) as string[];
  const rest = base.filter((m) => !ordered.includes(m));
  return [...ordered, ...rest];
}

function buildItinerary(
  destination: DestinationRecord,
  accommodation: AccommodationRecord | null,
  activities: ActivityRecord[],
  nights: number,
  travelPace?: string | null,
  preferredTimeSlots?: string[] | null,
): ItineraryDay[] {
  const days = Math.max(1, nights + 1);
  const queue = [...activities];
  const perDayTarget = activitiesPerDayForPace(travelPace);
  const itinerary: ItineraryDay[] = [];
  for (let day = 1; day <= days; day++) {
    const slots: ItineraryDay["slots"] = [];
    if (day === 1) {
      slots.push({
        moment: "Matin",
        label: `Arrivée à ${destination.name}`,
        detail: "Transfert et dépôt des bagages",
      });
      if (accommodation) {
        slots.push({
          moment: "Après-midi",
          label: `Check-in — ${accommodation.name}`,
          detail: accommodation.description ?? undefined,
        });
      }
    }
    const perDay = day === days ? Math.min(1, perDayTarget) : perDayTarget;
    const moments = momentOrder(preferredTimeSlots);
    for (let i = 0; i < perDay; i++) {
      const activity = queue.shift();
      if (!activity) break;
      const moment = moments[Math.min(i + (day === 1 ? 1 : 0), moments.length - 1)] ?? "Après-midi";
      slots.push({
        moment,
        label: activity.name,
        detail: activity.description ?? undefined,
        price: activity.price_per_person,
      });
    }
    if (day === days) {
      slots.push({
        moment: "Fin de journée",
        label: "Brunch de clôture puis retour",
        detail: "Départ groupé vers l'aéroport / la gare",
      });
    }
    itinerary.push({
      day,
      title: day === 1 ? "Arrivée & mise en jambes" : day === days ? "Dernière ligne droite" : `Journée ${day}`,
      slots,
    });
  }
  return itinerary;
}

/** True si la destination tombe sous un deal-breaker explicite. */
function hitsDealBreaker(
  dest: DestinationRecord,
  dealAmbiances: string[],
  dealDestinations: string[],
): boolean {
  for (const d of dealDestinations ?? []) {
    const nd = norm(d);
    if (!nd) continue;
    if (norm(dest.name).includes(nd) || norm(dest.country).includes(nd) || nd.includes(norm(dest.name))) {
      return true;
    }
  }
  for (const a of dealAmbiances ?? []) {
    const col = AMBIANCE_SCORE_COLUMN[a as Ambiance];
    if (!col) continue;
    const v = Number((dest as unknown as Record<string, number>)[col] ?? 0);
    // Ambiance dominante refusée (≥ 0.7)
    if (v >= 0.7) return true;
  }
  return false;
}

export function getNormalizedBudgetPriority(p: string | null | undefined): "must_have" | "nice_to_have" {
  const clean = String(p ?? "").toLowerCase().trim();
  if (clean === "must_have" || clean === "veto" || clean === "high_priority") {
    return "must_have";
  }
  return "nice_to_have";
}

/**
 * Fit 0–1 d'un participant pour une destination / offre donnée.
 */
function individualFit(
  dest: DestinationRecord,
  availableCategories: Set<string>,
  totalPerPerson: number,
  pref: IndividualPreference,
  bestDuration?: number | null,
  nights?: number | null,
): number {
  if (hitsDealBreaker(dest, pref.dealBreakerAmbiances, pref.dealBreakerDestinations)) {
    return 0;
  }

  // Hard constraint: Budget must_have (Incontournable)
  const priority = getNormalizedBudgetPriority(pref.budgetPriority);
  if (priority === "must_have" && pref.budgetMax != null && totalPerPerson > pref.budgetMax) {
    return 0;
  }

  // Transport compatibility from participant's actual departure city
  let sTransportPart = 0.7;
  const pCity = pref.departureCity || "Paris";
  const pDist = estimateDistanceKm(pCity, dest.name, dest.distance_from_paris_km);
  const pModeOptions = estimateOptionsByMode(pDist, pref.transportModes);

  if (pref.transportModes && pref.transportModes.length > 0) {
    const hasCompatibleUserMode = pModeOptions.some(
      (o) => pref.maxTravelHours == null || o.durationHours <= pref.maxTravelHours,
    );
    if (!hasCompatibleUserMode) {
      sTransportPart = 0.15; // Low satisfaction for this participant without becoming a hard group veto
    } else {
      const bestOpt = bestTransportOption(pModeOptions, pref.maxTravelHours);
      sTransportPart = bestOpt ? clamp(1.0 - bestOpt.durationHours / 12, 0.3, 1.0) : 0.7;
    }
  }

  const ambiances = pref.ambiances ?? [];
  let sAmb = ambianceScore(dest, ambiances.length ? ambiances : []);
  const wanted = pref.activityCategories ?? [];
  const sAct = wanted.length
    ? wanted.filter((c) => availableCategories.has(c)).length / wanted.length
    : 0.6;
  let sBudget = 0.7;
  if (pref.budgetMax != null && pref.budgetMax > 0) {
    const ratio = totalPerPerson / pref.budgetMax;
    const priority = getNormalizedBudgetPriority(pref.budgetPriority);
    if (priority === "must_have") {
      if (ratio > 1.0) {
        return 0; // Extra safety
      }
      sBudget = clamp(0.85 + (1 - ratio) * 0.15);
    } else {
      // nice_to_have: soft preference
      sBudget = ratio <= 1
        ? clamp(0.75 + (1 - ratio) * 0.25)
        : clamp(0.75 - (ratio - 1) * 0.5, 0.2, 0.75); // soft penalty, minimum 0.2
    }
  }

  // Tâche 10 : Destinations rêvées / à éviter individuelles
  const prefEnv = splitEnvTypes([pref.wantedEnvType]);
  const destEnvSet = new Set(splitEnvTypes(getDestinationEnvironments(dest)));
  const sEnv = prefEnv.length
    ? prefEnv.filter((env) => destEnvSet.has(env)).length / prefEnv.length
    : 0.6;

  let score = sAmb * 0.28 + sAct * 0.23 + sBudget * 0.23 + sEnv * 0.11 + sTransportPart * 0.15;

  // Soft preference: duration_nights
  if (nights != null) {
    if (pref.durationNightsMin != null && nights < pref.durationNightsMin) {
      score -= 0.15;
    }
    if (pref.durationNightsMax != null && nights > pref.durationNightsMax) {
      score -= 0.15;
    }
  }

  // Bonus si la destination correspond à la destination rêvée du participant (s'il en a une)
  // On compare de manière souple
  if (pref.desired_destination || pref.desiredDestination) {
    const desired = norm(pref.desired_destination || pref.desiredDestination || "");
    const destName = norm(dest.name);
    const destCountry = norm(dest.country);
    if (desired && (destName.includes(desired) || desired.includes(destName) || destCountry.includes(desired))) {
      score += 0.25; // Bonus significatif de +25% de satisfaction individuelle
    }
  }

  return clamp(score);
}

/**
 * Calcule la distance de Haversine entre deux points géographiques (en km).
 */
export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filtre strict déterministe pour s'assurer que l'hébergement correspond à la destination.
 * Rejette si la distance de Haversine > 45km ou distance_center_km > 45km,
 * ou en cas d'incohérence textuelle flagrante.
 */
export function isAccommodationInDestination(
  dest: DestinationRecord,
  acc: AccommodationRecord
): boolean {
  // 1. Validation géographique par coordonnées si disponibles
  const destLat = (dest as any).latitude;
  const destLon = (dest as any).longitude;
  const accLat = (acc as any).latitude;
  const accLon = (acc as any).longitude;

  if (
    destLat != null &&
    destLon != null &&
    accLat != null &&
    accLon != null
  ) {
    const distance = getHaversineDistance(
      Number(destLat),
      Number(destLon),
      Number(accLat),
      Number(accLon)
    );
    if (distance > 45) {
      return false; // Rejet strict
    }
  }

  // 2. Distance par rapport au centre-ville
  if (acc.distance_center_km != null && Number(acc.distance_center_km) > 45) {
    return false;
  }

  // 3. Incohérence textuelle (ex. hébergement à Cherbourg pour destination Bruxelles)
  const normAccName = norm(acc.name);
  const normDestName = norm(dest.name);

  if (normDestName === "bruxelles" && normAccName.includes("cherbourg")) {
    return false;
  }

  return true;
}

export type AccommodationConfig = {
  id: string;
  name: string;
  type: string;
  unitsCount: number;
  capacityPerUnit: number;
  totalCapacity: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  priceBase: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  totalCost: number;
  pricePerPerson: number;
  pricePerPersonPerNight: number;
  explanation: string;
  category: "rapport_qualite_prix" | "confort" | "emplacement" | "standard";
};

export function generateAccommodationConfigurations(
  accommodations: AccommodationRecord[],
  participants: number,
  nights: number,
  destination: DestinationRecord,
  groupAgeRange?: string | null,
  individualPreferences?: IndividualPreference[]
): AccommodationConfig[] {
  const configs: AccommodationConfig[] = [];

  // Détection des demandes de chambre individuelle vs partagée
  let soloCount = 0;
  if (individualPreferences && individualPreferences.length > 0) {
    for (const pref of individualPreferences) {
      const roomPref = norm((pref as any).roomTypePreference || (pref as any).room_type_preference || "");
      const acceptsShared = (pref as any).acceptsSharedRoom ?? (pref as any).accepts_shared_room ?? true;
      if (roomPref.includes("individuelle") || roomPref.includes("single") || roomPref.includes("solo") || acceptsShared === false) {
        soloCount++;
      }
    }
  }
  const remainingCount = Math.max(0, participants - soloCount);

  for (const acc of accommodations) {
    // 1. Capacité unitaire
    const cap = Math.max(1, acc.capacity);

    // 2. Type normalisé
    const rawType = String(acc.type || "hotel").toLowerCase();
    let type = "autre";
    if (/h[oô]tel|chambre/i.test(rawType)) {
      type = "hôtel";
    } else if (/appart|studio/i.test(rawType)) {
      type = "appartement";
    } else if (/villa|maison|gite|gîte|chalet|mas/i.test(rawType)) {
      type = "villa";
    } else if (/hostel|auberge/i.test(rawType)) {
      type = "auberge";
    }

    // 3. Génération des configurations possibles pour cet hébergement
    let configsToGenerate: {
      unitsCount: number;
      capacityPerUnit: number;
      name: string;
      isMixed?: boolean;
      customExplanation?: string;
    }[] = [];

    if (cap >= participants) {
      // Configuration "Tout le monde ensemble"
      let name = "";
      if (type === "villa") {
        name = "Maison / Villa entière";
      } else if (type === "appartement") {
        name = "Appartement entier";
      } else if (type === "hôtel") {
        name = "Suite ou Privatisation Hôtel";
      } else {
        name = "Logement entier";
      }
      configsToGenerate.push({
        unitsCount: 1,
        capacityPerUnit: cap,
        name,
      });
    }

    // Configuration mixte si certains veulent solo et d'autres partagent
    if (soloCount > 0 && remainingCount > 0) {
      const sharedUnits = Math.ceil(remainingCount / 2);
      const totalUnits = soloCount + sharedUnits;
      configsToGenerate.push({
        unitsCount: totalUnits,
        capacityPerUnit: 2,
        name: `${soloCount} chambre(s) individuelle(s) + ${sharedUnits} chambre(s) double(s)`,
        isMixed: true,
        customExplanation: `Configuration mixte sur mesure : ${soloCount} chambre(s) individuelle(s) pour préserver l'intimité de ceux qui le demandent, et ${sharedUnits} chambre(s) partagée(s) pour le reste du groupe.`,
      });
    }

    // Configuration par division
    if (cap < participants) {
      const unitsCount = Math.ceil(participants / cap);
      let name = "";
      if (type === "hôtel") {
        if (cap === 2) name = `${unitsCount} chambres doubles dans un hôtel`;
        else if (cap === 4) name = `${unitsCount} chambres quadruples dans un hôtel`;
        else name = `${unitsCount} chambres de ${cap} personnes dans un hôtel`;
      } else if (type === "appartement") {
        name = `${unitsCount} appartements de ${cap} personnes`;
      } else if (type === "auberge") {
        name = `${unitsCount} dortoirs / chambres partagées`;
      } else {
        name = `${unitsCount} hébergements de ${cap} personnes`;
      }
      configsToGenerate.push({
        unitsCount,
        capacityPerUnit: cap,
        name,
      });
    } else if (cap >= 4 && participants > 2) {
      // Proposer aussi chambres doubles hôtelières
      const doubleRoomsCount = Math.ceil(participants / 2);
      configsToGenerate.push({
        unitsCount: doubleRoomsCount,
        capacityPerUnit: 2,
        name: `${doubleRoomsCount} chambres doubles dans un hôtel`,
      });
    }

    // Caractéristiques et coûts réels pour chaque configuration
    for (const item of configsToGenerate) {
      let bedrooms = 1;
      let bathrooms = 1;
      let beds = 1;

      if (type === "villa") {
        bedrooms = Math.max(1, Math.ceil(participants / 2));
        bathrooms = Math.max(1, Math.ceil(bedrooms / 2));
        beds = Math.max(1, Math.ceil(participants / 1.5));
      } else if (type === "appartement") {
        bedrooms = Math.max(1, Math.ceil((item.unitsCount * item.capacityPerUnit) / 2.5));
        bathrooms = Math.max(1, Math.ceil((item.unitsCount * item.capacityPerUnit) / 4));
        beds = Math.max(1, Math.ceil(participants / 1.8));
      } else {
        bedrooms = item.unitsCount;
        bathrooms = item.unitsCount;
        beds = Math.max(1, Math.ceil(participants / 1.8));
      }

      const priceBase = acc.price_per_night_per_person * participants * nights;

      // Provider totals are canonical. Never synthesize fees or taxes that the
      // provider did not return.
      const cleaningFee = 0;
      const serviceFee = 0;
      const taxes = 0;
      const totalCost = priceBase + cleaningFee + serviceFee + taxes;
      const pricePerPerson = Math.round(totalCost / participants);
      const pricePerPersonPerNight = Math.round(pricePerPerson / nights);

      let explanation = item.customExplanation || "";
      if (!explanation) {
        if (item.unitsCount === 1 && (type === "villa" || type === "gîte" || type === "maison")) {
          explanation = `Elle permet aux ${participants} personnes de rester ensemble dans un même logement, possède ${bedrooms} chambres et revient moins cher par personne que des alternatives hôtelières.`;
        } else if (item.unitsCount === 1 && type === "appartement") {
          explanation = `Permet au groupe entier de loger ensemble dans un grand appartement de ${bedrooms} chambres, idéal pour la cohésion.`;
        } else if (type === "hôtel") {
          explanation = `Idéal pour préserver l'intimité de chacun avec ${item.unitsCount} chambres hôtelières de qualité tout en profitant des services de l'hôtel.`;
        } else {
          explanation = `Répartit le groupe confortablement dans ${item.unitsCount} logements indépendants de type ${rawType}.`;
        }
      }

      let category: AccommodationConfig["category"] = "standard";

      configs.push({
        id: `${acc.id}||${item.unitsCount}||${item.capacityPerUnit}`,
        name: item.name,
        type,
        unitsCount: item.unitsCount,
        capacityPerUnit: item.capacityPerUnit,
        totalCapacity: item.unitsCount * item.capacityPerUnit,
        bedrooms,
        beds,
        bathrooms,
        priceBase,
        cleaningFee,
        serviceFee,
        taxes,
        totalCost,
        pricePerPerson,
        pricePerPersonPerNight,
        explanation,
        category,
        isMixed: item.isMixed ?? false,
      } as any);
    }
  }

  // Catégorisation dynamique des meilleures configurations
  if (configs.length > 0) {
    const sortedByPrice = [...configs].sort((a, b) => a.pricePerPerson - b.pricePerPerson);
    if (sortedByPrice[0]) {
      sortedByPrice[0].category = "rapport_qualite_prix";
    }

    const sortedByComfort = [...configs].sort((a, b) => {
      const densityA = participants / a.bedrooms;
      const densityB = participants / b.bedrooms;
      if (densityA !== densityB) return densityA - densityB;
      return b.bathrooms - a.bathrooms;
    });
    const bestComfort = sortedByComfort.find(c => c.id !== sortedByPrice[0]?.id) || sortedByComfort[0];
    if (bestComfort) {
      bestComfort.category = "confort";
    }

    const sortedByLocation = [...configs].sort((a, b) => {
      const distA = a.id.split("||")[0];
      const accA = accommodations.find(acc => acc.id === distA);
      const accB = accommodations.find(acc => acc.id === b.id.split("||")[0]);
      return (accA?.distance_center_km ?? 99) - (accB?.distance_center_km ?? 99);
    });
    const bestLocation = sortedByLocation.find(c => c.category === "standard") || sortedByLocation[0];
    if (bestLocation) {
      bestLocation.category = "emplacement";
    }
  }

  return configs;
}

export function buildProposals(catalog: TravelCatalog, ctx: ScoringContext, limit = 3): Proposal[] {
  const excluded = ctx.excludedCountries.map(norm).filter(Boolean);
  const desired = ctx.desiredDestination ? norm(ctx.desiredDestination) : "";
  const dealAmb = ctx.dealBreakerAmbiances ?? [];
  const dealDest = ctx.dealBreakerDestinations ?? [];
  const minRating = ctx.minAccommodationRating ?? 0;

  let planeRefusedBypassed = false;
  let maxDurationBypassed = false;

  let candidates = catalog.destinations.filter((d) => {
    if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
    if (d.distance_from_paris_km > ctx.maxDistanceKm * 1.15) return false;
    if (ctx.planeRefused && d.distance_from_paris_km > 700) return false;
    const modeOptions = estimateOptionsByMode(d.distance_from_paris_km, ctx.transportModes);
    if (!isTransportCompatible(modeOptions, ctx.maxTravelDurationHours)) return false;
    if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
    return true;
  });

  // Fallback 1: PlaneRefused
  if (candidates.length === 0 && ctx.planeRefused) {
    candidates = catalog.destinations.filter((d) => {
      if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
      if (d.distance_from_paris_km > ctx.maxDistanceKm * 1.15) return false;
      const modeOptions = estimateOptionsByMode(d.distance_from_paris_km, ctx.transportModes);
      if (!isTransportCompatible(modeOptions, ctx.maxTravelDurationHours)) return false;
      if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
      return true;
    });
    if (candidates.length > 0) {
      planeRefusedBypassed = true;
    }
  }

  // Fallback 2: Max travel hours
  if (candidates.length === 0 && ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0) {
    candidates = catalog.destinations.filter((d) => {
      if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
      if (ctx.planeRefused && d.distance_from_paris_km > 700) return false;
      if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
      return true;
    });
    if (candidates.length > 0) {
      maxDurationBypassed = true;
    }
  }

  // Fallback 3: Both
  if (candidates.length === 0) {
    candidates = catalog.destinations.filter((d) => {
      if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
      if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
      return true;
    });
    if (candidates.length > 0) {
      planeRefusedBypassed = ctx.planeRefused || false;
      maxDurationBypassed = Boolean(ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0);
    }
  }

  const allDestinationProposals: Proposal[] = [];

  for (const destination of candidates) {
    const destEnvs = getDestinationEnvironments(destination);
    const wantedEnvTypes = (ctx.wantedEnvTypes ?? []).filter(Boolean);
    const starEnvTypes = String(ctx.starWantedEnvType ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const normalizedWantedEnvs = splitEnvTypes([...wantedEnvTypes, ...starEnvTypes]);
    const envIsNature =
      normalizedWantedEnvs.some((e) => NATURE_ENVS.includes(e)) &&
      !normalizedWantedEnvs.some((e) => e === "Centre-ville / urbain" || e === "Quartier animé");

    // Filtrage strict des hébergements par destination et validation géographique déterministe
    let matchedAccommodations = catalog.accommodations
      .filter((a) => a.destination_id === destination.id)
      .filter((a) => isAccommodationInDestination(destination, a))
      .filter((a) => (minRating > 0 ? a.rating >= minRating - 0.05 : true));

    // Élimination des options incompatibles avec les équipements explicitement obligatoires
    const reqAmenitiesClean = (ctx.requiredAmenities ?? [])
      .map(norm)
      .filter((a) => a && a !== "peu_importe" && a !== "none");

    if (reqAmenitiesClean.length > 0) {
      const withAmenities = matchedAccommodations.filter((acc) => {
        const accAmenities = (acc.amenities ?? []).map(norm);
        const nameAndType = norm(`${acc.name} ${acc.type} ${acc.description ?? ""}`);
        return reqAmenitiesClean.every((req) =>
          accAmenities.some((a) => a.includes(req) || req.includes(a)) || nameAndType.includes(req)
        );
      });
      if (withAmenities.length > 0) {
        matchedAccommodations = withAmenities;
      }
    }

    // Génération des configurations complètes avec prise en compte des préférences individuelles de chambre
    const destConfigs = generateAccommodationConfigurations(
      matchedAccommodations,
      ctx.participants,
      ctx.nights,
      destination,
      ctx.groupAgeRange,
      ctx.individualPreferences
    );

    // Fallback de configuration neutre si aucun hébergement n'est disponible
    if (destConfigs.length === 0) {
      destConfigs.push({
        id: `fallback-${destination.id}`,
        name: "Hébergement estimé (hôtel ou gîte)",
        type: "estimation",
        unitsCount: 1,
        capacityPerUnit: ctx.participants,
        totalCapacity: ctx.participants,
        bedrooms: Math.max(1, Math.ceil(ctx.participants / 2)),
        beds: Math.max(1, Math.ceil(ctx.participants / 1.5)),
        bathrooms: Math.max(1, Math.ceil(ctx.participants / 4)),
        priceBase: destination.avg_daily_cost * 0.4 * ctx.participants * ctx.nights,
        cleaningFee: 0,
        serviceFee: 0,
        taxes: Math.round(ctx.participants * ctx.nights * 2.5),
        totalCost: destination.avg_daily_cost * 0.4 * ctx.participants * ctx.nights + Math.round(ctx.participants * ctx.nights * 2.5),
        pricePerPerson: destination.avg_daily_cost * 0.4 * ctx.nights + Math.round(ctx.nights * 2.5),
        pricePerPersonPerNight: destination.avg_daily_cost * 0.4 + 2.5,
        explanation: "Estimation basée sur les coûts moyens de l'hébergement dans la destination.",
        category: "standard",
      });
    }

    const sharedOk = ctx.acceptsSharedRoom !== false;
    const preferredLodgingType = ctx.mostDemandedLodgingType;
    const reqAmenities = ctx.requiredAmenities ?? [];

    const destProposals: Proposal[] = [];

    for (const config of destConfigs) {
      const rawAcc = config.id.startsWith("fallback-")
        ? null
        : matchedAccommodations.find((a) => a.id === config.id.split("||")[0]) || null;

      const estimatedModeOptions = estimateOptionsByMode(destination.distance_from_paris_km, ctx.transportModes);
      const bestModeOption = bestTransportOption(estimatedModeOptions, ctx.maxTravelDurationHours);
      const transport =
        ctx.transportByDestinationId?.[destination.id] ??
        bestModeOption?.pricePerPerson ??
        estimateTransport(destination.distance_from_paris_km);
      const transportOrigins = ctx.transportOriginsByDestinationId?.[destination.id];
      const transportGroup =
        ctx.transportGroupByDestinationId?.[destination.id] ??
        Math.round(transport * ctx.participants);

      // Calcul des budgets réels de la configuration
      const lodging = Math.round((config.priceBase + config.cleaningFee + config.serviceFee) / ctx.participants);
      const food = destination.avg_daily_cost * 0.4 * (ctx.nights + 1);
      const ageSpendMultiplier = ageBudgetMultiplier(ctx.groupAgeRange);
      const ageAdjustedBudget = ctx.budgetPerPerson * ageSpendMultiplier;
      const budgetForActivities = Math.max(40, ageAdjustedBudget - transport - lodging - food);

      let activityPool = catalog.activities.filter((a) => a.destination_id === destination.id);
      const diet = (ctx.dietaryConstraints ?? []).map(norm);
      if (diet.length) {
        activityPool = [...activityPool].sort((a, b) => {
          const restoA = /gastro|resto|food|cuisine/i.test(a.category + a.name) ? 1 : 0;
          const restoB = /gastro|resto|food|cuisine/i.test(b.category + b.name) ? 1 : 0;
          return restoA - restoB;
        });
      }

      const activities = pickActivities(
        activityPool,
        ctx.activityCategories,
        ctx.nights,
        budgetForActivities,
        ctx.travelPace,
        ctx.starWantedActivities,
        ctx.dietaryConstraintsRatio ?? 0,
        ctx.groupAgeRange,
        ctx.preferredTimeSlots ?? [],
      );
      const activitiesCost = activities.reduce((sum, a) => sum + a.price_per_person, 0);

      const totalPerPerson = transport + lodging + food + activitiesCost + Math.round(config.taxes / ctx.participants);
      const totalGroup = transportGroup + (lodging + food + activitiesCost + Math.round(config.taxes / ctx.participants)) * ctx.participants;

      const individuals = ctx.individualPreferences ?? [];
      const budgetsIndiv = individuals
        .map((p) => p.budgetMax)
        .filter((n): n is number => n != null && n > 0);
      const budgetFitTotal = budgetsIndiv.length || (ctx.minGroupBudget ? 1 : 0);
      const budgetFitCount = budgetsIndiv.length
        ? budgetsIndiv.filter((b) => totalPerPerson <= b).length
        : totalPerPerson <= (ctx.minGroupBudget ?? ctx.budgetPerPerson)
          ? 1
          : 0;
      const hardCap = ctx.vetoBudgetMax ?? ctx.minGroupBudget ?? null;
      const hardBudgetFits = hardCap != null ? totalPerPerson <= hardCap : totalPerPerson <= ctx.budgetPerPerson;

      const budget: BudgetBreakdown & { configuration: AccommodationConfig } = {
        transport: Math.round(transport),
        transportGroup: Math.round(transportGroup),
        accommodation: Math.round(lodging),
        activities: Math.round(activitiesCost),
        food: Math.round(food),
        totalPerPerson: Math.round(totalPerPerson),
        totalGroup: Math.round(totalGroup),
        budgetPerPerson: ctx.budgetPerPerson,
        fits: totalPerPerson <= ctx.budgetPerPerson,
        hardBudgetFits,
        budgetFitCount,
        budgetFitTotal: budgetFitTotal || ctx.participants,
        priceSource: {
          transport: ctx.transportByDestinationId?.[destination.id] != null ? 'api' : 'estimate',
          accommodation: (rawAcc != null && rawAcc.source !== 'krew_seed') ? 'api' : 'estimate',
        },
        configuration: config,
        ...(transportOrigins && transportOrigins.length > 0
          ? { transportByOrigin: transportOrigins }
          : {}),
      };

      const available = new Set(
        catalog.activities.filter((a) => a.destination_id === destination.id).map((a) => a.category),
      );

      const bestDuration = bestModeOption?.durationHours ?? destination.distance_from_paris_km / 90;

      // Satisfaction individuelle
      let consensusScore = 0.65;
      let minSatisfaction = 0.65;
      let satisfiedCount = 0;
      let participantsEvaluated = 0;
      if (individuals.length) {
        const fits = individuals.map((pref) =>
          individualFit(destination, available, totalPerPerson, pref, bestDuration, ctx.nights),
        );
        participantsEvaluated = fits.length;
        const weights = individuals.map((pref) => Math.max(0.1, pref.weight ?? (pref.isStar ? (ctx.starWeight ?? 2.5) : 1)));
        const wSum = weights.reduce((a, b) => a + b, 0);
        consensusScore = fits.reduce((acc, f, i) => acc + f * weights[i]!, 0) / wSum;
        minSatisfaction = fits.includes(0) ? 0 : Math.max(0.1, Math.min(...fits));
        satisfiedCount = fits.filter((f) => f >= 0.55).length;
      }

      const sAmbiance = ambianceScore(destination, ctx.ambiances);
      const wanted = ctx.activityCategories;
      const sActivities = wanted.length
        ? wanted.filter((c) => available.has(c)).length / wanted.length
        : 0.6;
      const ratio = totalPerPerson / Math.max(1, ctx.budgetPerPerson);
      const ageBudgetRatio = totalPerPerson / Math.max(1, ageAdjustedBudget);
      const baseBudgetScore = ratio <= 1 ? clamp(0.7 + (1 - ratio) * 0.6) : clamp(1 - (ratio - 1) * 1.8);
      const ageBudgetScore = ageBudgetRatio <= 1
        ? clamp(0.72 + (1 - ageBudgetRatio) * 0.5)
        : clamp(1 - (ageBudgetRatio - 1) * 2.1);
      const sBudget = clamp(baseBudgetScore * 0.65 + ageBudgetScore * 0.35);
      const maxHours = ctx.maxTravelDurationHours ?? null;
      const sTransport = maxHours && maxHours > 0
        ? clamp(1 - Math.max(0, bestDuration - maxHours * 0.55) / Math.max(1, maxHours * 0.75))
        : clamp(1 - bestDuration / 12);
      const sDistance = clamp(1 - destination.distance_from_paris_km / Math.max(300, ctx.maxDistanceKm));

      // sSeason est le score saisonnier déterministe KREW pur (sans injection directe météo)
      const sSeason = seasonScoreWithFlex(destination, ctx.startMonth, ctx.dateFlexDays);

      // sWeather (weatherScore) est un signal distinct calculé via Open-Meteo / climate + importance météo du groupe
      let sWeather = computeWeatherScore(destination, (ctx as any).startDate, (ctx as any).endDate, ctx.startMonth);

      const weatherPref = (ctx as any).groupWeatherPreference;
      if (weatherPref != null) {
        if (weatherPref === 0) {
          sWeather = 1.0; // Ne modifie pas artificiellement le classement si tout le monde est agnostique
        } else if (weatherPref > 1.0) {
          sWeather = Math.pow(sWeather, 1.5); // Accentue les différences pour une forte demande météo
        } else if (weatherPref < 1.0) {
          sWeather = 1.0 - (1.0 - sWeather) * weatherPref; // Atténue les différences pour une demande faible
        }
      }

      const sQuality = clamp((destination.rating - 3.5) / 1.5) * 0.6 + destination.popularity * 0.4;
      const sConsensus = consensusScore;
      const sMinSat = minSatisfaction;

      const w = resolveWeights(ctx.eventType, ctx.scoringWeights);

      let score =
        sAmbiance * w.ambiance +
        sActivities * w.activities +
        sBudget * w.budget +
        (sDistance * 0.45 + sTransport * 0.55) * w.distance +
        (sSeason * 0.5 + sWeather * 0.5) * w.season +
        sQuality * w.quality +
        sConsensus * w.consensus +
        sMinSat * w.minSatisfaction;

      // Soft Preferences / Context based on group age range
      if (ctx.groupAgeRange) {
        const age = norm(ctx.groupAgeRange);
        const cost = destination.avg_daily_cost ?? (destination as any).daily_cost_avg ?? 80;
        if (age.includes("18-25") || age.includes("25-35")) {
          score += (destination.score_fete ?? 0.5) * 8;
          if (cost <= 75) {
            score += 5;
          } else if (cost > 120) {
            score -= 10;
          }
        } else if (age.includes("45-60") || age.includes("60+")) {
          score += ((destination.score_detente ?? 0.5) + (destination.score_culturel ?? 0.5)) * 4;
          if (rawAcc && rawAcc.rating >= 4.2) {
            score += 6;
          }
          if (destination.avg_daily_cost >= 100) {
            score += 4;
          }
        }
      }

      // Type de lieu / environnement recherché
      const sEnvironment = environmentScore(destEnvs, wantedEnvTypes, starEnvTypes);
      score += sEnvironment * (w.environment ?? 10);

      // Star et cadre
      if (starEnvTypes.length) {
        const starWantedNormalized = splitEnvTypes(starEnvTypes);
        const destEnvNormalized = new Set(splitEnvTypes(destEnvs));
        const starMatch = starWantedNormalized.length
          ? starWantedNormalized.filter((env) => destEnvNormalized.has(env)).length / starWantedNormalized.length
          : 0;
        score += starMatch * 12 - (starMatch === 0 ? 6 : 0);
      }

      const hasHistory = ctx.pastDestinations && ctx.pastDestinations.length > 0;
      const sHistorique = hasHistory ? computeHistoriqueScore(destination, ctx.pastDestinations) : 0;
      if (hasHistory) {
        const hWeight = w.historique ?? 3;
        score += sHistorique * hWeight;
      }

      // Destinations rêvées et à éviter
      if (ctx.desiredDestination) {
        const desired = norm(ctx.desiredDestination);
        const destName = norm(destination.name);
        const destCountry = norm(destination.country);
        if (desired && (destName.includes(desired) || desired.includes(destName) || destCountry.includes(desired))) {
          score += 15;
        }
      }

      if (ctx.dealBreakerDestinations && ctx.dealBreakerDestinations.length > 0) {
        const destName = norm(destination.name);
        const destCountry = norm(destination.country);
        const hitsExcluded = ctx.dealBreakerDestinations.some(d => {
          const nd = norm(d);
          return nd && (destName.includes(nd) || nd.includes(destName) || destCountry.includes(nd));
        });
        if (hitsExcluded) {
          score -= 40;
        }
      }

      // Tâche 6 : Intégrer la logique de groupe dans le scoring (Bonuses de configuration)
      // 1. Cohésion du groupe
      if (config.unitsCount === 1 && (config.type === "villa" || config.type === "auberge")) {
        score += 5;
      } else if (config.unitsCount === 1 && config.type === "appartement") {
        score += 3;
      } else if (config.unitsCount > 1) {
        score -= 4;
      }

      // 2. Confort
      const density = ctx.participants / config.bedrooms;
      if (density <= 2) {
        score += 4;
      } else if (density > 3) {
        score -= 6;
      }

      if (ctx.participants / config.bathrooms <= 3) {
        score += 2;
      }

      // 3. Match préférences
      if (ctx.mostDemandedLodgingType && ctx.mostDemandedLodgingType !== "peu_importe") {
        if (norm(config.type).includes(norm(ctx.mostDemandedLodgingType))) {
          score += 3;
        }
      }

      if (ctx.requiredAmenities && ctx.requiredAmenities.length > 0) {
        const amenitiesNorm = (rawAcc?.amenities ?? []).map(x => norm(x));
        const matched = ctx.requiredAmenities.filter(am => am !== "peu_importe" && amenitiesNorm.some(x => x.includes(norm(am))));
        score += matched.length * 1;
      }

      // Pénalité forte si un participant est très mal satisfait
      if (minSatisfaction < 0.35) score -= 25;
      else if (minSatisfaction < 0.45) score -= 12;
      if (!hardBudgetFits) {
        if (ctx.hasBudgetVeto) {
          score -= 40;
        } else {
          score -= 15;
        }
      }
      // Pénalité additionnelle si le budget global est de 0 ou extrêmement bas pour refléter l'écart
      if (ctx.budgetPerPerson <= 50) {
        score -= 15;
      }
      if (individuals.length && satisfiedCount < individuals.length) {
        score -= (individuals.length - satisfiedCount) * 4;
      }

      // Pénalités de score pour planeRefused et maxTravelDurationHours
      if (planeRefusedBypassed) {
        score -= 25;
      } else if (ctx.planeRefused && destination.distance_from_paris_km > 500) {
        score -= 8;
      }

      if (maxDurationBypassed) {
        score -= 25;
      } else if (ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0) {
        if (!isTransportCompatible(estimatedModeOptions, ctx.maxTravelDurationHours)) {
          score -= 35;
        } else if (bestDuration > ctx.maxTravelDurationHours * 0.8) {
          score -= 8;
        }
      }

      if (!ctx.letKrewDecide && desired) {
        const matches =
          norm(destination.name).includes(desired) || norm(destination.country).includes(desired);
        score += matches ? 35 : -25;
      }

      const subScores: SubScores = {
        sAmbiance,
        sActivities,
        sBudget,
        sDistance,
        sTransport,
        sSeason,
        sWeather,
        sQuality,
        sConsensus,
        sMinSatisfaction: sMinSat,
        ...(hasHistory ? { sHistorique } : {}),
        sEnvironment,
      };

      const matchReasons: string[] = [];
      let categoryLabel = "";
      if (config.category === "rapport_qualite_prix") {
        categoryLabel = "💎 Meilleur rapport qualité/prix";
      } else if (config.category === "confort") {
        categoryLabel = "⭐ Meilleur confort";
      } else if (config.category === "emplacement") {
        categoryLabel = "📍 Meilleur emplacement";
      }
      if (categoryLabel) {
        matchReasons.push(categoryLabel);
      }

      matchReasons.push(`🏠 Logement : ${config.name}`);
      matchReasons.push(`🛌 ${config.bedrooms} ch. · ${config.beds} lits · ${config.bathrooms} SDB`);

      if (participantsEvaluated > 0) {
        matchReasons.push(`✅ Plaît à ${satisfiedCount}/${participantsEvaluated} participants`);
      }
      if (budgetFitTotal > 0) {
        matchReasons.push(
          `Dans le budget de ${budgetFitCount}/${budgetFitTotal} participants`,
        );
      }

      if (sAmbiance > 0.7) matchReasons.push("Colle parfaitement à l'ambiance recherchée par le groupe");
      if (sActivities >= 0.75)
        matchReasons.push("Toutes les activités demandées sont sur place");
      if (budget.fits)
        matchReasons.push(
          `Budget médian respecté : ${Math.round(totalPerPerson)} € / pers. tout compris`,
        );
      else
        matchReasons.push(
          `Dépassement vs médiane (+${Math.round(totalPerPerson - ctx.budgetPerPerson)} € / pers.)`,
        );
      if (!hardBudgetFits && hardCap != null)
        matchReasons.push(
          ctx.hasBudgetVeto
            ? `Hors plafond veto budget (${hardCap} €) — total ~${Math.round(totalPerPerson)} €`
            : `Hors budget du plus serré (${hardCap} €) — total ~${Math.round(totalPerPerson)} €`,
        );
      if (ctx.hasBudgetVeto && hardBudgetFits)
        matchReasons.push(`Respecte le veto budget (${hardCap} €)`);
      if (!sharedOk)
        matchReasons.push("Hébergement priorisé hors dortoir");
      if (preferredLodgingType && preferredLodgingType !== "peu_importe" && rawAcc && norm(rawAcc.type || "").includes(norm(preferredLodgingType))) {
        matchReasons.push(`Type d'hébergement respecté : ${rawAcc.type}`);
      }
      if (ctx.needsAccessibility)
        matchReasons.push("Priorité accessibilité (besoin mobilité)");
      if (ctx.planeRefused) {
        if (planeRefusedBypassed) {
          matchReasons.push("⚠️ Privilégie train/voiture par manque d'alternatives");
        } else {
          matchReasons.push("Train ou voiture possible (pas d'avion obligatoire)");
        }
      }
      if (ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0) {
        if (maxDurationBypassed) {
          matchReasons.push(`⚠️ Dépasse la durée de trajet souhaitée de ${ctx.maxTravelDurationHours}h`);
        } else {
          matchReasons.push(`Trajet compatible en ${bestModeOption?.mode ?? "mode accepté"} (~${Math.round(bestDuration * 10) / 10}h)`);
        }
      }

      let originPriceSpread: number | null = null;
      if (transportOrigins && transportOrigins.length > 0) {
        const prices = transportOrigins.map((o) => o.pricePerPerson);
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        originPriceSpread = maxPrice - minPrice;
      }

      const rationale = `${destination.name} pour ${ctx.participants} personnes. ${config.explanation} Consensus ${(consensusScore * 100).toFixed(0)} % · min. satisfaction ${(minSatisfaction * 100).toFixed(0)} %.`;

      destProposals.push({
        destination,
        accommodation: rawAcc,
        activities,
        score: Math.round(clamp(score, 0, 100)),
        rationale,
        matchReasons,
        itinerary: buildItinerary(destination, rawAcc, activities, ctx.nights, ctx.travelPace, ctx.preferredTimeSlots),
        budget,
        consensusScore,
        minSatisfaction,
        satisfiedCount,
        participantsEvaluated,
        subScores,
        originPriceSpread,
        transportOptions: estimatedModeOptions,
      });
    }

    allDestinationProposals.push(...destProposals);
  }

  const sortedProposals = allDestinationProposals.sort((a, b) => b.score - a.score);
  const selected = selectDiverseTop(sortedProposals, limit);

  // Conserve les 2-3 meilleures destinations qui ont été calculées mais pas retenues dans le top final
  const selectedIds = new Set(selected.map((p) => p.destination.id));
  const runnerProposals = sortedProposals
    .filter((p) => !selectedIds.has(p.destination.id))
    .slice(0, 3);

  const runnerUps = runnerProposals.map((p) => ({
    name: p.destination.name,
    reason: generateRejectionReason(p),
  }));

  (selected as any).runnerUps = runnerUps;

  return selected;
}



/**
 * MMR léger : diversifie le top N (pays, ambiance dominante, budget ±10%).
 */
export function selectDiverseTop(sorted: Proposal[], limit: number): Proposal[] {
  if (sorted.length <= limit) return sorted;
  const selected: Proposal[] = [];
  const remaining = [...sorted];

  while (selected.length < limit && remaining.length) {
    if (!selected.length) {
      selected.push(remaining.shift()!);
      continue;
    }
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      if (!cand) continue;
      const similarity = selected.reduce((maxSim, sel) => {
        let sim = 0;
        if (norm(sel.destination.country) === norm(cand.destination.country)) sim += 0.4;
        if (dominantAmbiance(sel.destination) === dominantAmbiance(cand.destination)) sim += 0.35;
        const b1 = sel.budget.totalPerPerson;
        const b2 = cand.budget.totalPerPerson;
        if (b1 > 0 && Math.abs(b1 - b2) / b1 <= 0.1) sim += 0.25;
        return Math.max(maxSim, sim);
      }, 0);
      // lambda ~ 0.7 relevance, 0.3 diversity
      const mmr = 0.7 * (cand.score / 100) - 0.3 * similarity;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return selected;
}

export function isTripAdmin(trip: any, userId: string): boolean {
  if (!trip) return false;
  return trip.owner_id === userId || trip.co_organizer_id === userId || trip.ownerId === userId || trip.coOrganizerId === userId;
}

export function computeGroupTimeWindow(rows: { earliest_departure_time?: string | null; latest_return_time?: string | null }[]) {
  const departures = rows
    .map((r) => r.earliest_departure_time)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "");
  const returns = rows
    .map((r) => r.latest_return_time)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "");

  const earliestDeparture = departures.length > 0 ? departures.sort().slice(-1)[0] || null : null;
  const latestReturn = returns.length > 0 ? returns.sort()[0] || null : null;

  return { earliestDeparture, latestReturn };
}

export type ParticipantTransportPick = {
  userId: string;
  displayName: string;
  city: string;
  arrivalTime?: string | null;
  departureTime?: string | null;
};

export function computeGroupTimeWindowExtended(
  timePrefs: { earliest_departure_time?: string | null; latest_return_time?: string | null }[],
  picks: ParticipantTransportPick[]
) {
  const departures = timePrefs
    .map((r) => r.earliest_departure_time)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "");
  const returns = timePrefs
    .map((r) => r.latest_return_time)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "");

  const earliestDeparture = departures.length > 0 ? departures.sort().slice(-1)[0] || null : null;
  const latestReturn = returns.length > 0 ? returns.sort()[0] || null : null;

  const arrivalTimes = picks
    .map((p) => p.arrivalTime)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .sort();

  const departureTimes = picks
    .map((p) => p.departureTime)
    .filter((t): t is string => typeof t === "string" && t.trim() !== "")
    .sort();

  if (arrivalTimes.length === 0 && departureTimes.length === 0) {
    return {
      earliestDeparture,
      latestReturn,
      majorityArrival: earliestDeparture,
      majorityDeparture: latestReturn,
      earlyBirds: [] as string[],
      lateComers: [] as string[],
      earlyLeavers: [] as string[],
    };
  }

  const medianArrival = arrivalTimes[Math.floor(arrivalTimes.length / 2)] || null;
  const medianDeparture = departureTimes[Math.floor(departureTimes.length / 2)] || null;

  const earlyBirds: string[] = [];
  const lateComers: string[] = [];
  const earlyLeavers: string[] = [];

  for (const pick of picks) {
    if (pick.arrivalTime && medianArrival) {
      if (pick.arrivalTime < medianArrival) {
        earlyBirds.push(pick.displayName);
      } else if (pick.arrivalTime > medianArrival) {
        const [mH, mMin] = medianArrival.split(":").map(Number);
        const [pH, pMin] = pick.arrivalTime.split(":").map(Number);
        if (mH !== undefined && pH !== undefined) {
          const diffMinutes = (pH * 60 + (pMin || 0)) - (mH * 60 + (mMin || 0));
          if (diffMinutes >= 90) {
            lateComers.push(pick.displayName);
          }
        }
      }
    }

    if (pick.departureTime && medianDeparture) {
      if (pick.departureTime < medianDeparture) {
        const [mH, mMin] = medianDeparture.split(":").map(Number);
        const [pH, pMin] = pick.departureTime.split(":").map(Number);
        if (mH !== undefined && pH !== undefined) {
          const diffMinutes = (mH * 60 + (mMin || 0)) - (pH * 60 + (pMin || 0));
          if (diffMinutes >= 90) {
            earlyLeavers.push(pick.displayName);
          }
        }
      }
    }
  }

  return {
    earliestDeparture,
    latestReturn,
    majorityArrival: medianArrival || earliestDeparture,
    majorityDeparture: medianDeparture || latestReturn,
    earlyBirds,
    lateComers,
    earlyLeavers,
  };
}

export function scoreTransportOption(
  option: {
    mode: string;
    pricePerPerson: number;
    durationHours: number;
    respectedConstraints?: string[];
    outsideTimeWindow?: boolean;
  },
  budgetPerPerson: number,
  maxTravelDurationHours: number | null
): { score: number; matchReasons: string[] } {
  let score = 70; // Base score
  const matchReasons: string[] = [];

  // 0. Time Window constraint check
  if (option.outsideTimeWindow) {
    score -= 40; // Heavy penalty for violating hard schedule constraints
    matchReasons.push("⚠️ Hors de tes contraintes horaires");
  } else if (option.respectedConstraints && option.respectedConstraints.length > 0) {
    score += 5;
    matchReasons.push("Respecte tes contraintes horaires");
  }

  // 1. Budget Fit Scoring
  const transportBudget = budgetPerPerson * 0.25; // Allocating 25% of total budget to transport
  if (option.pricePerPerson <= transportBudget) {
    score += 15;
    matchReasons.push("Option très économique (dans ton budget transport estimé)");
  } else if (option.pricePerPerson <= transportBudget * 1.5) {
    score += 5;
    matchReasons.push("Prix correct, proche de l'estimation de départ");
  } else {
    score -= 15;
    matchReasons.push("Prix plus élevé que l'estimation standard");
  }

  // 2. Duration Scoring
  const hours = option.durationHours;
  if (hours <= 3) {
    score += 15;
    matchReasons.push("Trajet très rapide (moins de 3h)");
  } else if (hours <= 6) {
    score += 5;
    matchReasons.push("Durée de trajet raisonnable (entre 3h et 6h)");
  } else {
    score -= 10;
    matchReasons.push("Temps de trajet plus long");
  }

  // 3. Max Travel Duration constraint check
  if (maxTravelDurationHours != null && maxTravelDurationHours > 0) {
    if (hours <= maxTravelDurationHours) {
      score += 10;
      matchReasons.push(`Respecte ta limite maximale de ${maxTravelDurationHours}h`);
    } else {
      score -= 30; // Strong penalty
    }
  }

  // 4. Mode comfort/convenience bonus
  if (option.mode === "train") {
    score += 5;
    matchReasons.push("Confort du train privilégié");
  } else if (option.mode === "flight") {
    matchReasons.push("Rapidité de l'avion");
  } else if (option.mode === "covoiturage") {
    matchReasons.push("Option covoiturage conviviale");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchReasons: matchReasons.slice(0, 3)
  };
}
