import { getTripLifecycleState } from "./trip-lifecycle";

export type KrewPulseState = "attention" | "waiting" | "almost" | "ready";

export type KrewPulseInput = {
  availabilityAnswered: number;
  availabilityExpected: number;
  preferencesAnswered: number;
  preferencesExpected: number;
  datesLocked: boolean;
  profileReady: boolean;
  profileValidated: boolean;
  destinationSelected: boolean;
  hotelOffersReady: boolean;
  hotelSelected: boolean;
  transportOffersReady: boolean;
  transportPickedCount: number;
  transportExpectedCount: number;
  hasItinerary: boolean;
};

export type KrewPulse = {
  state: KrewPulseState;
  message: string;
};

export function getKrewPulse(input: KrewPulseInput): KrewPulse {
  const missingAvailability = input.datesLocked
    ? 0
    : Math.max(0, input.availabilityExpected - input.availabilityAnswered);
  const missingPreferences = Math.max(0, input.preferencesExpected - input.preferencesAnswered);

  if (missingAvailability > 0 && missingPreferences > 0) return { state: "waiting", message: "Il manque encore des réponses du groupe." };
  if (missingAvailability > 0) return { state: "waiting", message: `Encore ${missingAvailability} réponse${missingAvailability > 1 ? "s" : ""} de disponibilité à récupérer.` };
  if (missingPreferences > 0) return { state: "waiting", message: `Encore ${missingPreferences} réponse${missingPreferences > 1 ? "s" : ""} de préférences à récupérer.` };
  if (input.datesLocked && input.profileReady && !input.profileValidated) return { state: "attention", message: "Le Profil du voyage reste à choisir." };
  if (input.datesLocked && input.profileValidated && !input.destinationSelected) return { state: "attention", message: "La Krew doit encore choisir la destination." };
  if (input.destinationSelected && !input.hotelOffersReady) return { state: "attention", message: "L’hébergement reste à préparer." };
  if (input.hotelOffersReady && !input.hotelSelected) return { state: "attention", message: "Le groupe doit encore choisir l’hébergement." };
  if (input.transportOffersReady && input.transportExpectedCount > 0) {
    const missingTransport = Math.max(0, input.transportExpectedCount - input.transportPickedCount);
    if (missingTransport > 0) return { state: "waiting", message: `${missingTransport} personne${missingTransport > 1 ? "s" : ""} ${missingTransport > 1 ? "n’ont" : "n’a"} pas choisi ${missingTransport > 1 ? "leur" : "son"} transport.` };
  }
  if (input.destinationSelected && !input.transportOffersReady) return { state: "attention", message: "Les trajets restent à préparer." };
  if (input.destinationSelected && input.hotelSelected && input.transportOffersReady && !input.hasItinerary) return { state: "almost", message: "Le planning reste à préparer." };
  if (input.hasItinerary) return { state: "ready", message: "Tout est calé." };
  return { state: "almost", message: "Le voyage prend forme." };
}

export type TripCountdownState = "future" | "tomorrow" | "today" | "ongoing" | "ended";
export type TripCountdown = { state: TripCountdownState; label: string; microcopy: string | null; daysUntilStart: number };

function parseDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function todayDateOnly(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getTripCountdown(input: { datesLocked: boolean; startDate?: string | null; endDate?: string | null; now?: Date }): TripCountdown | null {
  if (!input.datesLocked || !input.startDate) return null;
  const start = parseDateOnly(input.startDate);
  if (start == null) return null;

  const now = input.now ?? new Date();
  const lifecycle = getTripLifecycleState({ ...input, now });
  const today = todayDateOnly(now);
  const daysUntilStart = Math.round((start - today) / (24 * 60 * 60 * 1000));

  if (lifecycle === "completed") return { state: "ended", label: "Voyage terminé", microcopy: null, daysUntilStart };
  if (lifecycle === "live") {
    if (daysUntilStart === 0) return { state: "today", label: "Aujourd’hui", microcopy: "C’est parti.", daysUntilStart: 0 };
    return { state: "ongoing", label: "En voyage", microcopy: null, daysUntilStart };
  }
  if (daysUntilStart > 1) return { state: "future", label: `J-${daysUntilStart}`, microcopy: daysUntilStart === 30 ? "Ça approche." : daysUntilStart <= 7 ? "Dernière ligne droite." : null, daysUntilStart };
  if (daysUntilStart === 1) return { state: "tomorrow", label: "Demain", microcopy: "Demain, la Krew part.", daysUntilStart: 1 };
  return { state: "future", label: "À venir", microcopy: null, daysUntilStart };
}
