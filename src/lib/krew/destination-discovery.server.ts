/**
 * Découverte dynamique de destinations à partir des critères du groupe.
 *
 * Ne s'appuie PAS sur la liste seed SQL. Construit une shortlist de villes
 * candidates via des règles métier (ambiance, budget, distance, type d'événement),
 * puis laisse les APIs externes (Booking, TripAdvisor, Kayak…) enrichir les offres.
 */

export type DiscoveryInput = {
  ambiances: string[];
  activityCategories: string[];
  budgetPerPerson: number;
  maxDistanceKm: number;
  nights: number;
  startMonth: number;
  excludedCountries: string[];
  departureCity: string;
  participants: number;
  eventType?: string;
};

export type CandidateDestination = {
  name: string;
  country: string;
  /** Distance approximative depuis Paris (km). Filtrée ensuite par maxDistanceKm. */
  distanceKm: number;
  /** Score interne 0–100 pour trier les candidates avant appel API. */
  affinity: number;
  reason: string;
};

type CityProfile = {
  name: string;
  country: string;
  distanceKm: number;
  /** Coût journalier indicatif €/pers (hors transport). */
  dailyCost: number;
  ambiances: Record<string, number>;
  activities: string[];
  bestMonths: number[];
  eventBoost: string[]; // event_type qui boostent cette ville
};

/**
 * Base de connaissance élargie (pas un seed SQL : pure logique de découverte).
 * ~40 destinations européennes / méditerranéennes typiques EVG / EVJF / week-end.
 */
const CITY_PROFILES: CityProfile[] = [
  // ——— Fête / budget accessible ———
  {
    name: "Budapest",
    country: "Hongrie",
    distanceKm: 1250,
    dailyCost: 65,
    ambiances: { fete: 0.95, aventure: 0.5, detente: 0.8, luxe: 0.4, insolite: 0.8, sportif: 0.4, culturel: 0.8 },
    activities: ["bars_clubs", "soirees", "detente", "experiences", "gastronomie"],
    bestMonths: [4, 5, 6, 7, 8, 9],
    eventBoost: ["evg", "evjf", "weekend"],
  },
  {
    name: "Prague",
    country: "République tchèque",
    distanceKm: 1030,
    dailyCost: 60,
    ambiances: { fete: 0.9, aventure: 0.5, detente: 0.6, luxe: 0.4, insolite: 0.7, sportif: 0.4, culturel: 0.9 },
    activities: ["bars_clubs", "soirees", "gastronomie", "experiences", "insolite"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "weekend", "anniversaire"],
  },
  {
    name: "Krakow",
    country: "Pologne",
    distanceKm: 1480,
    dailyCost: 55,
    ambiances: { fete: 0.9, aventure: 0.45, detente: 0.55, luxe: 0.35, insolite: 0.7, sportif: 0.4, culturel: 0.85 },
    activities: ["bars_clubs", "soirees", "gastronomie", "experiences"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Belgrade",
    country: "Serbie",
    distanceKm: 1450,
    dailyCost: 50,
    ambiances: { fete: 0.95, aventure: 0.5, detente: 0.5, luxe: 0.3, insolite: 0.85, sportif: 0.4, culturel: 0.7 },
    activities: ["bars_clubs", "soirees", "insolite", "experiences"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg"],
  },
  {
    name: "Porto",
    country: "Portugal",
    distanceKm: 1450,
    dailyCost: 75,
    ambiances: { fete: 0.8, aventure: 0.6, detente: 0.75, luxe: 0.5, insolite: 0.55, sportif: 0.6, culturel: 0.8 },
    activities: ["bars_clubs", "gastronomie", "experiences", "nautique"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evjf", "weekend", "anniversaire"],
  },
  {
    name: "Lisbonne",
    country: "Portugal",
    distanceKm: 1450,
    dailyCost: 85,
    ambiances: { fete: 0.9, aventure: 0.7, detente: 0.75, luxe: 0.55, insolite: 0.6, sportif: 0.75, culturel: 0.8 },
    activities: ["bars_clubs", "soirees", "nautique", "sport", "gastronomie", "experiences"],
    bestMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "evjf", "weekend"],
  },

  // ——— Plage / fête ———
  {
    name: "Barcelone",
    country: "Espagne",
    distanceKm: 1030,
    dailyCost: 95,
    ambiances: { fete: 0.95, aventure: 0.6, detente: 0.7, luxe: 0.6, insolite: 0.5, sportif: 0.7, culturel: 0.8 },
    activities: ["bars_clubs", "soirees", "nautique", "sport", "gastronomie", "experiences"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "evjf", "weekend", "anniversaire"],
  },
  {
    name: "Valence",
    country: "Espagne",
    distanceKm: 1180,
    dailyCost: 80,
    ambiances: { fete: 0.8, aventure: 0.7, detente: 0.8, luxe: 0.5, insolite: 0.5, sportif: 0.85, culturel: 0.7 },
    activities: ["nautique", "sport", "gastronomie", "bars_clubs", "experiences"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Ibiza",
    country: "Espagne",
    distanceKm: 1350,
    dailyCost: 140,
    ambiances: { fete: 1.0, aventure: 0.4, detente: 0.6, luxe: 0.85, insolite: 0.6, sportif: 0.5, culturel: 0.3 },
    activities: ["bars_clubs", "soirees", "nautique", "detente"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "evjf"],
  },
  {
    name: "Malaga",
    country: "Espagne",
    distanceKm: 1450,
    dailyCost: 85,
    ambiances: { fete: 0.75, aventure: 0.55, detente: 0.85, luxe: 0.55, insolite: 0.45, sportif: 0.7, culturel: 0.7 },
    activities: ["nautique", "gastronomie", "bars_clubs", "detente", "experiences"],
    bestMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evjf", "weekend", "anniversaire"],
  },
  {
    name: "Séville",
    country: "Espagne",
    distanceKm: 1550,
    dailyCost: 80,
    ambiances: { fete: 0.85, aventure: 0.5, detente: 0.7, luxe: 0.5, insolite: 0.6, sportif: 0.4, culturel: 0.95 },
    activities: ["gastronomie", "experiences", "soirees", "bars_clubs", "culturel"],
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    eventBoost: ["evjf", "anniversaire", "weekend"],
  },

  // ——— France accessible ———
  {
    name: "Biarritz",
    country: "France",
    distanceKm: 770,
    dailyCost: 105,
    ambiances: { fete: 0.7, aventure: 0.85, detente: 0.8, luxe: 0.6, insolite: 0.5, sportif: 0.95, culturel: 0.5 },
    activities: ["sport", "nautique", "sensations", "gastronomie", "bars_clubs"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend", "voyage_groupe"],
  },
  {
    name: "Annecy",
    country: "France",
    distanceKm: 540,
    dailyCost: 95,
    ambiances: { fete: 0.4, aventure: 0.95, detente: 0.85, luxe: 0.6, insolite: 0.6, sportif: 0.95, culturel: 0.5 },
    activities: ["sport", "sensations", "nautique", "detente", "experiences"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["weekend", "anniversaire", "voyage_groupe"],
  },
  {
    name: "Chamonix",
    country: "France",
    distanceKm: 620,
    dailyCost: 110,
    ambiances: { fete: 0.35, aventure: 1.0, detente: 0.6, luxe: 0.55, insolite: 0.5, sportif: 1.0, culturel: 0.4 },
    activities: ["sport", "sensations", "experiences"],
    bestMonths: [6, 7, 8, 9, 12, 1, 2, 3],
    eventBoost: ["weekend", "voyage_groupe"],
  },
  {
    name: "Nice",
    country: "France",
    distanceKm: 930,
    dailyCost: 120,
    ambiances: { fete: 0.7, aventure: 0.5, detente: 0.8, luxe: 0.85, insolite: 0.45, sportif: 0.6, culturel: 0.75 },
    activities: ["gastronomie", "detente", "nautique", "bars_clubs", "experiences"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evjf", "anniversaire", "weekend"],
  },
  {
    name: "Marseille",
    country: "France",
    distanceKm: 775,
    dailyCost: 90,
    ambiances: { fete: 0.75, aventure: 0.7, detente: 0.7, luxe: 0.5, insolite: 0.65, sportif: 0.75, culturel: 0.7 },
    activities: ["nautique", "gastronomie", "bars_clubs", "experiences", "sport"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Bordeaux",
    country: "France",
    distanceKm: 580,
    dailyCost: 95,
    ambiances: { fete: 0.7, aventure: 0.4, detente: 0.7, luxe: 0.65, insolite: 0.5, sportif: 0.4, culturel: 0.8 },
    activities: ["gastronomie", "bars_clubs", "experiences", "soirees"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evjf", "anniversaire", "weekend"],
  },
  {
    name: "Lyon",
    country: "France",
    distanceKm: 465,
    dailyCost: 95,
    ambiances: { fete: 0.65, aventure: 0.4, detente: 0.6, luxe: 0.6, insolite: 0.5, sportif: 0.4, culturel: 0.85 },
    activities: ["gastronomie", "bars_clubs", "experiences", "culturel"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["weekend", "anniversaire"],
  },

  // ——— Europe du Nord / centrale ———
  {
    name: "Amsterdam",
    country: "Pays-Bas",
    distanceKm: 500,
    dailyCost: 110,
    ambiances: { fete: 0.9, aventure: 0.45, detente: 0.6, luxe: 0.6, insolite: 0.7, sportif: 0.5, culturel: 0.85 },
    activities: ["bars_clubs", "soirees", "experiences", "insolite", "culturel"],
    bestMonths: [4, 5, 6, 7, 8, 9],
    eventBoost: ["evg", "evjf", "weekend"],
  },
  {
    name: "Berlin",
    country: "Allemagne",
    distanceKm: 1050,
    dailyCost: 90,
    ambiances: { fete: 0.95, aventure: 0.5, detente: 0.5, luxe: 0.5, insolite: 0.9, sportif: 0.45, culturel: 0.9 },
    activities: ["bars_clubs", "soirees", "insolite", "culturel", "experiences"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Bruxelles",
    country: "Belgique",
    distanceKm: 310,
    dailyCost: 100,
    ambiances: { fete: 0.7, aventure: 0.35, detente: 0.55, luxe: 0.55, insolite: 0.55, sportif: 0.35, culturel: 0.8 },
    activities: ["gastronomie", "bars_clubs", "experiences", "culturel"],
    bestMonths: [4, 5, 6, 7, 8, 9],
    eventBoost: ["weekend", "anniversaire"],
  },
  {
    name: "Vienne",
    country: "Autriche",
    distanceKm: 1235,
    dailyCost: 100,
    ambiances: { fete: 0.55, aventure: 0.4, detente: 0.7, luxe: 0.75, insolite: 0.5, sportif: 0.4, culturel: 0.95 },
    activities: ["culturel", "gastronomie", "experiences", "detente"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["anniversaire", "evjf", "weekend"],
  },
  {
    name: "Munich",
    country: "Allemagne",
    distanceKm: 820,
    dailyCost: 105,
    ambiances: { fete: 0.8, aventure: 0.55, detente: 0.6, luxe: 0.6, insolite: 0.5, sportif: 0.6, culturel: 0.75 },
    activities: ["bars_clubs", "gastronomie", "experiences", "sport"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },

  // ——— Méditerranée / exotique proche ———
  {
    name: "Marrakech",
    country: "Maroc",
    distanceKm: 2350,
    dailyCost: 70,
    ambiances: { fete: 0.7, aventure: 0.9, detente: 0.85, luxe: 0.8, insolite: 0.9, sportif: 0.6, culturel: 0.85 },
    activities: ["experiences", "detente", "sensations", "gastronomie", "insolite"],
    bestMonths: [2, 3, 4, 5, 9, 10, 11],
    eventBoost: ["evjf", "anniversaire", "voyage_groupe"],
  },
  {
    name: "Tanger",
    country: "Maroc",
    distanceKm: 1850,
    dailyCost: 65,
    ambiances: { fete: 0.6, aventure: 0.75, detente: 0.8, luxe: 0.55, insolite: 0.8, sportif: 0.55, culturel: 0.8 },
    activities: ["experiences", "gastronomie", "detente", "nautique"],
    bestMonths: [3, 4, 5, 6, 9, 10, 11],
    eventBoost: ["weekend", "voyage_groupe"],
  },
  {
    name: "Dubrovnik",
    country: "Croatie",
    distanceKm: 1550,
    dailyCost: 100,
    ambiances: { fete: 0.7, aventure: 0.7, detente: 0.85, luxe: 0.7, insolite: 0.55, sportif: 0.7, culturel: 0.8 },
    activities: ["nautique", "experiences", "detente", "gastronomie", "bars_clubs"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evjf", "anniversaire", "weekend"],
  },
  {
    name: "Split",
    country: "Croatie",
    distanceKm: 1400,
    dailyCost: 90,
    ambiances: { fete: 0.8, aventure: 0.7, detente: 0.8, luxe: 0.55, insolite: 0.55, sportif: 0.75, culturel: 0.7 },
    activities: ["nautique", "bars_clubs", "sport", "experiences"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "evjf", "weekend"],
  },
  {
    name: "Athènes",
    country: "Grèce",
    distanceKm: 2100,
    dailyCost: 85,
    ambiances: { fete: 0.75, aventure: 0.6, detente: 0.7, luxe: 0.55, insolite: 0.6, sportif: 0.55, culturel: 0.95 },
    activities: ["culturel", "gastronomie", "bars_clubs", "experiences", "nautique"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["anniversaire", "evjf", "voyage_groupe"],
  },
  {
    name: "Rome",
    country: "Italie",
    distanceKm: 1420,
    dailyCost: 110,
    ambiances: { fete: 0.65, aventure: 0.4, detente: 0.65, luxe: 0.7, insolite: 0.5, sportif: 0.35, culturel: 1.0 },
    activities: ["culturel", "gastronomie", "experiences", "bars_clubs"],
    bestMonths: [4, 5, 6, 9, 10],
    eventBoost: ["anniversaire", "evjf", "voyage_groupe"],
  },
  {
    name: "Milan",
    country: "Italie",
    distanceKm: 850,
    dailyCost: 115,
    ambiances: { fete: 0.7, aventure: 0.35, detente: 0.55, luxe: 0.85, insolite: 0.5, sportif: 0.4, culturel: 0.8 },
    activities: ["gastronomie", "bars_clubs", "culturel", "experiences"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evjf", "anniversaire", "weekend"],
  },
  {
    name: "Naples",
    country: "Italie",
    distanceKm: 1500,
    dailyCost: 85,
    ambiances: { fete: 0.75, aventure: 0.65, detente: 0.7, luxe: 0.45, insolite: 0.7, sportif: 0.55, culturel: 0.85 },
    activities: ["gastronomie", "experiences", "nautique", "bars_clubs"],
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "weekend"],
  },

  // ——— UK / Nord ———
  {
    name: "Londres",
    country: "Royaume-Uni",
    distanceKm: 450,
    dailyCost: 140,
    ambiances: { fete: 0.85, aventure: 0.4, detente: 0.5, luxe: 0.8, insolite: 0.7, sportif: 0.4, culturel: 0.95 },
    activities: ["bars_clubs", "soirees", "culturel", "experiences", "gastronomie"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "evjf", "anniversaire"],
  },
  {
    name: "Édimbourg",
    country: "Royaume-Uni",
    distanceKm: 900,
    dailyCost: 115,
    ambiances: { fete: 0.8, aventure: 0.7, detente: 0.55, luxe: 0.55, insolite: 0.75, sportif: 0.55, culturel: 0.85 },
    activities: ["bars_clubs", "experiences", "culturel", "insolite"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Dublin",
    country: "Irlande",
    distanceKm: 780,
    dailyCost: 120,
    ambiances: { fete: 0.9, aventure: 0.55, detente: 0.5, luxe: 0.5, insolite: 0.65, sportif: 0.45, culturel: 0.75 },
    activities: ["bars_clubs", "soirees", "experiences", "gastronomie"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },

  // ——— Autres ———
  {
    name: "Lisbonne",
    country: "Portugal",
    distanceKm: 1450,
    dailyCost: 85,
    ambiances: { fete: 0.9, aventure: 0.7, detente: 0.75, luxe: 0.55, insolite: 0.6, sportif: 0.75, culturel: 0.8 },
    activities: ["bars_clubs", "soirees", "nautique", "sport", "gastronomie"],
    bestMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    eventBoost: ["evg", "evjf", "weekend"],
  },
  {
    name: "Tallinn",
    country: "Estonie",
    distanceKm: 1850,
    dailyCost: 70,
    ambiances: { fete: 0.75, aventure: 0.5, detente: 0.55, luxe: 0.4, insolite: 0.8, sportif: 0.4, culturel: 0.8 },
    activities: ["bars_clubs", "insolite", "experiences", "culturel"],
    bestMonths: [5, 6, 7, 8, 9],
    eventBoost: ["evg", "weekend"],
  },
  {
    name: "Reykjavik",
    country: "Islande",
    distanceKm: 2250,
    dailyCost: 150,
    ambiances: { fete: 0.5, aventure: 1.0, detente: 0.7, luxe: 0.6, insolite: 0.95, sportif: 0.8, culturel: 0.6 },
    activities: ["sensations", "experiences", "insolite", "detente", "sport"],
    bestMonths: [6, 7, 8, 9],
    eventBoost: ["voyage_groupe", "anniversaire"],
  },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function seasonAffinity(bestMonths: number[], month: number): number {
  if (!bestMonths.length) return 0.6;
  if (bestMonths.includes(month)) return 1;
  const distance = Math.min(
    ...bestMonths.map((m) => Math.min(Math.abs(m - month), 12 - Math.abs(m - month))),
  );
  return Math.max(0.15, 1 - distance * 0.22);
}

/**
 * Génère une shortlist de destinations candidates à partir des critères agrégés.
 * Aucune lecture de la table `destinations` : pure découverte par règles.
 */
export function discoverCandidateDestinations(
  input: DiscoveryInput,
  limit = 8,
): CandidateDestination[] {
  const excluded = new Set(input.excludedCountries.map(norm).filter(Boolean));
  const ambiances = input.ambiances.filter(Boolean);
  const activities = input.activityCategories.filter(Boolean);
  const eventType = input.eventType ?? "";

  // Dédupliquer au cas où (Lisbonne apparaît 2x dans le profil)
  const seen = new Set<string>();
  const uniqueProfiles = CITY_PROFILES.filter((c) => {
    const key = norm(c.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const scored: CandidateDestination[] = [];

  for (const city of uniqueProfiles) {
    if (excluded.has(norm(city.country)) || excluded.has(norm(city.name))) continue;
    if (city.distanceKm > input.maxDistanceKm * 1.2) continue;

    // Budget : coût séjour estimé (journalier × nuits + transport rough)
    // On ne drop plus en dur — on pénalise le score (le ranking final décide)
    const roughTransport =
      city.distanceKm <= 350 ? 45 : city.distanceKm <= 900 ? 90 : city.distanceKm <= 1600 ? 130 : 180;
    const estimatedTotal = city.dailyCost * (input.nights + 1) + roughTransport;

    // Score ambiance (moyenne des ambiances demandées)
    let sAmbiance = 0.55;
    if (ambiances.length) {
      const vals = ambiances.map((a) => city.ambiances[a] ?? 0.3);
      sAmbiance = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    // Score activités
    let sActivities = 0.5;
    if (activities.length) {
      const hits = activities.filter((a) => city.activities.includes(a)).length;
      sActivities = hits / activities.length;
    }

    // Budget fit (1 = parfait, descend si on dépasse)
    const ratio = estimatedTotal / Math.max(1, input.budgetPerPerson);
    const sBudget = ratio <= 1 ? 0.7 + (1 - ratio) * 0.3 : Math.max(0.1, 1 - (ratio - 1) * 1.5);

    // Distance (plus proche = mieux, dans la limite)
    const sDistance = Math.max(0.15, 1 - city.distanceKm / Math.max(400, input.maxDistanceKm));

    // Saison
    const sSeason = seasonAffinity(city.bestMonths, input.startMonth);

    // Boost type d'événement
    const sEvent = eventType && city.eventBoost.includes(eventType) ? 1 : 0.6;

    const affinity =
      sAmbiance * 32 +
      sActivities * 22 +
      sBudget * 22 +
      sDistance * 10 +
      sSeason * 8 +
      sEvent * 6;

    const reasons: string[] = [];
    if (sAmbiance >= 0.75) reasons.push("ambiance recherchée");
    if (sActivities >= 0.6) reasons.push("activités demandées");
    if (sBudget >= 0.7) reasons.push("budget compatible");
    if (sEvent >= 1) reasons.push(`idéal ${eventType.toUpperCase()}`);
    if (sSeason >= 0.9) reasons.push("bonne saison");

    scored.push({
      name: city.name,
      country: city.country,
      distanceKm: city.distanceKm,
      affinity: Math.round(affinity * 10) / 10,
      reason: reasons.length ? reasons.join(" · ") : "correspond aux critères du groupe",
    });
  }

  scored.sort((a, b) => b.affinity - a.affinity);
  return scored.slice(0, limit);
}

/** Profils bruts (pour upsert catalogue avant scoring moteur). */
export function listCityProfilesForNames(names: string[]) {
  const want = new Set(names.map((n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()));
  return CITY_PROFILES.filter((c) =>
    want.has(c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()),
  );
}
