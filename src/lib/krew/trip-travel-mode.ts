import type { TripWeatherSummary } from "@/lib/krew/trip-weather";
import {
  buildPlanningMapModel,
  buildPlanningMapsUrl,
  formatAirDistance,
} from "@/lib/krew/planning-map";

type RawSlot = Record<string, any>;
type RawDay = { day?: number; date?: string | null; slots?: RawSlot[] };
type RawBackup = Record<string, any>;

export type TravelModeSlotStatus = "past" | "current" | "next" | "upcoming" | "unscheduled";

export type TravelModeSlot = {
  key: string;
  day: number;
  index: number;
  label: string;
  time: string | null;
  endTime: string | null;
  moment: string | null;
  type: string | null;
  category: string | null;
  venueFamily: string | null;
  address: string | null;
  mapsUrl: string | null;
  distanceLabel: string | null;
  status: TravelModeSlotStatus;
  raw: RawSlot;
};

export type TravelModeLodging = {
  name: string;
  address: string | null;
  mapsUrl: string | null;
};

export type TravelModePlanB = {
  label: string;
  detail: string | null;
  reason: string;
};

export type TravelModeModel = {
  active: boolean;
  today: string;
  dayNumber: number | null;
  slots: TravelModeSlot[];
  current: TravelModeSlot | null;
  next: TravelModeSlot | null;
  lodging: TravelModeLodging | null;
  todayWeather: NonNullable<TripWeatherSummary["days"]>[number] | null;
  weatherImpact: string | null;
  planB: TravelModePlanB | null;
};

export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isTripInProgress(input: {
  datesLocked?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): boolean {
  if (!input.datesLocked || !input.startDate || !input.endDate) return false;
  const today = localDateKey(input.now);
  return today >= input.startDate.slice(0, 10) && today <= input.endDate.slice(0, 10);
}

function dayDiff(start: string, today: string): number {
  const a = Date.parse(`${start.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${today}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function minutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function slotEndMinutes(slot: RawSlot): number | null {
  const explicit = minutes(slot.endTime);
  if (explicit != null) return explicit;
  const start = minutes(slot.time);
  const duration = Number(slot.durationMinutes);
  return start != null && Number.isFinite(duration) && duration > 0 ? start + duration : null;
}

function normalizedText(...values: unknown[]) {
  return values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isClearlyOutdoor(slot: RawSlot): boolean {
  if (String(slot.category ?? "") === "sport_outdoor") return true;
  const text = normalizedText(slot.venueFamily, slot.searchIntent, slot.label, slot.detail);
  return /kayak|canoe|paddle|randonnee|balade|promenade|plage|parc|jardin|terrasse|plein air|outdoor|velo|bike|bateau|voilier|surf|escalade|accrobranche|point de vue|panorama/.test(text);
}

export function isClearlyIndoor(candidate: RawBackup): boolean {
  const text = normalizedText(
    candidate.canonicalVenueFamily,
    candidate.venueFamily,
    candidate.searchIntent,
    candidate.label,
    candidate.detail,
  );
  return /musee|museum|galerie|gallery|spa|thermes|cinema|bowling|escape|atelier|workshop|indoor|interieur|restaurant|cafe|bar|degustation|tasting|shopping|marche couvert/.test(text);
}

function severeWeather(day: NonNullable<TripWeatherSummary["days"]>[number] | null): boolean {
  if (!day) return false;
  if (day.kind === "storm" || day.kind === "snow") return true;
  return day.kind === "rain" && day.precipitationMm >= 3;
}

function findBackup(itinerary: any, dayIndex: number, slotIndex: number): RawBackup | null {
  const skeletonSlot = itinerary?.skeleton?.days?.[dayIndex]?.slots?.[slotIndex];
  if (!skeletonSlot?.id) return null;
  const backups = Array.isArray(itinerary?.skeleton?.backups) ? itinerary.skeleton.backups : [];
  return backups.find((backup: RawBackup) => backup?.forSlot === skeletonSlot.id && isClearlyIndoor(backup)) ?? null;
}

function selectedLodging(logistics: any, destination?: string | null): TravelModeLodging | null {
  const selectedId = logistics?.selectedHotelId;
  if (!selectedId || !Array.isArray(logistics?.hotels)) return null;
  const hotel = logistics.hotels.find((item: any) => item?.id === selectedId);
  if (!hotel?.name) return null;
  const address = typeof hotel.address === "string" && hotel.address.trim() ? hotel.address.trim() : null;
  return {
    name: String(hotel.name),
    address,
    mapsUrl: buildPlanningMapsUrl({
      existingUrl: hotel.mapsUrl,
      name: hotel.name,
      address,
      destination,
      latitude: hotel.latitude ?? hotel.location?.latitude,
      longitude: hotel.longitude ?? hotel.location?.longitude,
    }),
  };
}

export function buildTravelModeModel(input: {
  trip: any;
  weather?: TripWeatherSummary | null;
  destinationName?: string | null;
  now?: Date;
}): TravelModeModel {
  const now = input.now ?? new Date();
  const today = localDateKey(now);
  const trip = input.trip ?? {};
  const active = isTripInProgress({
    datesLocked: Boolean(trip.dates_locked || trip.datesLocked),
    startDate: trip.start_date,
    endDate: trip.end_date,
    now,
  });
  const empty: TravelModeModel = {
    active,
    today,
    dayNumber: null,
    slots: [],
    current: null,
    next: null,
    lodging: null,
    todayWeather: null,
    weatherImpact: null,
    planB: null,
  };
  if (!active) return empty;

  const itinerary = trip.group_itinerary ?? {};
  const days: RawDay[] = Array.isArray(itinerary.days) ? itinerary.days : [];
  const expectedDayNumber = trip.start_date ? dayDiff(trip.start_date, today) + 1 : null;
  let dayIndex = days.findIndex((day) => day?.date?.slice(0, 10) === today);
  if (dayIndex < 0 && expectedDayNumber != null) {
    dayIndex = days.findIndex((day) => Number(day?.day) === expectedDayNumber);
  }
  if (dayIndex < 0) {
    return {
      ...empty,
      lodging: selectedLodging(trip.group_logistics ?? {}, input.destinationName),
      todayWeather: input.weather?.days?.find((day) => day.date === today) ?? null,
    };
  }

  const day = days[dayIndex] ?? {};
  const rawSlots = Array.isArray(day.slots) ? day.slots : [];
  const mapModel = buildPlanningMapModel({
    days,
    destination: input.destinationName ?? itinerary.destination ?? null,
    selectedLodging:
      (trip.group_logistics?.hotels ?? []).find((item: any) => item?.id === trip.group_logistics?.selectedHotelId) ?? null,
  });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let nextAssigned = false;
  const slots: TravelModeSlot[] = rawSlots
    .filter((slot) => !["transport", "hotel"].includes(String(slot?.type ?? "").toLowerCase()))
    .map((slot, index) => {
      const start = minutes(slot.time);
      const end = slotEndMinutes(slot);
      let status: TravelModeSlotStatus = "unscheduled";
      if (start != null) {
        if (end != null && nowMinutes >= start && nowMinutes < end) status = "current";
        else if (end != null ? nowMinutes >= end : nowMinutes > start) status = "past";
        else if (!nextAssigned) {
          status = "next";
          nextAssigned = true;
        } else status = "upcoming";
      }
      const point = mapModel.activityPoints.find(
        (candidate) => candidate.day === Number(day.day) && candidate.orderInDay === index + 1,
      );
      return {
        key: `${Number(day.day) || dayIndex + 1}-${index}`,
        day: Number(day.day) || dayIndex + 1,
        index,
        label: String(slot.label || "Activité"),
        time: typeof slot.time === "string" ? slot.time : null,
        endTime: typeof slot.endTime === "string" ? slot.endTime : null,
        moment: typeof slot.moment === "string" ? slot.moment : null,
        type: typeof slot.type === "string" ? slot.type : null,
        category: typeof slot.category === "string" ? slot.category : null,
        venueFamily: typeof slot.venueFamily === "string" ? slot.venueFamily : null,
        address: typeof slot.address === "string" && slot.address.trim() ? slot.address.trim() : null,
        mapsUrl:
          point?.mapsUrl ??
          buildPlanningMapsUrl({
            existingUrl: slot.url,
            name: slot.label,
            address: slot.address,
            destination: input.destinationName,
            latitude: slot.latitude,
            longitude: slot.longitude,
          }),
        distanceLabel:
          point?.distanceFromPreviousKm != null ? formatAirDistance(point.distanceFromPreviousKm) : null,
        status,
        raw: slot,
      };
    });

  const current = slots.find((slot) => slot.status === "current") ?? null;
  const next = current ?? slots.find((slot) => slot.status === "next") ?? null;
  const todayWeather = input.weather?.mode === "forecast"
    ? input.weather.days?.find((weatherDay) => weatherDay.date === today) ?? null
    : null;
  const conflictTarget = next;
  const startMinutes = conflictTarget ? minutes(conflictTarget.time) : null;
  const withinSixHours = startMinutes != null && startMinutes - nowMinutes >= -60 && startMinutes - nowMinutes <= 360;
  const conflict = Boolean(
    conflictTarget && withinSixHours && isClearlyOutdoor(conflictTarget.raw) && severeWeather(todayWeather),
  );
  const backup = conflictTarget && conflict ? findBackup(itinerary, dayIndex, conflictTarget.index) : null;

  return {
    active,
    today,
    dayNumber: Number(day.day) || dayIndex + 1,
    slots,
    current,
    next,
    lodging: selectedLodging(trip.group_logistics ?? {}, input.destinationName),
    todayWeather,
    weatherImpact: conflict
      ? `${conflictTarget!.label} est prévu en extérieur dans les prochaines heures : la météo peut réellement gêner ce créneau.`
      : null,
    planB: backup
      ? {
          label: String(backup.label || "Alternative indoor"),
          detail: typeof backup.detail === "string" ? backup.detail : null,
          reason: `Alternative déjà prévue par KREW pour le créneau de ${conflictTarget!.time ?? conflictTarget!.moment ?? "la journée"}.`,
        }
      : null,
  };
}
