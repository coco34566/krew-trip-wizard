import { fetchExternal } from "./fetch-timeout.server";
import { geocodeDestination } from "./geo-weather.server";

export type NavitiaTrainLeg = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  transfers: number;
  departureStation: string | null;
  arrivalStation: string | null;
};

export type NavitiaTrainRoundTrip = {
  outbound: NavitiaTrainLeg;
  return: NavitiaTrainLeg;
  source: "navitia";
};

type Journey = {
  duration?: number;
  nb_transfers?: number;
  departure_date_time?: string;
  arrival_date_time?: string;
  sections?: Array<{
    type?: string;
    from?: { name?: string; stop_area?: { name?: string } };
    to?: { name?: string; stop_area?: { name?: string } };
    display_informations?: {
      commercial_mode?: string;
      network?: string;
      label?: string;
      name?: string;
    };
  }>;
};

const NAVITIA_BASE = "https://api.navitia.io/v1";
const RAIL_RE = /train|tgv|ter|intercit|ouigo|rail|eurostar|thalys|lyria/i;

function hhmm(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(/T(\d{2})(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function railSections(journey: Journey) {
  return (journey.sections ?? []).filter((section) => {
    if (section.type !== "public_transport") return false;
    const info = section.display_informations;
    return RAIL_RE.test(
      [info?.commercial_mode, info?.network, info?.label, info?.name].filter(Boolean).join(" "),
    );
  });
}

function normalizeJourney(journey: Journey): NavitiaTrainLeg | null {
  const departureTime = hhmm(journey.departure_date_time);
  const arrivalTime = hhmm(journey.arrival_date_time);
  if (!departureTime || !arrivalTime) return null;

  const rail = railSections(journey);
  if (!rail.length) return null;
  const first = rail[0]!;
  const last = rail[rail.length - 1]!;

  const durationSeconds = Number(journey.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  return {
    departureTime,
    arrivalTime,
    durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
    transfers: Math.max(0, Number(journey.nb_transfers) || 0),
    departureStation: first.from?.stop_area?.name || first.from?.name || null,
    arrivalStation: last.to?.stop_area?.name || last.to?.name || null,
  };
}

function isWithinWindow(
  leg: NavitiaTrainLeg,
  constraints: { earliestDepartureTime?: string | null; latestArrivalTime?: string | null },
) {
  if (constraints.earliestDepartureTime && leg.departureTime < constraints.earliestDepartureTime)
    return false;
  if (constraints.latestArrivalTime && leg.arrivalTime > constraints.latestArrivalTime) return false;
  return true;
}

function navitiaDateTime(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

async function fetchJourneys(opts: {
  token: string;
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
  date: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  maxTravelDurationHours?: number | null;
}): Promise<NavitiaTrainLeg[]> {
  const url = new URL(`${NAVITIA_BASE}/journeys`);
  url.searchParams.set("from", `${opts.from.longitude};${opts.from.latitude}`);
  url.searchParams.set("to", `${opts.to.longitude};${opts.to.latitude}`);
  url.searchParams.set("min_nb_journeys", "5");
  url.searchParams.set("max_nb_journeys", "10");

  if (opts.latestArrivalTime && !opts.earliestDepartureTime) {
    url.searchParams.set("datetime", navitiaDateTime(opts.date, opts.latestArrivalTime));
    url.searchParams.set("datetime_represents", "arrival");
  } else {
    url.searchParams.set(
      "datetime",
      navitiaDateTime(opts.date, opts.earliestDepartureTime || "06:00"),
    );
    url.searchParams.set("datetime_represents", "departure");
  }

  if (opts.maxTravelDurationHours && opts.maxTravelDurationHours > 0) {
    url.searchParams.set(
      "max_duration",
      String(Math.max(1800, Math.round(opts.maxTravelDurationHours * 3600))),
    );
  }

  const response = await fetchExternal(url, {
    method: "GET",
    headers: { Authorization: opts.token, Accept: "application/json" },
  });
  if (response.status === 404) return [];
  if (response.status === 429) throw new Error("Navitia 429 rate limit");
  if (!response.ok) {
    throw new Error(`Navitia ${response.status} ${(await response.text().catch(() => "")).slice(0, 180)}`);
  }

  const payload = (await response.json()) as { journeys?: Journey[] };
  return (payload.journeys ?? [])
    .map(normalizeJourney)
    .filter((leg): leg is NavitiaTrainLeg => leg != null)
    .filter((leg) =>
      isWithinWindow(leg, {
        earliestDepartureTime: opts.earliestDepartureTime,
        latestArrivalTime: opts.latestArrivalTime,
      }),
    )
    .sort(
      (a, b) =>
        a.durationMinutes - b.durationMinutes ||
        a.transfers - b.transfers ||
        a.departureTime.localeCompare(b.departureTime),
    );
}

export async function searchNavitiaTrainRoundTrip(opts: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  earliestReturnDepartureTime?: string | null;
  latestReturnTime?: string | null;
  maxTravelDurationHours?: number | null;
}): Promise<NavitiaTrainRoundTrip | null> {
  const token = process.env["SNCF_KEY_API"]?.trim();
  if (!token) return null;

  const [origin, destination] = await Promise.all([
    geocodeDestination(opts.originCity),
    geocodeDestination(opts.destinationCity),
  ]);
  if (!origin || !destination) return null;

  const [outbound, inbound] = await Promise.all([
    fetchJourneys({
      token,
      from: origin,
      to: destination,
      date: opts.departDate,
      earliestDepartureTime: opts.earliestDepartureTime,
      latestArrivalTime: opts.latestArrivalTime,
      maxTravelDurationHours: opts.maxTravelDurationHours,
    }),
    fetchJourneys({
      token,
      from: destination,
      to: origin,
      date: opts.returnDate,
      earliestDepartureTime: opts.earliestReturnDepartureTime,
      latestArrivalTime: opts.latestReturnTime,
      maxTravelDurationHours: opts.maxTravelDurationHours,
    }),
  ]);

  const bestOutbound = outbound[0] ?? null;
  const bestReturn = inbound[0] ?? null;
  if (!bestOutbound || !bestReturn) return null;

  return { outbound: bestOutbound, return: bestReturn, source: "navitia" };
}
