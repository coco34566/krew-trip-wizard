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

export type ScoringContext = {
  participants: number;
  budgetPerPerson: number;
  nights: number;
  ambiances: string[];
  activityCategories: string[];
  maxDistanceKm: number;
  excludedCountries: string[];
  desiredDestination?: string | null;
  letKrewDecide: boolean;
  needsCityCenter: boolean;
  startMonth: number;
  /** Prix transport A/R / pers par destination_id (Kayak). Si absent → estimation. */
  transportByDestinationId?: Record<string, number>;
};

export type ItineraryDay = {
  day: number;
  title: string;
  slots: { moment: string; label: string; detail?: string | undefined; price?: number | undefined }[];
};

export type BudgetBreakdown = {
  transport: number;
  accommodation: number;
  activities: number;
  food: number;
  totalPerPerson: number;
  totalGroup: number;
  budgetPerPerson: number;
  fits: boolean;
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
};

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
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
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function seasonScore(dest: DestinationRecord, month: number): number {
  if (!dest.best_months?.length) return 0.6;
  if (dest.best_months.includes(month)) return 1;
  const distance = Math.min(
    ...dest.best_months.map((m) => Math.min(Math.abs(m - month), 12 - Math.abs(m - month))),
  );
  return clamp(1 - distance * 0.22, 0.15, 1);
}

/** Sélectionne les activités les plus pertinentes dans le budget disponible. */
function pickActivities(
  pool: ActivityRecord[],
  wantedCategories: string[],
  nights: number,
  budgetForActivities: number,
): ActivityRecord[] {
  const ranked = [...pool].sort((a, b) => {
    const aw = wantedCategories.includes(a.category) ? 1 : 0;
    const bw = wantedCategories.includes(b.category) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    return b.rating - a.rating;
  });
  const maxCount = Math.max(2, (nights + 1) * 2 - 1);
  const picked: ActivityRecord[] = [];
  let spent = 0;
  for (const activity of ranked) {
    if (picked.length >= maxCount) break;
    if (spent + activity.price_per_person > budgetForActivities && picked.length >= 2) continue;
    picked.push(activity);
    spent += activity.price_per_person;
  }
  return picked;
}

function buildItinerary(
  destination: DestinationRecord,
  accommodation: AccommodationRecord | null,
  activities: ActivityRecord[],
  nights: number,
): ItineraryDay[] {
  const days = Math.max(1, nights + 1);
  const queue = [...activities];
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
    const perDay = day === days ? 1 : 2;
    for (let i = 0; i < perDay; i++) {
      const activity = queue.shift();
      if (!activity) break;
      slots.push({
        moment: slots.some((s) => s.moment === "Après-midi") ? "Soirée" : "Après-midi",
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

export function buildProposals(catalog: TravelCatalog, ctx: ScoringContext, limit = 3): Proposal[] {
  const excluded = ctx.excludedCountries.map(norm).filter(Boolean);
  const desired = ctx.desiredDestination ? norm(ctx.desiredDestination) : "";

  const candidates = catalog.destinations.filter((d) => {
    if (excluded.includes(norm(d.country)) || excluded.includes(norm(d.name))) return false;
    if (d.distance_from_paris_km > ctx.maxDistanceKm * 1.15) return false;
    return true;
  });

  const proposals: Proposal[] = candidates.map((destination) => {
    const accommodations = catalog.accommodations
      .filter((a) => a.destination_id === destination.id)
      .sort((a, b) => {
        const capA = a.capacity >= ctx.participants ? 0 : 1;
        const capB = b.capacity >= ctx.participants ? 0 : 1;
        if (capA !== capB) return capA - capB;
        if (ctx.needsCityCenter && a.distance_center_km !== b.distance_center_km) {
          return a.distance_center_km - b.distance_center_km;
        }
        return a.price_per_night_per_person - b.price_per_night_per_person;
      });
    const accommodation = accommodations[0] ?? null;

    // Transport : Kayak si dispo, sinon estimation distance
    const transport =
      ctx.transportByDestinationId?.[destination.id] ??
      estimateTransport(destination.distance_from_paris_km);

    const lodging =
      (accommodation?.price_per_night_per_person ?? destination.avg_daily_cost * 0.4) * ctx.nights;
    const food = destination.avg_daily_cost * 0.4 * (ctx.nights + 1);
    const budgetForActivities = Math.max(40, ctx.budgetPerPerson - transport - lodging - food);

    const activities = pickActivities(
      catalog.activities.filter((a) => a.destination_id === destination.id),
      ctx.activityCategories,
      ctx.nights,
      budgetForActivities,
    );
    const activitiesCost = activities.reduce((sum, a) => sum + a.price_per_person, 0);
    const totalPerPerson = transport + lodging + food + activitiesCost;

    const budget: BudgetBreakdown = {
      transport: Math.round(transport),
      accommodation: Math.round(lodging),
      activities: Math.round(activitiesCost),
      food: Math.round(food),
      totalPerPerson: Math.round(totalPerPerson),
      totalGroup: Math.round(totalPerPerson * ctx.participants),
      budgetPerPerson: ctx.budgetPerPerson,
      fits: totalPerPerson <= ctx.budgetPerPerson,
    };

    // --- Scoring pondéré ---
    const sAmbiance = ambianceScore(destination, ctx.ambiances);
    const wanted = ctx.activityCategories;
    const available = new Set(
      catalog.activities.filter((a) => a.destination_id === destination.id).map((a) => a.category),
    );
    const sActivities = wanted.length
      ? wanted.filter((c) => available.has(c)).length / wanted.length
      : 0.6;
    const ratio = totalPerPerson / Math.max(1, ctx.budgetPerPerson);
    const sBudget = ratio <= 1 ? clamp(0.7 + (1 - ratio) * 0.6) : clamp(1 - (ratio - 1) * 1.8);
    const sDistance = clamp(1 - destination.distance_from_paris_km / Math.max(300, ctx.maxDistanceKm));
    const sSeason = seasonScore(destination, ctx.startMonth);
    const sQuality = clamp((destination.rating - 3.5) / 1.5) * 0.6 + destination.popularity * 0.4;

    let score =
      sAmbiance * 30 + sActivities * 20 + sBudget * 25 + sDistance * 10 + sSeason * 10 + sQuality * 5;

    if (!ctx.letKrewDecide && desired) {
      const matches =
        norm(destination.name).includes(desired) || norm(destination.country).includes(desired);
      score += matches ? 35 : -25;
    }

    const matchReasons: string[] = [];
    if (sAmbiance > 0.7) matchReasons.push("Colle parfaitement à l'ambiance recherchée par le groupe");
    if (sActivities >= 0.75)
      matchReasons.push("Toutes les catégories d'activités demandées sont disponibles sur place");
    if (budget.fits)
      matchReasons.push(
        `Budget respecté : ${Math.round(totalPerPerson)} € / pers. sur ${ctx.budgetPerPerson} €`,
      );
    else
      matchReasons.push(
        `Léger dépassement de budget (+${Math.round(totalPerPerson - ctx.budgetPerPerson)} € / pers.)`,
      );
    if (sSeason >= 0.9) matchReasons.push("Période idéale côté météo et saisonnalité");
    if (destination.distance_from_paris_km <= 900)
      matchReasons.push("Trajet court : plus de temps sur place, moins de fatigue");
    if (accommodation && accommodation.capacity >= ctx.participants)
      matchReasons.push(`Hébergement unique pour ${ctx.participants} personnes (${accommodation.type})`);
    if (ctx.transportByDestinationId?.[destination.id] != null)
      matchReasons.push(`Transport estimé via Kayak : ${Math.round(transport)} € A/R / pers.`);

    const rationale = `${destination.name} sort en tête pour un groupe de ${ctx.participants} personnes : ${
      destination.description ?? ""
    } Le rapport ambiance / budget / distance est le meilleur pour vos critères.`;

    return {
      destination,
      accommodation,
      activities,
      score: Math.round(clamp(score, 0, 100)),
      rationale,
      matchReasons,
      itinerary: buildItinerary(destination, accommodation, activities, ctx.nights),
      budget,
    };
  });

  return proposals.sort((a, b) => b.score - a.score).slice(0, limit);
}