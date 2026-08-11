/**
 * Moteur de recommandation Krew.
 *
 * Fonctions pures : elles reçoivent un catalogue (base + APIs) et le contexte
 * du groupe, puis produisent des propositions scorées.
 */
import { AMBIANCE_SCORE_COLUMN, type Ambiance } from "./constants";

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
  sSeason: number;
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
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Poids par défaut selon event_type (utilisés si pas de ligne scoring_weights). */
export const DEFAULT_WEIGHTS_BY_EVENT: Record<string, ScoringWeights> = {
  evg: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8, historique: 3 },
  evjf: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8, historique: 3 },
  anniversaire: { ambiance: 22, activities: 16, budget: 14, distance: 8, season: 10, quality: 6, consensus: 14, minSatisfaction: 10, historique: 3 },
  weekend: { ambiance: 14, activities: 12, budget: 28, distance: 12, season: 8, quality: 4, consensus: 12, minSatisfaction: 10, historique: 3 },
  voyage_groupe: { ambiance: 18, activities: 14, budget: 16, distance: 8, season: 8, quality: 5, consensus: 16, minSatisfaction: 15, historique: 3 },
  default: { ambiance: 18, activities: 12, budget: 16, distance: 8, season: 8, quality: 5, consensus: 18, minSatisfaction: 15, historique: 3 },
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

export function getDestinationEnvironments(destName: string): string[] {
  const name = destName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
  return ["Centre-ville / urbain"];
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
): ActivityRecord[] {
  const perDay = activitiesPerDayForPace(travelPace);
  const maxCount = Math.max(perDay, (nights + 1) * perDay - (travelPace === "chill" ? 1 : 0));
  const picked: ActivityRecord[] = [];
  let spent = 0;
  const used = new Set<string>();
  const starWanted = starWantedActivities ?? [];

  const rank = (a: ActivityRecord, b: ActivityRecord) =>
    activityMatchScore(b, wantedCategories, starWanted, dietaryConstraintsRatio, groupAgeRange) -
    activityMatchScore(a, wantedCategories, starWanted, dietaryConstraintsRatio, groupAgeRange);

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
  for (const d of dealDestinations) {
    const nd = norm(d);
    if (!nd) continue;
    if (norm(dest.name).includes(nd) || norm(dest.country).includes(nd) || nd.includes(norm(dest.name))) {
      return true;
    }
  }
  for (const a of dealAmbiances) {
    const col = AMBIANCE_SCORE_COLUMN[a as Ambiance];
    if (!col) continue;
    const v = Number((dest as unknown as Record<string, number>)[col] ?? 0);
    // Ambiance dominante refusée (≥ 0.7)
    if (v >= 0.7) return true;
  }
  return false;
}

/**
 * Fit 0–1 d'un participant pour une destination / offre donnée.
 */
function individualFit(
  dest: DestinationRecord,
  availableCategories: Set<string>,
  totalPerPerson: number,
  pref: IndividualPreference,
): number {
  if (hitsDealBreaker(dest, pref.dealBreakerAmbiances, pref.dealBreakerDestinations)) {
    return 0;
  }
  let sAmb = ambianceScore(dest, pref.ambiances.length ? pref.ambiances : []);
  const wanted = pref.activityCategories;
  const sAct = wanted.length
    ? wanted.filter((c) => availableCategories.has(c)).length / wanted.length
    : 0.6;
  let sBudget = 0.7;
  if (pref.budgetMax != null && pref.budgetMax > 0) {
    const ratio = totalPerPerson / pref.budgetMax;
    sBudget = ratio <= 1 ? clamp(0.75 + (1 - ratio) * 0.5) : clamp(1 - (ratio - 1) * 2);
  }

  // Tâche 10 : Destinations rêvées / à éviter individuelles
  let score = sAmb * 0.4 + sAct * 0.3 + sBudget * 0.3;

  // Bonus si la destination correspond à la destination rêvée du participant (s'il en a une)
  // On compare de manière souple
  if (pref.desired_destination || (pref as any).desiredDestination) {
    const desired = norm(pref.desired_destination || (pref as any).desiredDestination || "");
    const destName = norm(dest.name);
    const destCountry = norm(dest.country);
    if (desired && (destName.includes(desired) || desired.includes(destName) || destCountry.includes(desired))) {
      score += 0.25; // Bonus significatif de +25% de satisfaction individuelle
    }
  }

  return clamp(score);
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
    if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
    return true;
  });

  // Fallback 1: If zero candidates pass because of planeRefused, try bypassing planeRefused but keep maxDistance
  if (candidates.length === 0 && ctx.planeRefused) {
    candidates = catalog.destinations.filter((d) => {
      if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
      if (d.distance_from_paris_km > ctx.maxDistanceKm * 1.15) return false;
      if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
      return true;
    });
    if (candidates.length > 0) {
      planeRefusedBypassed = true;
    }
  }

  // Fallback 2: If still zero candidates, try bypassing maxTravelDurationHours/maxDistanceKm limits
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

  // Fallback 3: If still zero, bypass both
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

  const proposals: Proposal[] = candidates.map((destination) => {
    let accommodations = catalog.accommodations
      .filter((a) => a.destination_id === destination.id)
      .filter((a) => (minRating > 0 ? a.rating >= minRating - 0.05 : true));
    if (!accommodations.length) {
      accommodations = catalog.accommodations.filter((a) => a.destination_id === destination.id);
    }
    // Chambre partagée : si le groupe refuse, prioriser capacité unitaire / types non dortoir
    const sharedOk = ctx.acceptsSharedRoom !== false;
    const roomPrefs = (ctx.roomTypePreferences ?? []).map((x) => norm(x));
    const preferredLodgingType = ctx.mostDemandedLodgingType;
    const reqAmenities = ctx.requiredAmenities ?? [];

    accommodations = [...accommodations].sort((a, b) => {
      if (!sharedOk) {
        const dormA = /dortoir|shared|hostel|auberge/i.test(a.type + a.name) ? 1 : 0;
        const dormB = /dortoir|shared|hostel|auberge/i.test(b.type + b.name) ? 1 : 0;
        if (dormA !== dormB) return dormA - dormB;
      }

      // 1. Preferred lodging type matching (e.g. hotel, apartment)
      if (preferredLodgingType && preferredLodgingType !== "peu_importe") {
        const typeA = norm(a.type || "");
        const typeB = norm(b.type || "");
        const matchA = typeA.includes(norm(preferredLodgingType)) ? 0 : 1;
        const matchB = typeB.includes(norm(preferredLodgingType)) ? 0 : 1;
        if (matchA !== matchB) return matchA - matchB;
      }

      // 2. Required amenities matching (e.g. pool, wifi)
      if (reqAmenities.length && reqAmenities.some(x => x !== "peu_importe")) {
        const amenitiesA = (a.amenities ?? []).map((x: string) => norm(x));
        const amenitiesB = (b.amenities ?? []).map((x: string) => norm(x));
        const typeA = norm(a.type || "");
        const typeB = norm(b.type || "");

        const scoreA = reqAmenities.filter(am =>
          amenitiesA.some((x: string) => x.includes(norm(am))) || typeA.includes(norm(am))
        ).length;
        const scoreB = reqAmenities.filter(am =>
          amenitiesB.some((x: string) => x.includes(norm(am))) || typeB.includes(norm(am))
        ).length;

        if (scoreA !== scoreB) return scoreB - scoreA; // highest score first!
      }

      if (roomPrefs.length) {
        const mA = roomPrefs.some((p) => norm(a.type).includes(p) || norm(a.name).includes(p)) ? 0 : 1;
        const mB = roomPrefs.some((p) => norm(b.type).includes(p) || norm(b.name).includes(p)) ? 0 : 1;
        if (mA !== mB) return mA - mB;
      }
      if (ctx.needsAccessibility) {
        // sans champ PMR dédié: favoriser centre + note
        if (a.distance_center_km !== b.distance_center_km) return a.distance_center_km - b.distance_center_km;
      }
      const capA = a.capacity >= ctx.participants ? 0 : 1;
      const capB = b.capacity >= ctx.participants ? 0 : 1;
      if (capA !== capB) return capA - capB;
      if (minRating > 0 && a.rating !== b.rating) return b.rating - a.rating;
      if (ctx.needsCityCenter && a.distance_center_km !== b.distance_center_km) {
        return a.distance_center_km - b.distance_center_km;
      }
      return a.price_per_night_per_person - b.price_per_night_per_person;
    });
    const accommodation = accommodations[0] ?? null;

    const transport =
      ctx.transportByDestinationId?.[destination.id] ??
      estimateTransport(destination.distance_from_paris_km);
    const transportOrigins = ctx.transportOriginsByDestinationId?.[destination.id];
    const transportGroup =
      ctx.transportGroupByDestinationId?.[destination.id] ??
      Math.round(transport * ctx.participants);

    const lodging =
      (accommodation?.price_per_night_per_person ?? destination.avg_daily_cost * 0.4) * ctx.nights;
    const food = destination.avg_daily_cost * 0.4 * (ctx.nights + 1);
    const budgetForActivities = Math.max(40, ctx.budgetPerPerson - transport - lodging - food);

    let activityPool = catalog.activities.filter((a) => a.destination_id === destination.id);
    const diet = (ctx.dietaryConstraints ?? []).map(norm);
    if (diet.length) {
      // Ne pas exclure totalement, mais déprioriser resto générique si contraintes fortes
      activityPool = [...activityPool].sort((a, b) => {
        const restoA = /gastro|resto|food|cuisine/i.test(a.category + a.name) ? 1 : 0;
        const restoB = /gastro|resto|food|cuisine/i.test(b.category + b.name) ? 1 : 0;
        return restoA - restoB;
      });
    }
    // Phase 2 : activités scorées sur préférences groupe + boost Star
    const activities = pickActivities(
      activityPool,
      ctx.activityCategories,
      ctx.nights,
      budgetForActivities,
      ctx.travelPace,
      ctx.starWantedActivities,
      ctx.dietaryConstraintsRatio ?? 0,
      (ctx as any).groupAgeRange,
    );
    const activitiesCost = activities.reduce((sum, a) => sum + a.price_per_person, 0);
    const totalPerPerson = transport + lodging + food + activitiesCost;
    const sharedPerPerson = lodging + food + activitiesCost;
    const totalGroup = transportGroup + sharedPerPerson * ctx.participants;

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

    const budget: BudgetBreakdown = {
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
        accommodation: (accommodation != null && accommodation.source !== 'krew_seed') ? 'api' : 'estimate',
      },
      ...(transportOrigins && transportOrigins.length > 1
        ? { transportByOrigin: transportOrigins }
        : {}),
    };

    const available = new Set(
      catalog.activities.filter((a) => a.destination_id === destination.id).map((a) => a.category),
    );

    // Satisfaction individuelle
    let consensusScore = 0.65;
    let minSatisfaction = 0.65;
    let satisfiedCount = 0;
    let participantsEvaluated = 0;
    if (individuals.length) {
      const fits = individuals.map((pref) =>
        individualFit(destination, available, totalPerPerson, pref),
      );
      participantsEvaluated = fits.length;
      // Moyenne pondérée : la Star pèse plus (EVG/EVJF/anniversaire)
      const weights = individuals.map((pref) => Math.max(0.1, pref.weight ?? (pref.isStar ? (ctx.starWeight ?? 2.5) : 1)));
      const wSum = weights.reduce((a, b) => a + b, 0);
      consensusScore = fits.reduce((acc, f, i) => acc + f * weights[i]!, 0) / wSum;
      minSatisfaction = Math.min(...fits);
      satisfiedCount = fits.filter((f) => f >= 0.55).length;
    }

    const sAmbiance = ambianceScore(destination, ctx.ambiances);
    const wanted = ctx.activityCategories;
    const sActivities = wanted.length
      ? wanted.filter((c) => available.has(c)).length / wanted.length
      : 0.6;
    const ratio = totalPerPerson / Math.max(1, ctx.budgetPerPerson);
    const sBudget = ratio <= 1 ? clamp(0.7 + (1 - ratio) * 0.6) : clamp(1 - (ratio - 1) * 1.8);
    const sDistance = clamp(1 - destination.distance_from_paris_km / Math.max(300, ctx.maxDistanceKm));
    const sSeason = seasonScoreWithFlex(destination, ctx.startMonth, ctx.dateFlexDays);
    const sQuality = clamp((destination.rating - 3.5) / 1.5) * 0.6 + destination.popularity * 0.4;
    const sConsensus = consensusScore;
    const sMinSat = minSatisfaction;

    const w = resolveWeights(ctx.eventType, ctx.scoringWeights);

    let score =
      sAmbiance * w.ambiance +
      sActivities * w.activities +
      sBudget * w.budget +
      sDistance * w.distance +
      sSeason * w.season +
      sQuality * w.quality +
      sConsensus * w.consensus +
      sMinSat * w.minSatisfaction;

    // Type de lieu / environnement recherché
    const wantedEnvTypes = (ctx as any).wantedEnvTypes || [];
    const starWantedEnvType = (ctx as any).starWantedEnvType;
    const destEnvs = getDestinationEnvironments(destination.name);

    if (wantedEnvTypes.length > 0) {
      const matchedCount = wantedEnvTypes.filter((env: string) => destEnvs.includes(env)).length;
      if (matchedCount > 0) {
        score += 12 * (matchedCount / wantedEnvTypes.length); // Boost de score groupe
      }
    }

    if (starWantedEnvType && destEnvs.includes(starWantedEnvType)) {
      score += 15; // Boost de score Star
    }

    const hasHistory = ctx.pastDestinations && ctx.pastDestinations.length > 0;
    const sHistorique = hasHistory ? computeHistoriqueScore(destination, ctx.pastDestinations) : 0;
    if (hasHistory) {
      const hWeight = w.historique ?? 3;
      score += sHistorique * hWeight;
    }

    // Tâche 10 : Destinations rêvées et à éviter globales / agrégées
    if (ctx.desiredDestination) {
      const desired = norm(ctx.desiredDestination);
      const destName = norm(destination.name);
      const destCountry = norm(destination.country);
      if (desired && (destName.includes(desired) || desired.includes(destName) || destCountry.includes(desired))) {
        score += 15; // Bonus global de +15 points de score de groupe
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
        score -= 40; // Pénalité lourde de -40 points de score pour toute destination bannie
      }
    }

    // Pénalité forte si un participant est très mal satisfait
    if (minSatisfaction < 0.35) score -= 25;
    else if (minSatisfaction < 0.45) score -= 12;
    if (!hardBudgetFits) score -= 10;
    if (individuals.length && satisfiedCount < individuals.length) {
      score -= (individuals.length - satisfiedCount) * 3;
    }

    // Tâche 8 : Pénalités de score pour planeRefused et maxTravelDurationHours
    if (planeRefusedBypassed) {
      score -= 25;
    } else if (ctx.planeRefused && destination.distance_from_paris_km > 500) {
      score -= 8;
    }

    if (maxDurationBypassed) {
      score -= 25;
    } else if (ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0) {
      const estimatedHours = destination.distance_from_paris_km / 90;
      if (estimatedHours > ctx.maxTravelDurationHours * 0.8) {
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
      sSeason,
      sQuality,
      sConsensus,
      sMinSatisfaction: sMinSat,
      ...(hasHistory ? { sHistorique } : {}),
    };

    const matchReasons: string[] = [];
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
      matchReasons.push("Toutes les catégories d'activités demandées sont disponibles sur place");
    if (budget.fits)
      matchReasons.push(
        `Budget médian respecté : ${Math.round(totalPerPerson)} € / pers. sur ${ctx.budgetPerPerson} €`,
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
      matchReasons.push("Hébergement priorisé hors dortoir / chambre partagée");
    if (preferredLodgingType && preferredLodgingType !== "peu_importe" && accommodation && norm(accommodation.type || "").includes(norm(preferredLodgingType))) {
      matchReasons.push(`Type d'hébergement respecté : ${accommodation.type}`);
    }
    if (reqAmenities.length && reqAmenities.some(x => x !== "peu_importe") && accommodation) {
      const amenitiesNorm = (accommodation.amenities ?? []).map((x: string) => norm(x));
      const matched = reqAmenities.filter(am =>
        amenitiesNorm.some((x: string) => x.includes(norm(am))) || norm(accommodation.type || "").includes(norm(am))
      );
      if (matched.length > 0) {
        matchReasons.push(`Critères d'hébergement respectés : ${matched.join(", ")}`);
      }
    }
    if (ctx.needsAccessibility)
      matchReasons.push("Priorité accessibilité / proximité centre (besoin mobilité)");
    if (ctx.planeRefused) {
      if (planeRefusedBypassed) {
        matchReasons.push("⚠️ ATTENTION : Train ou voiture privilégié par le groupe, mais proposé par manque d'alternatives.");
      } else {
        matchReasons.push("Train ou voiture possible (pas d'avion obligatoire)");
      }
    }
    if (ctx.maxTravelDurationHours && ctx.maxTravelDurationHours > 0) {
      if (maxDurationBypassed) {
        matchReasons.push(`⚠️ ATTENTION : Dépasse la durée de trajet souhaitée de ${ctx.maxTravelDurationHours}h, mais proposé par manque d'alternatives.`);
      } else {
        matchReasons.push("Temps de trajet estimé dans la limite du groupe");
      }
    }
    if (sSeason >= 0.9) matchReasons.push("Période idéale côté météo et saisonnalité");
    if (destination.distance_from_paris_km <= 900)
      matchReasons.push("Trajet court : plus de temps sur place, moins de fatigue");
    if (accommodation && accommodation.capacity >= ctx.participants)
      matchReasons.push(`Hébergement unique pour ${ctx.participants} personnes (${accommodation.type})`);
    if (minRating > 0 && accommodation && accommodation.rating >= minRating)
      matchReasons.push(`Note hébergement ≥ ${minRating}`);
    if (ctx.transportByDestinationId?.[destination.id] != null) {
      if (transportOrigins && transportOrigins.length > 1) {
        const detail = transportOrigins
          .map((o) => `${o.city} (${o.count}) ${Math.round(o.pricePerPerson)} €`)
          .join(" · ");
        matchReasons.push(
          `Transport multi-départs — moy. ${Math.round(transport)} € A/R / pers. (${detail})`,
        );
      } else {
        matchReasons.push(`Transport estimé via Kayak/Kiwi : ${Math.round(transport)} € A/R / pers.`);
      }
    }

    let originPriceSpread: number | null = null;
    if (transportOrigins && transportOrigins.length > 0) {
      const prices = transportOrigins.map((o) => o.pricePerPerson);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      originPriceSpread = maxPrice - minPrice;
    }

    const rationale = `${destination.name} pour ${ctx.participants} personnes : ${
      destination.description ?? ""
    } Consensus ${(consensusScore * 100).toFixed(0)} % · min. satisfaction ${(minSatisfaction * 100).toFixed(0)} %.`;

    return {
      destination,
      accommodation,
      activities,
      score: Math.round(clamp(score, 0, 100)),
      rationale,
      matchReasons,
      itinerary: buildItinerary(destination, accommodation, activities, ctx.nights, ctx.travelPace, ctx.preferredTimeSlots),
      budget,
      consensusScore,
      minSatisfaction,
      satisfiedCount,
      participantsEvaluated,
      subScores,
      originPriceSpread,
    };
  });

  const sortedProposals = proposals.sort((a, b) => b.score - a.score);
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
  },
  budgetPerPerson: number,
  maxTravelDurationHours: number | null
): { score: number; matchReasons: string[] } {
  let score = 70; // Base score
  const matchReasons: string[] = [];

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
