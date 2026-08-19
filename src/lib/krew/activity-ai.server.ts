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
  venueFamily?: string | undefined;
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
export type SkeletonSlotKind = "internal" | "place_required";

export type KrewSkeletonSlot = {
  id: string;
  day: number;
  moment: "Matin" | "Midi" | "Après-midi" | "Soir";
  time: string;
  endTime: string;
  durationMinutes: number;
  kind: SkeletonSlotKind;
  type: ActivitySlotType;
  category: ActivityCategory;
  label: string;
  detail?: string | undefined;
  importance: "high" | "medium" | "low";
  flexibility: "rigid" | "flexible";
  venueFamily?: string | undefined;
  searchIntent?: string | undefined;
  candidateId?: string | null | undefined;
  url?: string | null | undefined;
  verified?: boolean | undefined;
  source?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
};

export type KrewSkeletonDay = {
  day: number;
  date?: string | null | undefined;
  slots: KrewSkeletonSlot[];
};

export type KrewSkeleton = {
  destination: string;
  nights: number;
  days: KrewSkeletonDay[];
};

export type GroupItinerary = {
  destination: string;
  nights: number;
  days: ItineraryDayPlan[];
  source: "ai" | "local";
  provider?: "gemini" | "aimlapi" | "local" | "krew_geoapify";
  generatedAt: string;
  discovery?: {
    candidateCount: number;
    shortlistedCount: number;
    cached: boolean;
    verifiedAt: string | null;
  };
  candidates?: ActivityCandidate[];
  placePools?: Record<string, any[]> | undefined;
  usedCandidateIds?: string[] | undefined;
  skeleton?: KrewSkeleton | undefined;
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
  groupAccommodationRole?: string | null;
  starWantedEnvType?: string | null;
  wantedEnvTypes?: string[];
  forceDiscoveryRefresh?: boolean;
};

const GEMINI_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
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

export function transferMinutes(distanceKm: number | null): number {
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

export function adjustItineraryTransferTimes(
  days: ItineraryDayPlan[],
  input: ActivityAiInput,
): ItineraryDayPlan[] {
  const expectedDays = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);
  const arrival = toMinutes(window.arrivalReady);
  const departure = toMinutes(window.latestDestinationDeparture);

  return days
    .filter((day) => day.day >= 1 && day.day <= expectedDays)
    .map((day) => {
      let previousEnd = -1;
      let previousCoords: { latitude?: number | null; longitude?: number | null } | null = null;

      const slots: ActivitySlot[] = [];

      for (const slot of day.slots) {
        let start = toMinutes(slot.time);
        if (start == null) {
          slots.push(slot);
          continue;
        }

        const duration = slot.durationMinutes ?? 90;

        // Calculate transfer time if both previous and current location have valid coordinates
        const hasCoords =
          previousCoords?.latitude != null &&
          previousCoords?.longitude != null &&
          slot.latitude != null &&
          slot.longitude != null;
        const distance = hasCoords ? haversineDistanceKm(previousCoords, slot) : null;
        const requiredTransfer = previousEnd >= 0 && distance != null ? transferMinutes(distance) : 0;
        const minStart = previousEnd >= 0 ? previousEnd + requiredTransfer : start;

        if (start < minStart) {
          start = minStart;
        }

        const end = start + duration;

        // Hard arrival boundary on day 1
        if (day.day === 1 && arrival != null && start < arrival) continue;
        if (day.day === 1 && arrival == null && start < 18 * 60) continue;

        // Hard departure boundary on last day
        if (day.day === expectedDays && departure != null && end > departure) continue;
        if (day.day === expectedDays && departure == null && end > 12 * 60) continue;

        const updatedSlot: ActivitySlot = {
          ...slot,
          time: fromMinutes(start),
          endTime: fromMinutes(end),
          durationMinutes: duration,
        };

        previousEnd = end;
        if (slot.latitude != null && slot.longitude != null) {
          previousCoords = { latitude: slot.latitude, longitude: slot.longitude };
        }

        slots.push(updatedSlot);
      }

      return {
        ...day,
        slots,
      };
    });
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

export function buildKrewSkeleton(input: ActivityAiInput): KrewSkeleton {
  const count = Math.max(1, input.nights + 1);
  const window = calculatePlanningWindow(input);
  const arrivalMinutes = toMinutes(window.arrivalReady);
  const departureMinutes = toMinutes(window.latestDestinationDeparture);

  const paceRaw = norm(input.travelPace);
  const pace = paceRaw.includes("leger") || paceRaw.includes("relax") || paceRaw.includes("tranquille")
    ? "leger"
    : paceRaw.includes("intense") || paceRaw.includes("charge")
      ? "intense"
      : "equilibre";

  const lodgRole = input.groupAccommodationRole ?? (
    /centerpiece|coeur|destination/.test(norm(input.tripProfile))
      ? "centerpiece"
      : /part_of_stay|partie/.test(norm(input.tripProfile))
        ? "part_of_stay"
        : isHomeProfile(input)
          ? "part_of_stay"
          : "base_only"
  );

  const isCenterpiece = lodgRole === "centerpiece";
  const isPartOfStay = lodgRole === "part_of_stay";

  const timeSlotPrefs = (input.preferredTimeSlots ?? []).map(norm);
  const wantsLateMorning = timeSlotPrefs.some((s) => s.includes("matin_tard") || s.includes("grasse") || s === "matin_tardif");
  const wantsLateNight = timeSlotPrefs.some((s) => s.includes("tard_soir") || s.includes("nuit") || s.includes("soiree_tardive"));

  const categoriesNorm = (input.activityCategories ?? []).map(norm);
  const starNorm = (input.starWanted ?? []).map(norm);
  const ambiancesNorm = (input.ambiances ?? []).map(norm);
  const combinedSignal = [...categoriesNorm, ...starNorm, ...ambiancesNorm].join(" ");

  const wantsOutdoor = /sport|outdoor|nature|montagne|rando|kayak|velo|aventure/.test(combinedSignal) &&
    !/refus|interdit|non/.test(combinedSignal);
  const wantsCulture = /culture|musee|visite|patrimoine|decouverte|histoire/.test(combinedSignal);
  const wantsRelax = /detente|spa|bien_etre|plage|chill|relax/.test(combinedSignal);
  const wantsNightlife = /soiree|bar|fete|club|pub|nightlife/.test(combinedSignal);
  const wantsGastro = /gastronomie|terroir|resto|degustation|vin/.test(combinedSignal);

  let slotIdCounter = 1;
  const nextSlotId = () => `slot_${slotIdCounter++}`;

  const days: KrewSkeletonDay[] = [];

  for (let day = 1; day <= count; day++) {
    const slots: KrewSkeletonSlot[] = [];

    const dateStr = input.startDate ? addDays(input.startDate, day - 1) : null;
    const isFirstDay = day === 1;
    const isLastDay = day === count;

    const dayStartLimit = isFirstDay
      ? arrivalMinutes != null
        ? arrivalMinutes
        : 18 * 60
      : 8 * 60;

    const dayEndLimit = isLastDay
      ? departureMinutes != null
        ? departureMinutes
        : 12 * 60
      : 23 * 60 + 59;

    const addSlotIfValid = (slot: Omit<KrewSkeletonSlot, "id" | "day">) => {
      const start = toMinutes(slot.time);
      if (start == null) return;
      const end = start + slot.durationMinutes;

      if (isFirstDay && start < dayStartLimit) return;
      if (isLastDay && end > dayEndLimit) return;

      slots.push({
        id: nextSlotId(),
        day,
        ...slot,
      });
    };

    if (isFirstDay && window.arrivalReady) {
      const arrMin = toMinutes(window.arrivalReady)!;
      addSlotIfValid({
        moment: arrMin < 12 * 60 ? "Matin" : arrMin < 18 * 60 ? "Après-midi" : "Soir",
        time: window.arrivalReady,
        endTime: fromMinutes(arrMin + 45),
        durationMinutes: 45,
        kind: "internal",
        type: "transport",
        category: "transport",
        label: `Arrivée et installation à ${input.destination}`,
        detail: "Accueil, installation au logement et prise de repères",
        importance: "high",
        flexibility: "rigid",
      });
    }

    if (!isFirstDay) {
      const bTime = (isCenterpiece || isPartOfStay || wantsLateMorning) ? "09:30" : "08:30";
      const bMin = toMinutes(bTime)!;
      if (bMin >= dayStartLimit && bMin + 60 <= dayEndLimit) {
        if (isCenterpiece || (isPartOfStay && day % 2 === 0)) {
          addSlotIfValid({
            moment: "Matin",
            time: bTime,
            endTime: fromMinutes(bMin + 75),
            durationMinutes: 75,
            kind: "internal",
            type: "resto",
            category: "repas",
            label: "Brunch et détente au logement",
            detail: "Petit-déjeuner/brunch convivial entre vous au logement",
            importance: "medium",
            flexibility: "flexible",
          });
        } else {
          addSlotIfValid({
            moment: "Matin",
            time: bTime,
            endTime: fromMinutes(bMin + 45),
            durationMinutes: 45,
            kind: "place_required",
            type: "resto",
            category: "repas",
            label: "Petit-déjeuner local",
            detail: "Café et viennoiseries pour bien démarrer la journée",
            importance: "medium",
            flexibility: "flexible",
            venueFamily: "cafe",
            searchIntent: `café petit-déjeuner convivial à ${input.destination}`,
          });
        }
      }
    }

    if (!isFirstDay && pace !== "leger") {
      const mTime = wantsLateMorning ? "11:00" : "10:30";
      const mMin = toMinutes(mTime)!;
      if (mMin >= dayStartLimit && mMin + 90 <= dayEndLimit) {
        if (wantsOutdoor && day % 2 === 1) {
          addSlotIfValid({
            moment: "Matin",
            time: mTime,
            endTime: fromMinutes(mMin + 120),
            durationMinutes: 120,
            kind: "place_required",
            type: "activite",
            category: "sport_outdoor",
            label: "Activité plein air & découverte",
            detail: "Session sportive ou exploration nature adaptée au groupe",
            importance: "high",
            flexibility: "flexible",
            venueFamily: "sport",
            searchIntent: `activité outdoor nature groupe à ${input.destination}`,
          });
        } else if (wantsCulture || (!wantsOutdoor && !isCenterpiece)) {
          addSlotIfValid({
            moment: "Matin",
            time: mTime,
            endTime: fromMinutes(mMin + 90),
            durationMinutes: 90,
            kind: "place_required",
            type: "activite",
            category: "culture",
            label: "Visite & découverte culturelle",
            detail: "Exploration du quartier historique ou monument emblématique",
            importance: "medium",
            flexibility: "flexible",
            venueFamily: "culture",
            searchIntent: `visite culturelle incontournable à ${input.destination}`,
          });
        } else if (isCenterpiece) {
          addSlotIfValid({
            moment: "Matin",
            time: mTime,
            endTime: fromMinutes(mMin + 90),
            durationMinutes: 90,
            kind: "internal",
            type: "libre",
            category: "moment_maison",
            label: "Matinée détente au logement",
            detail: "Jeux de société, détente ou temps calme entre vous",
            importance: "low",
            flexibility: "flexible",
          });
        }
      }
    }

    const lTime = isFirstDay ? (arrivalMinutes ? fromMinutes(Math.max(arrivalMinutes + 45, 12 * 60 + 30)) : "13:00") : "12:30";
    const lMin = toMinutes(lTime)!;
    if (lMin >= dayStartLimit && lMin + 90 <= dayEndLimit && lMin < 15 * 60) {
      if (isCenterpiece && day % 2 === 0) {
        addSlotIfValid({
          moment: "Midi",
          time: lTime,
          endTime: fromMinutes(lMin + 90),
          durationMinutes: 90,
          kind: "internal",
          type: "resto",
          category: "repas",
          label: "Déjeuner convivial au logement",
          detail: "Repas partagé ou buffet convivial au logement",
          importance: "medium",
          flexibility: "flexible",
        });
      } else {
        addSlotIfValid({
          moment: "Midi",
          time: lTime,
          endTime: fromMinutes(lMin + 90),
          durationMinutes: 90,
          kind: "place_required",
          type: "resto",
          category: "repas",
          label: "Déjeuner au restaurant",
          detail: wantsGastro
            ? "Restaurant spécialités locales et produits de saison"
            : "Déjeuner sympa au restaurant ou lieu typique",
          importance: "high",
          flexibility: "flexible",
          venueFamily: "restaurant",
          searchIntent: `restaurant déjeuner convivial groupe à ${input.destination}`,
        });
      }
    }

    const aTime = "15:00";
    const aMin = toMinutes(aTime)!;
    if (aMin >= dayStartLimit && aMin + 120 <= dayEndLimit) {
      if (pace === "intense" && !isCenterpiece && day % 2 === 0) {
        const intenseCat = wantsOutdoor ? "sport_outdoor" : wantsCulture ? "culture" : wantsGastro ? "repas" : "culture";
        const intenseFamily = wantsOutdoor ? "sport" : wantsCulture ? "culture" : wantsGastro ? "restaurant" : "tourism";
        addSlotIfValid({
          moment: "Après-midi",
          time: "14:00",
          endTime: "16:00",
          durationMinutes: 120,
          kind: "place_required",
          type: "activite",
          category: intenseCat,
          label: wantsOutdoor ? "Activité aventure outdoor" : "Activité découverte locale",
          detail: "Expérience dynamique adaptée aux préférences du groupe",
          importance: "high",
          flexibility: "flexible",
          venueFamily: intenseFamily,
          searchIntent: `activité ${intenseCat} groupe à ${input.destination}`,
        });
        addSlotIfValid({
          moment: "Après-midi",
          time: "16:30",
          endTime: "18:00",
          durationMinutes: 90,
          kind: "place_required",
          type: "activite",
          category: wantsRelax ? "detente" : "culture",
          label: "Seconde activité de l'après-midi",
          detail: "Visite ou expérience complémentaire",
          importance: "medium",
          flexibility: "flexible",
          venueFamily: wantsRelax ? "relaxation" : "tourism",
          searchIntent: `expérience culturelle ou détente courte à ${input.destination}`,
        });
      } else if (wantsOutdoor && (day === 1 || !isCenterpiece)) {
        addSlotIfValid({
          moment: "Après-midi",
          time: aTime,
          endTime: fromMinutes(aMin + 120),
          durationMinutes: 120,
          kind: "place_required",
          type: "activite",
          category: "sport_outdoor",
          label: "Grande activité outdoor & aventure",
          detail: "Randonnée, vélo, activités nautiques ou aventure selon la saison",
          importance: "high",
          flexibility: "flexible",
          venueFamily: "sport",
          searchIntent: `activité sportive ou outdoor groupe à ${input.destination}`,
        });
      } else if (wantsRelax) {
        addSlotIfValid({
          moment: "Après-midi",
          time: aTime,
          endTime: fromMinutes(aMin + 120),
          durationMinutes: 120,
          kind: "place_required",
          type: "activite",
          category: "detente",
          label: "Moment détente & spa",
          detail: "Espace bien-être, massage ou baignade relaxante",
          importance: "medium",
          flexibility: "flexible",
          venueFamily: "relaxation",
          searchIntent: `spa détente espace bien être groupe à ${input.destination}`,
        });
      } else if (isCenterpiece) {
        addSlotIfValid({
          moment: "Après-midi",
          time: aTime,
          endTime: fromMinutes(aMin + 120),
          durationMinutes: 120,
          kind: "internal",
          type: "libre",
          category: "moment_maison",
          label: "Après-midi cocooning & activités au logement",
          detail: "Jeux collectifs, détente ou repos selon les envies",
          importance: "high",
          flexibility: "flexible",
        });
      } else {
        addSlotIfValid({
          moment: "Après-midi",
          time: aTime,
          endTime: fromMinutes(aMin + 120),
          durationMinutes: 120,
          kind: "place_required",
          type: "activite",
          category: "culture",
          label: "Activité phare & découverte locale",
          detail: "Expérience immersive caractéristique de la région",
          importance: "high",
          flexibility: "flexible",
          venueFamily: "tourism",
          searchIntent: `expérience découverte incontournable à ${input.destination}`,
        });
      }
    }

    const apTime = "18:30";
    const apMin = toMinutes(apTime)!;
    if (apMin >= dayStartLimit && apMin + 60 <= dayEndLimit) {
      if (isCenterpiece || isPartOfStay) {
        addSlotIfValid({
          moment: "Soir",
          time: apTime,
          endTime: fromMinutes(apMin + 75),
          durationMinutes: 75,
          kind: "internal",
          type: "libre",
          category: "moment_maison",
          label: "Apéro & préparatifs au logement",
          detail: "Apéritif convivial, cocktails et préparatifs pour la soirée",
          importance: "medium",
          flexibility: "flexible",
        });
      } else {
        addSlotIfValid({
          moment: "Soir",
          time: apTime,
          endTime: fromMinutes(apMin + 60),
          durationMinutes: 60,
          kind: "place_required",
          type: "bar",
          category: "soiree",
          label: "Apéro au bar local",
          detail: "Cocktails, bières locales et ambiance chaleureuse",
          importance: "medium",
          flexibility: "flexible",
          venueFamily: "bar",
          searchIntent: `bar apéro ambiance convivial à ${input.destination}`,
        });
      }
    }

    const dTime = wantsLateNight ? "20:30" : "20:00";
    const dMin = toMinutes(dTime)!;
    if (dMin >= dayStartLimit && dMin + 120 <= dayEndLimit) {
      addSlotIfValid({
        moment: "Soir",
        time: dTime,
        endTime: fromMinutes(dMin + 120),
        durationMinutes: 120,
        kind: "place_required",
        type: "resto",
        category: "repas",
        label: "Grand dîner de groupe",
        detail: wantsGastro
          ? "Table gastronomique ou restaurant de spécialités régionales"
          : "Dîner festif et convivial adapté à un groupe",
        importance: "high",
        flexibility: "flexible",
        venueFamily: "restaurant",
        searchIntent: `restaurant dîner groupe ambiance à ${input.destination}`,
      });
    }

    const evtTime = "22:15";
    const evtMin = toMinutes(evtTime)!;
    if (evtMin >= dayStartLimit && evtMin + 90 <= dayEndLimit) {
      const eventTypeNorm = norm(input.eventType);
      if (/evg|evjf/.test(eventTypeNorm) && day === Math.min(2, count)) {
        addSlotIfValid({
          moment: "Soir",
          time: evtTime,
          endTime: fromMinutes(evtMin + 90),
          durationMinutes: 90,
          kind: "internal",
          type: "libre",
          category: "jeu_groupe",
          label: eventTypeNorm === "evjf" ? "Grand Jeu de la mariée (EVJF)" : "Défis & Rituals du marié (EVG)",
          detail: "Animation sur-mesure préparée par le groupe au logement",
          importance: "high",
          flexibility: "flexible",
        });
      } else if (eventTypeNorm === "anniversaire" && day === Math.min(2, count)) {
        addSlotIfValid({
          moment: "Soir",
          time: evtTime,
          endTime: fromMinutes(evtMin + 90),
          durationMinutes: 90,
          kind: "internal",
          type: "libre",
          category: "evenement",
          label: "Surprise Anniversaire & Célébration",
          detail: "Moment fort, gâteau, cadeaux et jeux organisés par le groupe",
          importance: "high",
          flexibility: "flexible",
        });
      } else if (wantsNightlife && !isLastDay) {
        addSlotIfValid({
          moment: "Soir",
          time: evtTime,
          endTime: fromMinutes(evtMin + 105),
          durationMinutes: 105,
          kind: "place_required",
          type: "bar",
          category: "soiree",
          label: "Soirée festive, bar & clubbing",
          detail: "Bar musical, pub ou club pour prolonger la nuit",
          importance: "medium",
          flexibility: "flexible",
          venueFamily: "nightlife",
          searchIntent: `bar fete club nocturne groupe à ${input.destination}`,
        });
      }
    }

    days.push({
      day,
      date: dateStr,
      slots,
    });
  }

  return {
    destination: input.destination,
    nights: input.nights,
    days,
  };
}

export async function geminiEnrichSkeleton(
  skeleton: KrewSkeleton,
  input: ActivityAiInput,
): Promise<{ enrichedSkeleton: KrewSkeleton; usedLlm: boolean; error?: string }> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    return { enrichedSkeleton: skeleton, usedLlm: false, error: "no_gemini_key" };
  }

  const window = calculatePlanningWindow(input);

  const brief = {
    destination: input.destination,
    country: input.country ?? null,
    eventType: input.eventType ?? null,
    tripProfile: input.tripProfile ?? null,
    participants: input.participants,
    groupAgeRange: input.groupAgeRange ?? null,
    travelPace: input.travelPace ?? null,
    ambiances: input.ambiances ?? [],
    activityCategories: input.activityCategories ?? [],
    starWanted: input.starWanted ?? [],
    dietaryConstraints: input.dietaryConstraints ?? [],
    arrivalReady: window.arrivalReady,
    latestDestinationDeparture: window.latestDestinationDeparture,
    skeletonDays: skeleton.days.map((day) => ({
      day: day.day,
      slots: day.slots.map((s) => ({
        id: s.id,
        kind: s.kind,
        moment: s.moment,
        time: s.time,
        type: s.type,
        category: s.category,
        label: s.label,
        detail: s.detail ?? null,
        venueFamily: s.venueFamily ?? null,
        searchIntent: s.searchIntent ?? null,
      })),
    })),
  };

  const prompt = `Tu es l'intelligence créative de KREW pour enrichir un planning skeleton déterministe.
CONSIGNE STRICTE :
1. Pour les créneaux kind="internal" (jeux, apéro, moments maison, surprise) : propose des intitulés créatifs (label) et un descriptif captivant (detail) adapté à l'événement (${input.eventType || "séjour"}), à la Star et au groupe.
2. Pour les créneaux kind="place_required" (repas, restaurants, bars, activités externes, sport, visites) : précise le type d'expérience recherché sous venueFamily et une phrase d'intention de recherche sous searchIntent.
3. INTERDICTION ABSOLUE :
   - Ne fournit AUCUN nom d'établissement réel, d'entreprise ou de marque.
   - Ne fournit AUCUNE adresse, URL, prix, note ou horaire d'ouverture.
   - Ne modifie PAS les créneaux temporels (time, endTime, durationMinutes), ni les jours, ni le nombre de créneaux.
Retourne STRICTEMENT du JSON au format : {"enrichedSlots":[{"id":"slot_1","label":"...","detail":"...","venueFamily":"...","searchIntent":"..."}]}

Brief du séjour = ${JSON.stringify(brief)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      },
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`gemini_enrich_http_${response.status}:${text.slice(0, 160)}`);
    }

    const payload = JSON.parse(text);
    const parsed = parseJson(
      (payload?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join(""),
    );

    const enrichedSlotsMap = new Map<string, any>();
    if (Array.isArray(parsed?.enrichedSlots)) {
      for (const item of parsed.enrichedSlots) {
        if (item && typeof item.id === "string") {
          enrichedSlotsMap.set(item.id, item);
        }
      }
    }

    const enrichedDays: KrewSkeletonDay[] = skeleton.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => {
        const enriched = enrichedSlotsMap.get(slot.id);
        if (!enriched) return slot;

        if (slot.kind === "internal") {
          return {
            ...slot,
            label: typeof enriched.label === "string" && enriched.label.trim()
              ? enriched.label.trim().slice(0, 100)
              : slot.label,
            detail: typeof enriched.detail === "string" && enriched.detail.trim()
              ? enriched.detail.trim().slice(0, 220)
              : slot.detail,
          };
        }

        return {
          ...slot,
          venueFamily: typeof enriched.venueFamily === "string" && enriched.venueFamily.trim()
            ? enriched.venueFamily.trim()
            : slot.venueFamily,
          searchIntent: typeof enriched.searchIntent === "string" && enriched.searchIntent.trim()
            ? enriched.searchIntent.trim().slice(0, 200)
            : slot.searchIntent,
          detail: typeof enriched.detail === "string" && enriched.detail.trim()
            ? enriched.detail.trim().slice(0, 220)
            : slot.detail,
        };
      }),
    }));

    return {
      enrichedSkeleton: {
        ...skeleton,
        days: enrichedDays,
      },
      usedLlm: true,
    };
  } catch (error) {
    reportServerError(error, {
      provider: "gemini",
      model: GEMINI_MODEL,
      kind: "activity-skeleton-enrichment",
      fallback: "skeleton_local",
      destination: input.destination,
    });
    return {
      enrichedSkeleton: skeleton,
      usedLlm: false,
      error: String(error).slice(0, 180),
    };
  }
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
        addInternal("16:00", "Jeux collectifs ou temps libre au logement", "moment_maison", 120);
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
    endDate: input.endDate,
    nights: input.nights,
    participants: input.participants,
    groupAgeRange: input.groupAgeRange,
    dietaryConstraints: input.dietaryConstraints,
    preferredTimeSlots: input.preferredTimeSlots,
    wantedEnvTypes: input.wantedEnvTypes,
    starWantedEnvType: input.starWantedEnvType,
    matchReasons: input.matchReasons,
    arrivalReady: calculatePlanningWindow(input).arrivalReady,
    latestDestinationDeparture: calculatePlanningWindow(input).latestDestinationDeparture,
    latestReturnHome: input.latestReturnHome,
    transportPicksSummary: input.transportPicksSummary,
  });
  const candidates = discovery.candidates;
  console.info("activity-composition", {
    candidateCount: candidates.length,
    shortlistedCount: candidates.length,
    destination: input.destination,
    fallback: false,
  });
  const rawDays = discovery.days.map((day: any, index: number) => ({
    day: Number(day.day) || index + 1,
    date: day.date ?? null,
    slots: (day.slots ?? [])
      .map((slot: any) => normalizeSlot(slot, input, candidates))
      .filter(Boolean),
  }));
  const validatedDays = validateItinerary(rawDays, input, candidates);
  const valid =
    validatedDays.length === input.nights + 1 && validatedDays.some((day) => day.slots.length);
  const itinerary: GroupItinerary = valid
    ? {
        destination: input.destination,
        nights: input.nights,
        days: validatedDays,
        source: "ai",
        provider: "gemini",
        generatedAt: new Date().toISOString(),
        candidates,
      }
    : { ...buildLocalItinerary(input, candidates), candidates };
  itinerary.discovery = {
    candidateCount: candidates.length,
    shortlistedCount: candidates.length,
    cached: discovery.cached,
    verifiedAt: candidates[0]?.verifiedAt ?? null,
  };
  return {
    itinerary,
    usedLlm: valid,
    ...(discovery.error ? { error: discovery.error } : {}),
  };
}

export async function regenerateSlotWithAi(
  input: ActivityAiInput,
  existing: ActivitySlot,
  day: number,
  avoid: string[] = [],
  candidates: ActivityCandidate[] = [],
): Promise<{ slot: ActivitySlot; usedLlm: boolean; error?: string }> {
  if (!candidates.length)
    return { slot: existing, usedLlm: false, error: "no_persisted_candidates" };
  try {
    const parsed = await geminiCompose(input, candidates, { slot: existing, day, avoid });
    const slot = normalizeSlot(parsed?.slot, input, candidates);
    if (slot) {
      const valid = validateItinerary([{ day, slots: [slot] }], input, candidates)[0]?.slots[0];
      if (valid) return { slot: valid, usedLlm: true };
    }
  } catch (error) {
    reportServerError(error, {
      provider: "gemini",
      model: GEMINI_MODEL,
      kind: "activity-slot",
      fallback: "local",
      candidateCount: candidates.length,
      destination: input.destination,
    });
  }
  const alternative = candidates.find(
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
        candidates,
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
