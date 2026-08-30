export type PlanningCoordinate = {
  latitude: number;
  longitude: number;
};

export type PlanningMapActivity = PlanningCoordinate & {
  kind: "activity";
  id: string;
  day: number;
  sequenceInDay: number;
  chronologicalIndex: number;
  name: string;
  type: string | null;
  time: string | null;
  address: string | null;
  mapsUrl: string | null;
};

export type PlanningMapAccommodation = PlanningCoordinate & {
  kind: "accommodation";
  id: string;
  name: string;
  address: string | null;
  mapsUrl: string | null;
};

export type PlanningMapSegment = {
  fromId: string;
  toId: string;
  from: PlanningCoordinate;
  to: PlanningCoordinate;
  distanceKm: number;
};

export type PlanningMapModel = {
  activities: PlanningMapActivity[];
  accommodation: PlanningMapAccommodation | null;
  points: Array<PlanningMapActivity | PlanningMapAccommodation>;
  segments: PlanningMapSegment[];
};

type LooseRecord = Record<string, unknown>;

type OrderedCandidate = {
  id: string;
  day: number;
  sequenceInDay: number;
  chronologicalIndex: number;
  name: string;
  type: string | null;
  time: string | null;
  address: string | null;
  mapsUrl: string | null;
  coordinate: PlanningCoordinate | null;
};

function record(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function finiteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function coordinateFrom(value: unknown): PlanningCoordinate | null {
  const item = record(value);
  const location = record(item.location);
  const latitude = finiteNumber(item.latitude, item.lat, location.latitude, location.lat);
  const longitude = finiteNumber(
    item.longitude,
    item.lng,
    item.lon,
    location.longitude,
    location.lng,
    location.lon,
  );

  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isGoogleMapsUrl(value: unknown): value is string {
  const input = cleanString(value);
  if (!input) return false;
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    return (
      (host === "google.com" || host === "www.google.com" || host === "maps.google.com") &&
      url.pathname.startsWith("/maps")
    );
  } catch {
    return false;
  }
}

/**
 * Same Google Maps search convention already used by KREW's verified-place
 * fallback on the server. It never geocodes and only uses data already known.
 */
export function buildKrewMapsSearchUrl(input: {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  destination?: string | null;
}): string | null {
  const name = cleanString(input.name);
  const address = cleanString(input.address);
  const destination = cleanString(input.destination);

  let query = "";
  if (name && address) query = `${name}, ${address}`;
  else if (name && destination) query = `${name}, ${destination}`;
  else if (name) query = name;
  else if (address) query = address;
  else if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    query = `${input.latitude},${input.longitude}`;
  }

  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

export function haversineKm(a: PlanningCoordinate, b: PlanningCoordinate): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function mapsUrlFor(item: LooseRecord, coordinate: PlanningCoordinate, destination?: string | null) {
  if (isGoogleMapsUrl(item.url)) return String(item.url);
  if (isGoogleMapsUrl(item.mapsUrl)) return String(item.mapsUrl);
  if (isGoogleMapsUrl(item.googleMapsUrl)) return String(item.googleMapsUrl);

  return buildKrewMapsSearchUrl({
    name: cleanString(item.label) ?? cleanString(item.name),
    address: cleanString(item.address) ?? cleanString(record(item.location).address),
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    destination,
  });
}

function selectedAccommodationModel(
  accommodation: unknown,
  destination?: string | null,
): PlanningMapAccommodation | null {
  const item = record(accommodation);
  const coordinate = coordinateFrom(item);
  const name = cleanString(item.name) ?? cleanString(item.label);
  if (!coordinate || !name) return null;

  const location = record(item.location);
  const address =
    cleanString(item.address) ??
    cleanString(location.address) ??
    ([cleanString(location.area), cleanString(location.city)].filter(Boolean).join(", ") || null);

  return {
    kind: "accommodation",
    id: String(item.id ?? "selected-accommodation"),
    name,
    address,
    mapsUrl: mapsUrlFor({ ...item, address }, coordinate, destination),
    ...coordinate,
  };
}

export function buildPlanningMapModel(input: {
  days: unknown;
  selectedAccommodation?: unknown;
  destination?: string | null;
}): PlanningMapModel {
  const days = Array.isArray(input.days) ? input.days : [];
  const ordered: OrderedCandidate[] = [];
  let chronologicalIndex = 0;

  for (const rawDay of days) {
    const day = record(rawDay);
    const dayNumber = finiteNumber(day.day) ?? ordered.length + 1;
    const slots = Array.isArray(day.slots) ? day.slots : [];
    let sequenceInDay = 0;

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = record(slots[slotIndex]);
      const type = cleanString(slot.type)?.toLowerCase() ?? null;
      if (type === "transport" || type === "hotel") continue;

      sequenceInDay += 1;
      chronologicalIndex += 1;
      const coordinate = coordinateFrom(slot);
      const name = cleanString(slot.label) ?? cleanString(slot.name) ?? `Étape ${chronologicalIndex}`;
      const address = cleanString(slot.address);

      ordered.push({
        id: `day-${dayNumber}-slot-${slotIndex}`,
        day: dayNumber,
        sequenceInDay,
        chronologicalIndex,
        name,
        type,
        time: cleanString(slot.time),
        address,
        mapsUrl: coordinate ? mapsUrlFor(slot, coordinate, input.destination) : null,
        coordinate,
      });
    }
  }

  const activities: PlanningMapActivity[] = ordered
    .filter((activity): activity is OrderedCandidate & { coordinate: PlanningCoordinate } => Boolean(activity.coordinate))
    .map((activity) => ({
      kind: "activity",
      id: activity.id,
      day: activity.day,
      sequenceInDay: activity.sequenceInDay,
      chronologicalIndex: activity.chronologicalIndex,
      name: activity.name,
      type: activity.type,
      time: activity.time,
      address: activity.address,
      mapsUrl: activity.mapsUrl,
      ...activity.coordinate,
    }));

  const segments: PlanningMapSegment[] = [];
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (!current.coordinate || !next.coordinate) continue;
    segments.push({
      fromId: current.id,
      toId: next.id,
      from: current.coordinate,
      to: next.coordinate,
      distanceKm: haversineKm(current.coordinate, next.coordinate),
    });
  }

  const accommodation = selectedAccommodationModel(input.selectedAccommodation, input.destination);
  return {
    activities,
    accommodation,
    points: accommodation ? [...activities, accommodation] : activities,
    segments,
  };
}
