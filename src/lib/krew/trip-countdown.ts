import { getTripLifecycleState } from "./trip-lifecycle";

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
  if (daysUntilStart === 1) return { state: "tomorrow", label: "Demain", microcopy: "Demain, la Krew part.", daysUntilStart };
  return { state: "future", label: "À venir", microcopy: null, daysUntilStart };
}
