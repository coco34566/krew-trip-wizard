/**
 * Référentiels métier Krew.
 * Partagés entre le wizard (client) et le moteur de recommandation (serveur).
 */

export const EVENT_TYPES = [
  { value: "evg", label: "EVG", emoji: "🍻" },
  { value: "evjf", label: "EVJF", emoji: "🥂" },
  { value: "anniversaire", label: "Anniversaire", emoji: "🎂" },
  { value: "weekend", label: "Week-end entre amis", emoji: "🌴" },
  { value: "voyage_groupe", label: "Voyage de groupe", emoji: "✈️" },
  { value: "famille", label: "Voyage famille", emoji: "👨‍👩‍👧‍👦" },
  { value: "seminaire", label: "Séminaire", emoji: "💼" },
  { value: "retraite", label: "Départ à la retraite", emoji: "🎉" },
  { value: "autre", label: "Autre", emoji: "✨" },
] as const;

/** Types d'événement où une "Star" (personne principale) a du sens. */
export const STAR_EVENT_TYPES = new Set([
  "evg",
  "evjf",
  "anniversaire",
  "retraite",
]);

export const STAR_WANTED_ACTIVITIES = [
  "sport",
  "plage",
  "randonnée",
  "spa",
  "bateau",
  "ski",
  "karting",
  "soirée",
  "gastronomie",
  "musée",
  "shopping",
  "nature",
] as const;

export const STAR_DEAL_BREAKERS = [
  "déguisement",
  "strip-tease",
  "activités extrêmes",
  "musée",
  "camping",
  "foule",
  "sport intense",
  "long trajet",
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["value"];

export const AMBIANCES = [
  { value: "fete", label: "Fête", emoji: "🎉" },
  { value: "aventure", label: "Aventure", emoji: "🧗" },
  { value: "detente", label: "Détente", emoji: "🧖" },
  { value: "luxe", label: "Luxe", emoji: "💎" },
  { value: "insolite", label: "Insolite", emoji: "🛸" },
  { value: "sportif", label: "Sportif", emoji: "🏄" },
  { value: "culturel", label: "Culturel", emoji: "🏛️" },
] as const;

export type Ambiance = (typeof AMBIANCES)[number]["value"];

/** Colonne de score correspondante dans la table `destinations`. */
export const AMBIANCE_SCORE_COLUMN: Record<Ambiance, string> = {
  fete: "score_fete",
  aventure: "score_aventure",
  detente: "score_detente",
  luxe: "score_luxe",
  insolite: "score_insolite",
  sportif: "score_sportif",
  culturel: "score_culturel",
};

export const ACTIVITY_CATEGORIES = [
  { value: "soirees", label: "Soirées / nightlife", emoji: "🌙" },
  { value: "bars_clubs", label: "Bars & clubs", emoji: "🍸" },
  { value: "gastronomie", label: "Restos & street food", emoji: "🍽️" },
  { value: "culture", label: "Musées & culture", emoji: "🏛️" },
  { value: "experiences", label: "Visites & expériences", emoji: "🗺️" },
  { value: "nautique", label: "Plage & nautique", emoji: "🌊" },
  { value: "sport", label: "Sport & outdoor", emoji: "⚽" },
  { value: "sensations", label: "Sensations fortes", emoji: "🪂" },
  { value: "detente", label: "Spa & détente", emoji: "💆" },
  { value: "shopping", label: "Shopping", emoji: "🛍️" },
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];

export const DIETARY_OPTIONS = [
  "Végétarien",
  "Végan",
  "Sans gluten",
  "Halal",
  "Casher",
  "Allergies (fruits de mer, arachides…)",
] as const;

export const TRIP_STATUS_LABELS: Record<string, string> = {
  annule: "Annulé",
  brouillon: "Brouillon",
  en_preparation: "En préparation",
  propositions: "Propositions prêtes",
  valide: "Validé",
  termine: "Terminé",
};

export function eventTypeLabel(value: string) {
  return EVENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

export function ambianceLabel(value: string) {
  return AMBIANCES.find((a) => a.value === value)?.label ?? value;
}

export function categoryLabel(value: string) {
  return ACTIVITY_CATEGORIES.find((a) => a.value === value)?.label ?? value;
}

// Nouveaux référentiels pour les champs ajoutés
export const TRAVEL_PACE = [
  { value: "plein_programme", label: "Plein programme" },
  { value: "equilibre", label: "Équilibré" },
  { value: "chill", label: "Chill" },
] as const;

export const TIME_SLOTS = [
  { value: "matin", label: "Matin" },
  { value: "apres_midi", label: "Après-midi" },
  { value: "soir", label: "Soir" },
] as const;

export const AMENITIES = [
  { value: "piscine", label: "Piscine" },
  { value: "climatisation", label: "Climatisation" },
  { value: "cuisine", label: "Cuisine" },
  { value: "acces_pmr", label: "Accès PMR" },
  { value: "ascenseur", label: "Ascenseur" },
] as const;

export const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
    Math.round(value),
  );


/** Presets distance (filtres utiles pour shortlist + vols). */
export const DISTANCE_PRESETS = [
  { value: 400, label: "Proche (≤ 400 km)", hint: "Train / covoit possible" },
  { value: 900, label: "Europe proche (≤ 900 km)", hint: "Vol court ou train" },
  { value: 1500, label: "Europe élargie (≤ 1 500 km)", hint: "Vol 2–3 h" },
  { value: 2500, label: "Plus loin (≤ 2 500 km)", hint: "Vol moyen-courrier" },
] as const;

/** Tranches de budget typiques EVG / week-end (par personne, tout compris). */
export const BUDGET_PRESETS = [
  { value: 250, label: "Serré", hint: "~250 €" },
  { value: 400, label: "Correct", hint: "~400 €" },
  { value: 600, label: "Confort", hint: "~600 €" },
  { value: 900, label: "Premium", hint: "~900 €" },
] as const;

/** Taille de groupe réaliste pour Krew. */
export const PARTICIPANTS_MIN = 2;
export const PARTICIPANTS_MAX = 25;
export const PARTICIPANTS_DEFAULT = 6;
