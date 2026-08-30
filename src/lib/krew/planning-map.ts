export type PlanningMapPoint = {
  id: string;
  kind: "activity" | "lodging";
  label: string;
  latitude: number;
  longitude: number;
  day: number | null;
  orderInDay: number | null;
  time: string | null;
  type: string | null;
  address: string | null;
  mapsUrl: string | null;
  distanceFromPreviousKm: number | null;
};

export type PlanningMapSegment = {
  fromId: string;
  toId: string;
  distanceKm: number;
};

export type PlanningMapModel = {
  points: PlanningMapPoint[];
  activityPoints: PlanningMapPoint[];
  lodgingPoint: PlanningMapPoint | null;
  segments: PlanningMapSegment[];
};

type RawSlot = Record<string, unknown>;
type RawDay = { day?: unknown; slots?: unknown };
type RawLodging = Record<string, unknown> | null | undefined;

const GOOGLE_MAPS_SEARCH_PREFIX = "https://www.google.com/maps/search/?api=1&query=";

function finiteCoordinate(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isGoogleMapsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("https://www.google.com/maps/") ||
    normalized.startsWith("https://google.com/maps/") ||
    normalized.startsWith("https://maps.google.com/maps/") ||
    normalized.startsWith("https://maps.google.com/")
  );
}

export function buildPlanningMapsUrl(input: {
  existingUrl?: unknown;
  name?: unknown;
  address?: unknown;
  destination?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}): string | null {
  if (isGoogleMapsUrl(input.existingUrl)) return input.existingUrl.trim();

  const name = safeText(input.name) ?? "";
  const address = safeText(input.address) ?? "";
  const destination = safeText(input.destination) ?? "";
  const latitude = finiteCoordinate(input.latitude);
  const longitude = finiteCoordinate(input.longitude);

  let query = "";
  if (name && address) query = `${name}, ${address}`;
  else if (name && destination) query = `${name}, ${destination}`;
  else if (name) query = name;
  else if (address) query = address;
  else if (latitude != null && longitude != null) query = `${latitude},${longitude}`;

  return query ? `${GOOGLE_MAPS_SEARCH_PREFIX}${encodeURIComponent(query)}` : null;
}

export function haversineKm(
  a: Pick<PlanningMapPoint, "latitude" | "longitude">,
  b: Pick<PlanningMapPoint, "latitude" | "longitude">,
): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Detects a clearly isolated place without treating normal regional trips as outliers.
 * The guard only activates when the overall trip is compact, then requires a point to
 * be at least 100 km from its nearest neighbour and far beyond the trip's normal spacing.
 */
export function findPlanningMapGeographicOutlierIds(points: PlanningMapPoint[]): string[] {
  const activityPoints = points.filter((point) => point.kind === "activity");
  if (activityPoints.length < 4) return [];

  const nearestDistances = activityPoints.map((point) => {
    const distances = activityPoints
      .filter((candidate) => candidate.id !== point.id)
      .map((candidate) => haversineKm(point, candidate));
    return Math.min(...distances);
  });

  const typicalNearestKm = median(nearestDistances);
  if (typicalNearestKm > 25) return [];

  const thresholdKm = Math.max(100, typicalNearestKm * 12);
  return activityPoints
    .filter((_, index) => nearestDistances[index] > thresholdKm)
    .map((point) => point.id);
}

function isActivityLikeSlot(slot: RawSlot): boolean {
  const type = String(slot.type ?? "").toLowerCase();
  return type !== "transport" && type !== "hotel";
}

function readLodgingCoordinate(lodging: RawLodging, key: "latitude" | "longitude"): number | null {
  if (!lodging) return null;
  const direct = finiteCoordinate(lodging[key]);
  if (direct != null) return direct;
  const location = lodging.location;
  if (location && typeof location === "object") {
    return finiteCoordinate((location as Record<string, unknown>)[key]);
  }
  return null;
}

export function buildPlanningMapModel(input: {
  days?: RawDay[] | null;
  destination?: string | null;
  selectedLodging?: RawLodging;
}): PlanningMapModel {
  const activityPoints: PlanningMapPoint[] = [];
  const segments: PlanningMapSegment[] = [];

  for (const rawDay of Array.isArray(input.days) ? input.days : []) {
    const day = Number(rawDay?.day);
    const dayNumber = Number.isFinite(day) ? day : activityPoints.length + 1;
    const slots = Array.isArray(rawDay?.slots) ? (rawDay.slots as RawSlot[]) : [];
    let visibleOrderInDay = 0;
    let previousVisiblePoint: PlanningMapPoint | null = null;

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex] ?? {};
      if (!isActivityLikeSlot(slot)) continue;

      const latitude = finiteCoordinate(slot.latitude);
      const longitude = finiteCoordinate(slot.longitude);
      if (latitude == null || longitude == null) continue;

      visibleOrderInDay += 1;
      const id = `activity-${dayNumber}-${slotIndex}`;
      const point: PlanningMapPoint = {
        id,
        kind: "activity",
        label: safeText(slot.label) ?? `Étape ${visibleOrderInDay}`,
        latitude,
        longitude,
        day: dayNumber,
        orderInDay: visibleOrderInDay,
        time: safeText(slot.time),
        type: safeText(slot.type),
        address: safeText(slot.address),
        mapsUrl: buildPlanningMapsUrl({
          existingUrl: slot.url,
          name: slot.label,
          address: slot.address,
          destination: input.destination,
          latitude,
          longitude,
        }),
        distanceFromPreviousKm: null,
      };

      if (previousVisiblePoint) {
        const distanceKm = haversineKm(previousVisiblePoint, point);
        point.distanceFromPreviousKm = distanceKm;
        segments.push({ fromId: previousVisiblePoint.id, toId: point.id, distanceKm });
      }

      activityPoints.push(point);
      previousVisiblePoint = point;
    }
  }

  let lodgingPoint: PlanningMapPoint | null = null;
  const lodging = input.selectedLodging;
  if (lodging) {
    const latitude = readLodgingCoordinate(lodging, "latitude");
    const longitude = readLodgingCoordinate(lodging, "longitude");
    if (latitude != null && longitude != null) {
      const name = safeText(lodging.name) ?? "Hébergement";
      const location = lodging.location;
      const address = safeText(lodging.address) ??
        (location && typeof location === "object" ? safeText((location as Record<string, unknown>).address) : null);
      lodgingPoint = {
        id: `lodging-${safeText(lodging.id) ?? "selected"}`,
        kind: "lodging",
        label: name,
        latitude,
        longitude,
        day: null,
        orderInDay: null,
        time: null,
        type: safeText(lodging.type),
        address,
        mapsUrl: buildPlanningMapsUrl({
          existingUrl: lodging.mapsUrl,
          name,
          address,
          destination: input.destination,
          latitude,
          longitude,
        }),
        distanceFromPreviousKm: null,
      };
    }
  }

  return {
    points: lodgingPoint ? [lodgingPoint, ...activityPoints] : activityPoints,
    activityPoints,
    lodgingPoint,
    segments,
  };
}

export function formatAirDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "";
  if (distanceKm < 1) return `≈ ${Math.max(50, Math.round((distanceKm * 1000) / 50) * 50)} m à vol d’oiseau`;
  const rounded = distanceKm < 10 ? distanceKm.toFixed(1).replace(".", ",") : Math.round(distanceKm).toString();
  return `≈ ${rounded} km à vol d’oiseau`;
}

export function formatMapSegmentDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm)) return "";
  if (distanceKm < 1) return `≈ ${Math.max(50, Math.round((distanceKm * 1000) / 50) * 50)} m`;
  return `≈ ${distanceKm < 10 ? distanceKm.toFixed(1).replace(".", ",") : Math.round(distanceKm)} km`;
}
