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
  preferredTimeSlots?: string[];
  acceptsSharedRoom?: boolean;
  roomTypePreferences?: string[];
  needsAccessibility?: boolean;
  maxTravelDurationHours?: number | null;
  planeRefused?: boolean;
  blackoutDates?: string[];
  starWantedActivities?: string[];
  starDealBreakers?: string[];
  starWeight?: number;
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
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Poids par défaut selon event_type (utilisés si pas de ligne scoring_weights). */
export const DEFAULT_WEIGHTS_BY_EVENT: Record<string, ScoringWeights> = {
  evg: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8 },
  evjf: { ambiance: 28, activities: 22, budget: 12, distance: 5, season: 8, quality: 5, consensus: 12, minSatisfaction: 8 },
  anniversaire: { ambiance: 22, activities: 16, budget: 14, distance: 8, season: 10, quality: 6, consensus: 14, minSatisfaction: 10 },
  weekend: { ambiance: 14, activities: 12, budget: 28, distance: 12, season: 8, quality: 4, consensus: 12, minSatisfaction: 10 },
  voyage_groupe: { ambiance: 18, activities: 14, budget: 16, distance: 8, season: 8, quality: 5, consensus: 16, minSatisfaction: 15 },
  default: { ambiance: 18, activities: 12, budget: 16, distance: 8, season: 8, quality: 5, consensus: 18, minSatisfaction: 15 },
};

export function resolveWeights(eventType?: string | null, override?: ScoringWeights | null): ScoringWeights {
  if (override) return override;
  const key = (eventType ?? "default").toLowerCase().trim();
  return DEFAULT_WEIGHTS_BY_EVENT[key] ?? DEFAULT_WEIGHTS_BY_EVENT.default;
}

function dominantAmbiance(dest: DestinationRecord): string {
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
function pickActivities(
  pool: ActivityRecord[],
  wantedCategories: string[],
  nights: number,
  budgetForActivities: number,
  travelPace?: string | null,
): ActivityRecord[] {
  const perDay = activitiesPerDayForPace(travelPace);
  const maxCount = Math.max(perDay, (nights + 1) * perDay - (travelPace === "chill" ? 1 : 0));
  const picked: ActivityRecord[] = [];
  let spent = 0;
  const used = new Set<string>();

  const byRating = (a: ActivityRecord, b: ActivityRecord) => b.rating - a.rating;

  // Phase 1 — couverture
  for (const cat of wantedCategories) {
    if (picked.length >= maxCount) break;
    const candidates = pool
      .filter((a) => a.category === cat && !used.has(a.id))
      .sort(byRating);
    const best = candidates[0];
    if (!best) continue;
    if (spent + best.price_per_person > budgetForActivities && picked.length >= 1) continue;
    picked.push(best);
    used.add(best.id);
    spent += best.price_per_person;
  }

  // Phase 2 — complétion
  const ranked = [...pool]
    .filter((a) => !used.has(a.id))
    .sort((a, b) => {
      const aw = wantedCategories.includes(a.category) ? 1 : 0;
      const bw = wantedCategories.includes(b.category) ? 1 : 0;
      if (aw !== bw) return bw - aw;
      return b.rating - a.rating;
    });

  for (const activity of ranked) {
    if (picked.length >= maxCount) break;
    if (spent + activity.price_per_person > budgetForActivities && picked.length >= Math.max(1, perDay)) continue;
    picked.push(activity);
    spent += activity.price_per_person;
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
  const sAmb = ambianceScore(dest, pref.ambiances.length ? pref.ambiances : []);
  const wanted = pref.activityCategories;
  const sAct = wanted.length
    ? wanted.filter((c) => availableCategories.has(c)).length / wanted.length
    : 0.6;
  let sBudget = 0.7;
  if (pref.budgetMax != null && pref.budgetMax > 0) {
    const ratio = totalPerPerson / pref.budgetMax;
    sBudget = ratio <= 1 ? clamp(0.75 + (1 - ratio) * 0.5) : clamp(1 - (ratio - 1) * 2);
  }
  return clamp(sAmb * 0.4 + sAct * 0.3 + sBudget * 0.3);
}

export function buildProposals(catalog: TravelCatalog, ctx: ScoringContext, limit = 3): Proposal[] {
  const excluded = ctx.excludedCountries.map(norm).filter(Boolean);
  const desired = ctx.desiredDestination ? norm(ctx.desiredDestination) : "";
  const dealAmb = ctx.dealBreakerAmbiances ?? [];
  const dealDest = ctx.dealBreakerDestinations ?? [];
  const minRating = ctx.minAccommodationRating ?? 0;

  const candidates = catalog.destinations.filter((d) => {
    if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
    if (d.distance_from_paris_km > ctx.maxDistanceKm * 1.15) return false;
    // Exclusion dure deal-breakers groupe
    if (hitsDealBreaker(d, dealAmb, dealDest)) return false;
    return true;
  });

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
    accommodations = [...accommodations].sort((a, b) => {
      if (!sharedOk) {
        const dormA = /dortoir|shared|hostel|auberge/i.test(a.type + a.name) ? 1 : 0;
        const dormB = /dortoir|shared|hostel|auberge/i.test(b.type + b.name) ? 1 : 0;
        if (dormA !== dormB) return dormA - dormB;
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
    const activities = pickActivities(
      activityPool,
      ctx.activityCategories,
      ctx.nights,
      budgetForActivities,
      ctx.travelPace,
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

    // Pénalité forte si un participant est très mal satisfait
    if (minSatisfaction < 0.35) score -= 25;
    else if (minSatisfaction < 0.45) score -= 12;
    if (!hardBudgetFits) score -= 10;
    if (individuals.length && satisfiedCount < individuals.length) {
      score -= (individuals.length - satisfiedCount) * 3;
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
    if (ctx.needsAccessibility)
      matchReasons.push("Priorité accessibilité / proximité centre (besoin mobilité)");
    if (ctx.planeRefused)
      matchReasons.push("Au moins un participant refuse l'avion — vérifier train/bus");
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
    };
  });

  return selectDiverseTop(proposals.sort((a, b) => b.score - a.score), limit);
}

/**
 * MMR léger : diversifie le top N (pays, ambiance dominante, budget ±10%).
 */
function selectDiverseTop(sorted: Proposal[], limit: number): Proposal[] {
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
