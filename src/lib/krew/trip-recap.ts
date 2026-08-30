export type TripRecapSource = {
  trip: {
    name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    participants_count?: number | null;
    selected_activity_ids?: string[] | null;
    group_itinerary?: { days?: unknown[] | null } | null;
    group_logistics?: {
      selectedHotelId?: string | null;
      hotels?: Array<{ id?: string | null; name?: string | null }> | null;
    } | null;
  };
  destination?: {
    name?: string | null;
    country?: string | null;
  } | null;
  photoCount?: number;
};

export type TripRecap = {
  eligible: boolean;
  destinationName: string | null;
  country: string | null;
  durationDays: number | null;
  participantsCount: number | null;
  activitiesCount: number | null;
  accommodationName: string | null;
  dateLabel: string | null;
};

function parseTripDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDayNumber(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(utc)) return null;
  return Math.floor(utc / 86_400_000);
}

function formatDateRange(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })}`;
  }
  if (sameYear) {
    return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

export function buildTripRecap(source: TripRecapSource, now = new Date()): TripRecap {
  const { trip, destination, photoCount = 0 } = source;
  const start = parseTripDate(trip.start_date);
  const end = parseTripDate(trip.end_date);
  const startDay = calendarDayNumber(trip.start_date);
  const endDay = calendarDayNumber(trip.end_date);
  const destinationName = destination?.name?.trim() || null;
  const country = destination?.country?.trim() || null;

  const durationDays =
    startDay != null && endDay != null && endDay >= startDay ? endDay - startDay + 1 : null;

  const participants = Number(trip.participants_count);
  const participantsCount = Number.isFinite(participants) && participants > 0 ? participants : null;

  const activityIds = Array.isArray(trip.selected_activity_ids)
    ? [...new Set(trip.selected_activity_ids.filter(Boolean))]
    : [];
  const activitiesCount = activityIds.length > 0 ? activityIds.length : null;

  const logistics = trip.group_logistics || {};
  const hotels = Array.isArray(logistics.hotels) ? logistics.hotels : [];
  const selectedHotel = logistics.selectedHotelId
    ? hotels.find((hotel) => hotel?.id === logistics.selectedHotelId)
    : null;
  const accommodationName = selectedHotel?.name?.trim() || null;

  const itineraryDays = Array.isArray(trip.group_itinerary?.days) ? trip.group_itinerary?.days?.length ?? 0 : 0;
  const endPassed = Boolean(end && now.getTime() > new Date(`${trip.end_date}T23:59:59`).getTime());
  const hasEvidenceOfPreparedTrip = Boolean(
    itineraryDays > 0 || activitiesCount || accommodationName || photoCount > 0,
  );

  return {
    // There is no trustworthy "trip actually happened" status in the current schema:
    // status="annule" is also used for archives. We therefore rely on an ended,
    // dated trip with a selected destination and at least one concrete trip artefact.
    eligible: Boolean(start && end && endPassed && destinationName && hasEvidenceOfPreparedTrip),
    destinationName,
    country,
    durationDays,
    participantsCount,
    activitiesCount,
    accommodationName,
    dateLabel: formatDateRange(start, end),
  };
}
