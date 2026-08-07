/**
 * Calcul de la meilleure fenêtre de dates à partir des disponibilités individuelles.
 * Fonctions pures — pas de dépendance Supabase.
 */

export type AvailabilityEntry = {
  userId: string;
  availableDates: string[]; // YYYY-MM-DD
  blockedDates: string[];
  flexDays: number;
};

export type DateWindow = {
  start: string;
  end: string;
  nights: number;
  /** Nombre de participants pour qui la fenêtre est OK. */
  covered: number;
  total: number;
  coverageRatio: number;
  score: number;
};

function parseDay(iso: string): number {
  return Date.parse(iso + "T12:00:00Z");
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  return toIso(parseDay(iso) + days * 86400000);
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (parseDay(cur) <= parseDay(end)) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

/** Une fenêtre est OK pour un participant si aucun jour n'est blocked et
 *  (available vide = tout OK hors blocked) OU chaque jour est available / dans flex. */
function windowOkFor(entry: AvailabilityEntry, start: string, end: string): boolean {
  const days = eachDay(start, end);
  const blocked = new Set(entry.blockedDates.map((d) => d.slice(0, 10)));
  for (const d of days) {
    if (blocked.has(d)) return false;
  }
  if (!entry.availableDates.length) return true;
  const available = new Set(entry.availableDates.map((d) => d.slice(0, 10)));
  // flex: élargit les jours "disponibles" de ±flexDays
  if (entry.flexDays > 0) {
    for (const a of [...available]) {
      for (let i = -entry.flexDays; i <= entry.flexDays; i++) {
        available.add(addDaysIso(a, i));
      }
    }
  }
  return days.every((d) => available.has(d));
}

/**
 * Explore les fenêtres candidates de `nights` nuits sur l'union des dates mentionnées.
 */
export function rankDateWindows(
  entries: AvailabilityEntry[],
  nights = 2,
  limit = 5,
): DateWindow[] {
  if (!entries.length) return [];

  const allDates = new Set<string>();
  for (const e of entries) {
    for (const d of e.availableDates) allDates.add(d.slice(0, 10));
    for (const d of e.blockedDates) allDates.add(d.slice(0, 10));
  }
  // Si aucune date explicite, proposer 8 prochains week-ends (ven→dim)
  if (allDates.size === 0) {
    const base = new Date();
    base.setUTCHours(12, 0, 0, 0);
    for (let w = 0; w < 12; w++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + w * 7);
      // avancer jusqu'au vendredi
      const day = d.getUTCDay();
      const toFri = (5 - day + 7) % 7;
      d.setUTCDate(d.getUTCDate() + toFri);
      const start = d.toISOString().slice(0, 10);
      allDates.add(start);
      allDates.add(addDaysIso(start, nights));
    }
  }

  const sorted = [...allDates].sort();
  if (sorted.length === 0) return [];

  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  // Étendre un peu la plage explorée
  const rangeStart = addDaysIso(min, -7);
  const rangeEnd = addDaysIso(max, 21);

  const candidates: DateWindow[] = [];
  let cursor = rangeStart;
  const hardEnd = rangeEnd;
  while (parseDay(cursor) <= parseDay(hardEnd)) {
    const start = cursor;
    const end = addDaysIso(start, nights);
    const covered = entries.filter((e) => windowOkFor(e, start, end)).length;
    const total = entries.length;
    const coverageRatio = covered / total;
    // Score : couverture + bonus week-end (ven/sam départ)
    const dow = new Date(start + "T12:00:00Z").getUTCDay();
    const weekendBonus = dow === 5 || dow === 6 ? 0.05 : 0;
    const score = coverageRatio * 100 + weekendBonus * 100;
    if (covered > 0) {
      candidates.push({
        start,
        end,
        nights,
        covered,
        total,
        coverageRatio,
        score: Math.round(score * 10) / 10,
      });
    }
    cursor = addDaysIso(cursor, 1);
  }

  candidates.sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  // Dédupliquer fenêtres qui se chevauchent trop (garder la meilleure)
  const picked: DateWindow[] = [];
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const overlaps = picked.some(
      (p) => !(parseDay(c.end) < parseDay(p.start) || parseDay(c.start) > parseDay(p.end)),
    );
    if (!overlaps) picked.push(c);
  }
  return picked;
}

export type TripStepId =
  | "invite"
  | "availability"
  | "questionnaire"
  | "destination"
  | "organize";

export type TripStep = {
  id: TripStepId;
  label: string;
  description: string;
  href?: string; // relative path after /trips/:id
  status: "todo" | "active" | "done" | "soon";
};

export function buildTripSteps(input: {
  tripId: string;
  participantsJoined: number;
  participantsExpected: number;
  availabilityAnswered: number;
  questionnaireAnswered: number;
  hasRecommendations: boolean;
  destinationSelected: boolean;
}): TripStep[] {
  const inviteDone = input.participantsJoined >= Math.min(2, input.participantsExpected);
  const availDone =
    input.availabilityAnswered >= Math.max(2, Math.ceil(input.participantsExpected * 0.4));
  const questDone =
    input.questionnaireAnswered >= Math.max(2, Math.ceil(input.participantsExpected * 0.4));
  const destDone = input.destinationSelected;

  return [
    {
      id: "invite",
      label: "Inviter",
      description: "Réunir le groupe",
      href: "",
      status: inviteDone ? "done" : "active",
    },
    {
      id: "availability",
      label: "Disponibilités",
      description: "Trouver la date",
      href: "/availability",
      status: !inviteDone ? "todo" : availDone ? "done" : "active",
    },
    {
      id: "questionnaire",
      label: "Préférences",
      description: "Questionnaire",
      href: "/questionnaire",
      status: !availDone && !questDone ? "todo" : questDone ? "done" : "active",
    },
    {
      id: "destination",
      label: "Destination",
      description: "Propositions Krew",
      href: "",
      status: destDone ? "done" : questDone || input.hasRecommendations ? "active" : "todo",
    },
    {
      id: "organize",
      label: "Organisation",
      description: "Suite du séjour",
      status: destDone ? "active" : "soon",
    },
  ];
}

/** Modules post-destination (architecture extensible). */
export const HUB_COMING_SOON = [
  { id: "planning", label: "Planning du séjour", icon: "calendar" },
  { id: "stays", label: "Hébergements", icon: "hotel" },
  { id: "activities", label: "Activités réservées", icon: "ticket" },
  { id: "expenses", label: "Dépenses communes", icon: "wallet" },
  { id: "rooms", label: "Répartition des chambres", icon: "bed" },
  { id: "checklist", label: "Check-list", icon: "check" },
  { id: "docs", label: "Documents & billets", icon: "file" },
  { id: "polls", label: "Sondages", icon: "bar" },
  { id: "chat", label: "Chat de groupe", icon: "chat" },
] as const;
