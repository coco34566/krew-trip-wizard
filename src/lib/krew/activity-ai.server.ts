/* eslint-disable @typescript-eslint/no-explicit-any -- provider JSON is validated at the normalization boundary */
import {
  discoverActivities,
  isSafeActivityUrl,
  type ActivityCandidate,
} from "@/lib/krew/activity-discovery.server";
import { reportServerError } from "@/lib/server-error-reporting.server";

export type ActivitySlotType = "resto" | "activite" | "bar" | "transport" | "libre";
export type ActivityCategory =
  | "repas"
  | "sport_outdoor"
  | "detente"
  | "moment_maison"
  | "jeu_groupe"
  | "evenement"
  | "transport"
  | "temps_libre"
  | "culture"
  | "soiree";
export type ActivitySlot = {
  moment: string;
  type: ActivitySlotType;
  category?: ActivityCategory | undefined;
  tags?: string[] | undefined;
  label: string;
  detail?: string | undefined;
  priceHint?: number | undefined;
  time?: string | null | undefined;
  endTime?: string | null | undefined;
  durationMinutes?: number | null | undefined;
  url?: string | null | undefined;
  candidateId?: string | null | undefined;
  verified?: boolean | undefined;
  source?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  openingHoursVerified?: boolean | undefined;
};
export type ItineraryDayPlan = { day: number; date?: string | null; slots: ActivitySlot[] };
export type GroupItinerary = {
  destination: string;
  nights: number;
  days: ItineraryDayPlan[];
  source: "ai" | "local";
  provider?: "gemini" | "aimlapi" | "local";
  generatedAt: string;
  discovery?: {
    candidateCount: number;
    shortlistedCount: number;
    cached: boolean;
    verifiedAt: string | null;
  };
};
export type TransportPickSummary = {
  city: string;
  mode: string;
  outboundDeparture?: string | null;
  arrival?: string | null;
  departure?: string | null;
  returnArrival?: string | null;
  durationHours?: number | null;
};
export type ActivityAiInput = {
  destination: string;
  country?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nights: number;
  participants: number;
  budgetPerPerson: number;
  eventType?: string | null;
  tripProfile?: string | null;
  ambiances: string[];
  activityCategories: string[];
  starWanted?: string[];
  dietaryConstraints?: string[];
  travelPace?: string | null;
  preferredTimeSlots?: string[];
  matchReasons?: string[];
  destinationScore?: number | null;
  scoredActivityLabels?: string[];
  latestGroupArrival?: string | null;
  earliestGroupDeparture?: string | null;
  latestReturnHome?: string | null;
  earliestOutboundDeparture?: string | null;
  transportDurationHours?: number | null;
  transferMarginMinutes?: number | null;
  transportPicksSummary?: TransportPickSummary[];
  individualPreferences?: any[];
  groupAgeRange?: string | null;
  starWantedEnvType?: string | null;
  wantedEnvTypes?: string[];
  forceDiscoveryRefresh?: boolean;
};

const GEMINI_MODEL = "gemini-2.5-flash";
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const toMinutes = (time?: string | null) =>
  time && HHMM.test(time.slice(0, 5))
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
    : null;
const fromMinutes = (minutes: number) =>
  `${String(Math.floor((((minutes % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((minutes % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;
const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export function aggregateMajorityTimePreference(
  values: (string | null | undefined)[],
): string | null {
  const minutes = values
    .map((value) => toMinutes(value))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  if (!minutes.length) return null;
  // Lower median on an even group: a minority with a later/earlier preference
  // cannot turn an ordinary preference into a unanimous hard constraint.
  return fromMinutes(minutes[Math.floor((minutes.length - 1) / 2)]!);
}

export function haversineDistanceKm(
  a: { latitude?: number | null | undefined; longitude?: number | null | undefined },
  b: { latitude?: number | null | undefined; longitude?: number | null | undefined },
): number | null {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null)
    return null;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function geographyPolicy(input: ActivityAiInput) {
  const profile = norm(
    [input.tripProfile, ...input.ambiances, ...(input.wantedEnvTypes ?? [])].join(" "),
  );
  if (/nature|sport|outdoor|aventure|montagne|lac/.test(profile))
    return { maxKm: 65, profile: "outdoor" as const };
  if (/maison|villa|chill|cocoon|logement/.test(profile))
    return { maxKm: 8, profile: "home" as const };
  return { maxKm: 25, profile: "city" as const };
}

function transferMinutes(distanceKm: number | null): number {
  if (distanceKm == null) return 20;
  if (distanceKm <= 2) return 15;
  if (distanceKm <= 8) return 30;
  if (distanceKm <= 20) return 45;
  return 75;
}

const weekdays: Record<string, number> = {
  dimanche: 0,
  sunday: 0,
  lundi: 1,
  monday: 1,
  mardi: 2,
  tuesday: 2,
  mercredi: 3,
  wednesday: 3,
  jeudi: 4,
  thursday: 4,
  vendredi: 5,
  friday: 5,
  samedi: 6,
  saturday: 6,
};
export function openingStatus(
  candidate: ActivityCandidate,
  date: string | null | undefined,
  time: string | null | undefined,
  durationMinutes = 90,
): "open" | "closed" | "unknown" {
  if (!candidate.openingHours.length || !date || toMinutes(time) == null) return "unknown";
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const line = candidate.openingHours.find((entry) =>
    Object.entries(weekdays).some(([name, day]) => day === weekday && norm(entry).includes(name)),
  );
  if (!line) return "unknown";
  if (/ferme|closed/.test(norm(line))) return "closed";
  const ranges = [
    ...line.matchAll(
      /([01]?\d|2[0-3])[:h]([0-5]\d)\s*(?:-|–|—|a|to)\s*([01]?\d|2[0-3])[:h]([0-5]\d)/gi,
    ),
  ];
  if (!ranges.length) return "unknown";
  const start = toMinutes(time)!;
  const end = start + durationMinutes;
  return ranges.some((range) => {
    const open = Number(range[1]) * 60 + Number(range[2]);
    let close = Number(range[3]) * 60 + Number(range[4]);
    if (close <= open) close += 1440;
    return start >= open && end <= close;
  })
    ? "open"
    : "closed";
}

export function calculatePlanningWindow(input: ActivityAiInput): {
  arrivalReady: string | null;
  latestDestinationDeparture: string | null;
} {
  const margin = Math.max(30, input.transferMarginMinutes ?? 75);
  const knownArrivals = (input.transportPicksSummary ?? [])
    .map((pick) => toMinutes(pick.arrival))
    .filter((v): v is number => v != null);
  const explicitArrival = toMinutes(input.latestGroupArrival);
  const outbound = toMinutes(input.earliestOutboundDeparture);
  const duration = Number(input.transportDurationHours);
  let arrival = knownArrivals.length ? Math.max(...knownArrivals) : explicitArrival;
  if (arrival == null && outbound != null && Number.isFinite(duration) && duration > 0)
    arrival = outbound + Math.round(duration * 60);

  const knownDepartures = (input.transportPicksSummary ?? [])
    .map((pick) => toMinutes(pick.departure))
    .filter((v): v is number => v != null);
  let destinationDeparture = knownDepartures.length
    ? Math.min(...knownDepartures)
    : toMinutes(input.earliestGroupDeparture);
  const returnHome = toMinutes(input.latestReturnHome);
  if (
    destinationDeparture == null &&
    returnHome != null &&
    Number.isFinite(duration) &&
    duration > 0
  )
    destinationDeparture = returnHome - Math.round(duration * 60) - margin;
  return {
    arrivalReady: arrival == null ? null : fromMinutes(arrival + margin),
    latestDestinationDeparture:
      destinationDeparture == null ? null : fromMinutes(destinationDeparture),
  };
}

function categoryFor(raw: any): ActivityCategory {
  const value = norm(`${raw.category} ${raw.type} ${raw.label}`);
  if (/sport|outdoor|kayak|randon|velo|canyon/.test(value)) return "sport_outdoor";
  if (/maison|logement|villa|barbecue|blind test|jeu/.test(value))
    return /jeu|blind/.test(value) ? "jeu_groupe" : "moment_maison";
  if (/surprise|anniversaire|evg|evjf|signature/.test(value)) return "evenement";
  if (/resto|repas|brunch|diner|déjeuner/.test(value)) return "repas";
  if (/bar|club|soir/.test(value)) return "soiree";
  if (/spa|detente|détente/.test(value)) return "detente";
  if (/transport|arrivee|arrivée|depart|départ/.test(value)) return "transport";
  if (/libre/.test(value)) return "temps_libre";
  return "culture";
}

function normalizeSlot(
  raw: any,
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): ActivitySlot | null {
  if (!raw || typeof raw !== "object" || !String(raw.label ?? "").trim()) return null;
  const candidate = candidates.find(
    (item) => item.id === raw.candidateId || norm(item.name) === norm(raw.label),
  );
  const requestedType = norm(raw.type);
  const type: ActivitySlotType = ["resto", "activite", "bar", "transport", "libre"].includes(
    requestedType,
  )
    ? (requestedType as ActivitySlotType)
    : "activite";
  const internal =
    raw.internal === true ||
    ["transport", "libre", "moment_maison", "jeu_groupe", "evenement", "temps_libre"].includes(
      String(raw.category),
    );
  if ((!candidate || candidate.verified !== true) && !internal) return null;
  const time =
    typeof raw.time === "string" && HHMM.test(raw.time.slice(0, 5)) ? raw.time.slice(0, 5) : null;
  const durationMinutes = Number.isFinite(Number(raw.durationMinutes))
    ? Math.max(15, Math.min(480, Number(raw.durationMinutes)))
    : (candidate?.durationMinutes ?? 90);
  return {
    moment: String(raw.moment ?? "Après-midi").slice(0, 24),
    type,
    category: categoryFor(raw),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 8) : candidate?.tags,
    label: String(raw.label).trim().slice(0, 100),
    detail: raw.detail ? String(raw.detail).slice(0, 220) : (candidate?.description ?? undefined),
    ...(candidate?.priceHint != null ? { priceHint: candidate.priceHint } : {}),
    time,
    endTime: time ? fromMinutes(toMinutes(time)! + durationMinutes) : null,
    durationMinutes,
    url: candidate ? candidate.sourceUrl : null,
    candidateId: candidate?.id ?? null,
    verified: candidate?.verified === true,
    source: candidate?.source ?? (internal ? "krew" : null),
    latitude: candidate?.latitude ?? null,
    longitude: candidate?.longitude ?? null,
  };
}

export function validateItinerary(
  days: ItineraryDayPlan[],
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): ItineraryDayPlan[] {
  const expectedDays = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);
  const arrival = toMinutes(window.arrivalReady);
  const departure = toMinutes(window.latestDestinationDeparture);
  let rejectedOpeningHours = 0;
  let rejectedGeography = 0;
  const result = days
    .filter((day) => day.day >= 1 && day.day <= expectedDays)
    .map((day) => {
      let previousEnd = -1;
      let previousExternal: ActivitySlot | null = null;
      const slots = day.slots
        .map((raw) => normalizeSlot(raw, input, candidates))
        .filter((slot): slot is ActivitySlot => Boolean(slot))
        .sort((a, b) => (toMinutes(a.time) ?? 9999) - (toMinutes(b.time) ?? 9999))
        .filter((slot) => {
          const start = toMinutes(slot.time);
          if (start == null) return slot.type === "transport" || slot.type === "libre";
          const end = start + (slot.durationMinutes ?? 90);
          if (day.day === 1 && arrival != null && start < arrival) return false;
          // Sans horaire de transport résolu, on ne prétend pas connaître une
          // arrivée : seule une soirée prudente est planifiable.
          if (day.day === 1 && arrival == null && start < 18 * 60) return false;
          if (day.day === expectedDays && departure != null && end > departure) return false;
          // Même prudence au retour : matinée courte uniquement tant que le trajet
          // retenu ne fournit pas une heure de départ calculable.
          if (day.day === expectedDays && departure == null && end > 12 * 60) return false;
          const candidate = slot.candidateId
            ? candidates.find((item) => item.id === slot.candidateId)
            : undefined;
          if (candidate) {
            const status = openingStatus(
              candidate,
              input.startDate ? addDays(input.startDate, day.day - 1) : day.date,
              slot.time,
              slot.durationMinutes ?? 90,
            );
            slot.openingHoursVerified = status === "open";
            if (status === "closed") {
              rejectedOpeningHours++;
              return false;
            }
            if (status === "unknown")
              slot.detail = [slot.detail, "Horaires d’ouverture non confirmés pour ce créneau."]
                .filter(Boolean)
                .join(" ");
          }
          const distance = previousExternal ? haversineDistanceKm(previousExternal, slot) : null;
          const policy = geographyPolicy(input);
          const outdoorJustified =
            policy.profile === "outdoor" &&
            (slot.category === "sport_outdoor" || previousExternal?.category === "sport_outdoor");
          if (distance != null && distance > policy.maxKm && !outdoorJustified) {
            rejectedGeography++;
            return false;
          }
          if (start < previousEnd + (previousEnd >= 0 ? transferMinutes(distance) : 0)) {
            if (distance != null) rejectedGeography++;
            return false;
          }
          previousEnd = end;
          if (candidate) previousExternal = slot;
          return !slot.url || isSafeActivityUrl(slot.url);
        });
      return {
        day: day.day,
        date: input.startDate ? addDays(input.startDate, day.day - 1) : null,
        slots,
      };
    });
  console.info("activity-validation", {
    rejectedOpeningHours,
    rejectedGeography,
    dayCount: result.length,
    profile: geographyPolicy(input).profile,
  });
  return result;
}

function isHomeProfile(input: ActivityAiInput) {
  return /maison|villa|chill|cocoon|logement/.test(
    norm(
      [
        input.tripProfile,
        input.travelPace,
        ...input.ambiances,
        ...(input.wantedEnvTypes ?? []),
      ].join(" "),
    ),
  );
}
function eventMoment(input: ActivityAiInput): ActivitySlot | null {
  const event = norm(input.eventType);
  if (/evg|evjf/.test(event))
    return {
      moment: "Soir",
      time: "22:30",
      endTime: "00:00",
      durationMinutes: 90,
      type: "libre",
      category: "jeu_groupe",
      label: event === "evjf" ? "Jeu de la mariée" : "Défis du marié",
      detail: "Moment KREW au logement, préparé par le groupe",
      verified: false,
      source: "krew",
      url: null,
    };
  if (event === "anniversaire")
    return {
      moment: "Soir",
      time: "22:30",
      endTime: "00:00",
      durationMinutes: 90,
      type: "libre",
      category: "evenement",
      label: "Surprise anniversaire",
      detail: "Moment fort organisé par le groupe",
      verified: false,
      source: "krew",
      url: null,
    };
  return null;
}

export function buildLocalItinerary(
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
): GroupItinerary {
  const count = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);
  const home = isHomeProfile(input);
  let ci = 0;
  const days: ItineraryDayPlan[] = [];
  for (let day = 1; day <= count; day++) {
    const slots: ActivitySlot[] = [];
    const arrival = day === 1 ? toMinutes(window.arrivalReady) : null;
    const departure = day === count ? toMinutes(window.latestDestinationDeparture) : null;
    const addInternal = (
      time: string,
      label: string,
      category: ActivityCategory,
      durationMinutes = 90,
    ) =>
      slots.push({
        moment: time < "12:00" ? "Matin" : time < "18:00" ? "Après-midi" : "Soir",
        time,
        endTime: fromMinutes(toMinutes(time)! + durationMinutes),
        durationMinutes,
        type: category === "repas" ? "resto" : "libre",
        category,
        label,
        verified: false,
        source: "krew",
        url: null,
      });
    if (day === 1 && window.arrivalReady)
      slots.push({
        moment: "Arrivée",
        type: "transport",
        category: "transport",
        label: `Arrivée et installation à ${input.destination}`,
        time: window.arrivalReady,
        durationMinutes: 45,
        endTime: fromMinutes(toMinutes(window.arrivalReady)! + 45),
        verified: true,
        source: "transport",
        url: null,
      });
    if (home) {
      const start =
        arrival != null ? Math.max(arrival + 45, 12 * 60) : day === 1 ? 18 * 60 : 10 * 60;
      if (departure == null || start + 90 <= departure)
        addInternal(
          fromMinutes(start),
          day === 1 ? "Apéro et installation au logement" : "Brunch maison et détente",
          day === 1 ? "moment_maison" : "repas",
        );
      if (day > 1 && day < count)
        addInternal("16:00", "Jeux, piscine ou temps libre au logement", "moment_maison", 120);
    } else {
      const desiredStarts =
        day === 1
          ? [13 * 60, 15 * 60 + 30, 20 * 60]
          : day === count
            ? [10 * 60, 12 * 60 + 30]
            : [10 * 60, 14 * 60 + 30, 20 * 60];
      for (const desired of desiredStarts) {
        const start =
          arrival == null && day === 1
            ? Math.max(desired, 18 * 60)
            : Math.max(desired, arrival ?? 0);
        const candidate = candidates[ci++ % Math.max(1, candidates.length)];
        if (departure != null && start + 90 > departure) continue;
        if (candidate)
          slots.push({
            moment: start < 12 * 60 ? "Matin" : start < 18 * 60 ? "Après-midi" : "Soir",
            time: fromMinutes(start),
            endTime: fromMinutes(start + (candidate.durationMinutes ?? 90)),
            durationMinutes: candidate.durationMinutes ?? 90,
            type: /restaurant|brunch|gastronomie/.test(norm(candidate.category))
              ? "resto"
              : /bar|club/.test(norm(candidate.category))
                ? "bar"
                : "activite",
            category: categoryFor(candidate),
            label: candidate.name,
            detail: candidate.description ?? undefined,
            ...(candidate.priceHint != null ? { priceHint: candidate.priceHint } : {}),
            url: candidate.sourceUrl,
            candidateId: candidate.id,
            verified: candidate.verified === true,
            source: candidate.source,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
          });
        else addInternal(fromMinutes(start), "Temps libre au logement", "temps_libre", 90);
      }
    }
    if (day === Math.min(2, count) && eventMoment(input)) slots.push(eventMoment(input)!);
    days.push({ day, date: input.startDate ? addDays(input.startDate, day - 1) : null, slots });
  }
  return {
    destination: input.destination,
    nights: input.nights,
    days: validateItinerary(days, input, candidates),
    source: "local",
    provider: "local",
    generatedAt: new Date().toISOString(),
  };
}

function parseJson(raw: string): any {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
async function geminiCompose(
  input: ActivityAiInput,
  candidates: ActivityCandidate[],
  existing?: { slot: ActivitySlot; day: number; avoid: string[] },
): Promise<any> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("no_gemini_key");
  const window = calculatePlanningWindow(input);
  const task = existing
    ? `Propose un seul slot JSON sous la clé slot pour le jour ${existing.day}, à la même heure que ${existing.slot.time ?? "le créneau"}, différent de ${existing.avoid.join(", ")}.`
    : `Compose exactement ${input.nights + 1} jours sous {"days":[{"day":1,"slots":[]}]}.`;
  const prompt = `Tu composes un planning KREW en français APRES discovery. ${task}\nContexte=${JSON.stringify({ destination: input.destination, dates: [input.startDate, input.endDate], profile: input.tripProfile, event: input.eventType, participants: input.participants, age: input.groupAgeRange, budget: input.budgetPerPerson, pace: input.travelPace, majorityPreferences: { ambiances: input.ambiances, activities: input.activityCategories }, individuals: input.individualPreferences, star: input.starWanted, diet: input.dietaryConstraints, arrivalReady: window.arrivalReady, latestDestinationDeparture: window.latestDestinationDeparture, transports: input.transportPicksSummary })}\nShortlist vérifiée=${JSON.stringify(candidates)}\nChaque lieu externe doit reprendre candidateId, nom et URL de cette shortlist; aucun autre établissement. Les moments internes (maison, jeu, surprise, libre) ont internal=true, aucune URL, category moment_maison|jeu_groupe|evenement|temps_libre. Champs slot: moment,time HH:mm,type resto|activite|bar|transport|libre,category,label,detail,durationMinutes,candidateId|null,internal. Profil = ligne éditoriale forte; majorité principale; Star surpondérée. EVG/EVJF/anniversaire: moment fort si faisable. Cohérence géographique et marges. JSON seul.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
      }),
    },
  );
  const text = await response.text();
  if (!response.ok)
    throw new Error(`gemini_composition_http_${response.status}:${text.slice(0, 160)}`);
  const payload = JSON.parse(text);
  return parseJson(
    (payload?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""),
  );
}
export async function generateItineraryWithAi(
  input: ActivityAiInput,
  seedLabels: string[] = [],
): Promise<{ itinerary: GroupItinerary; usedLlm: boolean; error?: string }> {
  const discovery = await discoverActivities({
    destination: input.destination,
    country: input.country,
    startDate: input.startDate,
    eventType: input.eventType,
    tripProfile: input.tripProfile,
    ambiances: input.ambiances,
    activityCategories: [...input.activityCategories, ...seedLabels],
    starWanted: input.starWanted,
    individualPreferences: input.individualPreferences,
    budgetPerPerson: input.budgetPerPerson,
    travelPace: input.travelPace,
    forceRefresh: input.forceDiscoveryRefresh,
  });
  const candidates = discovery.candidates;
  console.info("activity-composition", {
    candidateCount: candidates.length,
    shortlistedCount: candidates.length,
    destination: input.destination,
    fallback: false,
  });
  // Discovery is the generation's single grounded Gemini call. Composition is
  // deterministic and only references that verified shortlist.
  const itinerary = buildLocalItinerary(input, candidates);
  itinerary.discovery = {
    candidateCount: candidates.length,
    shortlistedCount: candidates.length,
    cached: discovery.cached,
    verifiedAt: candidates[0]?.verifiedAt ?? null,
  };
  return {
    itinerary,
    usedLlm: candidates.length > 0,
    ...(discovery.error ? { error: discovery.error } : {}),
  };
}

export async function regenerateSlotWithAi(
  input: ActivityAiInput,
  existing: ActivitySlot,
  day: number,
  avoid: string[] = [],
): Promise<{ slot: ActivitySlot; usedLlm: boolean; error?: string }> {
  const discovery = await discoverActivities({
    destination: input.destination,
    country: input.country,
    startDate: input.startDate,
    eventType: input.eventType,
    tripProfile: input.tripProfile,
    ambiances: input.ambiances,
    activityCategories: input.activityCategories,
    starWanted: input.starWanted,
    individualPreferences: input.individualPreferences,
    budgetPerPerson: input.budgetPerPerson,
    travelPace: input.travelPace,
  });
  try {
    const parsed = await geminiCompose(input, discovery.candidates, { slot: existing, day, avoid });
    const slot = normalizeSlot(parsed?.slot, input, discovery.candidates);
    if (slot) {
      const valid = validateItinerary([{ day, slots: [slot] }], input, discovery.candidates)[0]
        ?.slots[0];
      if (valid) return { slot: valid, usedLlm: true };
    }
  } catch (error) {
    reportServerError(error, {
      provider: "gemini",
      model: GEMINI_MODEL,
      kind: "activity-slot",
      fallback: "local",
      candidateCount: discovery.candidates.length,
      destination: input.destination,
    });
  }
  const alternative = discovery.candidates.find(
    (candidate) => !avoid.some((label) => norm(label) === norm(candidate.name)),
  );
  if (alternative)
    return {
      slot: normalizeSlot(
        {
          ...existing,
          label: alternative.name,
          candidateId: alternative.id,
          category: alternative.category,
        },
        input,
        discovery.candidates,
      )!,
      usedLlm: false,
      error: "gemini_slot_fallback",
    };
  return {
    slot: {
      ...existing,
      type: "libre",
      category: "temps_libre",
      label: "Temps libre",
      detail: "Aucun prestataire vérifié disponible pour ce créneau",
      url: null,
      candidateId: null,
      verified: false,
      source: "krew",
    },
    usedLlm: false,
    error: "no_verified_candidate",
  };
}
