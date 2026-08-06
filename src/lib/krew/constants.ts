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
  { value: "soirees", label: "Soirées", emoji: "🌙" },
  { value: "bars_clubs", label: "Bars & clubs", emoji: "🍸" },
  { value: "sport", label: "Activités sportives", emoji: "⚽" },
  { value: "sensations", label: "Sensations fortes", emoji: "🪂" },
  { value: "nautique", label: "Activités nautiques", emoji: "🌊" },
  { value: "gastronomie", label: "Gastronomie", emoji: "🍽️" },
  { value: "experiences", label: "Expériences locales", emoji: "🗺️" },
  { value: "insolite", label: "Activités insolites", emoji: "🎪" },
  { value: "detente", label: "Détente & spa", emoji: "💆" },
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
