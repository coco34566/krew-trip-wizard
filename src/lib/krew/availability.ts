/**
 * Calcul de la meilleure fenêtre de dates à partir des disponibilités individuelles.
 * Fonctions pures — pas de dépendance Supabase.
 */

export type AvailabilityEntry = {
  userId: string;
  availableDates: string[]; // YYYY-MM-DD
  blockedDates: string[];
  flexDays: number;
  durationNights?: number;
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
  isWeekend: boolean;
  /** userIds qui PEUVENT participer sur cette fenêtre */
  availableUserIds: string[];
  /** userIds qui NE PEUVENT PAS (dispos incompatibles / bloquées) */
  unavailableUserIds: string[];
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
export function windowOkFor(entry: AvailabilityEntry, start: string, end: string): boolean {
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
export function rankDateWindows(entries: AvailabilityEntry[], nights = 2, limit = 5): DateWindow[] {
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
    const availableUserIds = entries.filter((e) => windowOkFor(e, start, end)).map((e) => e.userId);
    const unavailableUserIds = entries
      .filter((e) => !windowOkFor(e, start, end))
      .map((e) => e.userId);
    const covered = availableUserIds.length;
    const total = entries.length;
    const coverageRatio = total ? covered / total : 0;
    // La couverture prime toujours ; le week-end est uniquement un départage.
    const dow = new Date(start + "T12:00:00Z").getUTCDay();
    const isWeekend = dow === 5 || dow === 6;
    const score = coverageRatio * 100;
    if (covered > 0) {
      candidates.push({
        start,
        end,
        nights,
        covered,
        total,
        coverageRatio,
        score: Math.round(score * 10) / 10,
        isWeekend,
        availableUserIds,
        unavailableUserIds,
      });
    }
    cursor = addDaysIso(cursor, 1);
  }

  candidates.sort(
    (a, b) =>
      b.coverageRatio - a.coverageRatio ||
      Number(b.isWeekend) - Number(a.isWeekend) ||
      a.start.localeCompare(b.start),
  );
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
  | "dates"
  | "profile"
  | "destination"
  | "hotels"
  | "transport"
  | "organize"
  | "realized"
  | "memories";

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
  datesLocked: boolean;
  profileReady?: boolean;
  profileValidated?: boolean;
  hasRecommendations: boolean;
  destinationSelected: boolean;
  /** Au moins un vote hôtel (ou hôtel plébiscité) */
  hotelVoted?: boolean;
  /** Au moins un trajet choisi par un participant */
  transportPicked?: boolean;
  /** Planning généré */
  hasItinerary?: boolean;
  /** Activités du planning validées (activity_votes ou selected_activity_ids) */
  activitiesValidated?: boolean;
  /** Date de fin passée */
  tripEndDatePassed?: boolean;
}): TripStep[] {
  const minAnswers = 1;

  let availDone = input.availabilityAnswered >= minAnswers;
  let questDone = input.questionnaireAnswered >= minAnswers;
  let datesDone = Boolean(input.datesLocked);
  let profileDone = Boolean(
    input.profileValidated || input.hasRecommendations || input.destinationSelected,
  );
  let destDone = Boolean(input.destinationSelected);
  let hotelDone = Boolean(input.hotelVoted);
  let transportDone = Boolean(input.transportPicked);
  let orgDone = Boolean(input.hasItinerary) && Boolean(input.activitiesValidated);
  let realizedDone = Boolean(input.tripEndDatePassed);
  let memoriesDone = false;

  // Cascade : une étape avancée valide les précédentes
  if (realizedDone) {
    orgDone = true;
    transportDone = true;
    hotelDone = true;
    destDone = true;
  }
  if (orgDone) {
    transportDone = true;
    hotelDone = true;
    destDone = true;
  }
  if (transportDone) {
    hotelDone = true;
    destDone = true;
  }
  if (hotelDone) destDone = true;
  if (destDone) {
    profileDone = true;
    datesDone = true;
    questDone = true;
    availDone = true;
  }
  if (datesDone) {
    questDone = true;
    availDone = true;
  }
  if (questDone) availDone = true;

  const inviteDone =
    input.participantsJoined >= 1 || availDone || questDone || datesDone || destDone;

  function statusFor(done: boolean, prereqDone: boolean): TripStep["status"] {
    if (done) return "done";
    if (!prereqDone) return "soon";
    return "active";
  }

  return [
    {
      id: "invite",
      label: "Inviter",
      description: "",
      href: "/invite",
      status: inviteDone ? "done" : "active",
    },
    {
      id: "availability",
      label: "Disponibilités",
      description: "",
      href: "/availability",
      status: statusFor(availDone, inviteDone),
    },
    {
      id: "questionnaire",
      label: "Préférences",
      description: "",
      href: "/questionnaire",
      status: statusFor(questDone, availDone),
    },
    {
      id: "dates",
      label: "Dates validées",
      description: "",
      href: "",
      status: statusFor(datesDone, questDone),
    },
    {
      id: "profile",
      label: "Profil du voyage",
      description: "",
      href: "",
      status: statusFor(profileDone, questDone),
    },
    {
      id: "destination",
      label: "Destination",
      description: "",
      href: "",
      status: statusFor(destDone, profileDone),
    },
    {
      id: "hotels",
      label: "Hébergement",
      description: "",
      href: "",
      status: statusFor(hotelDone, destDone),
    },
    {
      id: "transport",
      label: "Transport",
      description: "",
      href: "",
      status: statusFor(transportDone, hotelDone),
    },
    {
      id: "organize",
      label: "Organisation",
      description: "",
      status: statusFor(orgDone, transportDone),
    },
    {
      id: "realized",
      label: "Voyage réalisé",
      description: "",
      href: "",
      status: statusFor(realizedDone, orgDone),
    },
    {
      id: "memories",
      label: "Souvenirs du voyage",
      description: "",
      href: "/memories",
      status: statusFor(memoriesDone, realizedDone),
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
