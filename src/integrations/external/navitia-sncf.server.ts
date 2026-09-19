import { fetchExternal } from "./fetch-timeout.server";

const NAVITIA_BASE_URL = "https://api.navitia.io/v1";

type NavitiaPlace = {
  id?: string;
  name?: string;
  embedded_type?: string;
  stop_area?: { id?: string; name?: string };
};

type NavitiaJourneyPayload = {
  duration?: number;
  nb_transfers?: number;
  departure_date_time?: string;
  arrival_date_time?: string;
  sections?: Array<{
    type?: string;
    mode?: string;
    display_informations?: {
      commercial_mode?: string;
      physical_mode?: string;
      network?: string;
      label?: string;
      name?: string;
    };
    from?: { name?: string; stop_area?: { name?: string } };
    to?: { name?: string; stop_area?: { name?: string } };
  }>;
};

export type NavitiaRailLeg = {
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  transfers: number;
  originStation: string;
  destinationStation: string;
};

export type NavitiaRoundTripJourney = {
  outbound: NavitiaRailLeg;
  inbound: NavitiaRailLeg;
  outboundTime: string;
  outboundArrivalTime: string;
  returnDepartureTime: string;
  returnTime: string;
  outboundDurationMinutes: number;
  returnDurationMinutes: number;
  durationMinutes: number;
  stops: number;
  provider: "navitia";
  dataKind: "provider_offer";
};

const hhmm = (value: string | undefined): string | null => {
  if (!value) return null;
  const m = value.match(/T(\d{2})(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function authHeaders(): HeadersInit {
  const token = process.env["SNCF_KEY_API"];
  if (!token) throw new Error("SNCF_KEY_API manquante");
  return { Authorization: token, Accept: "application/json" };
}

async function resolveStopArea(city: string): Promise<{ id: string; name: string } | null> {
  const url = new URL(`${NAVITIA_BASE_URL}/places`);
  url.searchParams.set("q", city);
  url.searchParams.append("type[]", "stop_area");

  const response = await fetchExternal(url, { method: "GET", headers: authHeaders() });
  if (!response.ok) throw new Error(`Navitia places ${response.status}`);

  const payload = (await response.json()) as { places?: NavitiaPlace[] };
  const places = (payload.places ?? []).filter(
    (place) => place.embedded_type === "stop_area" || place.stop_area?.id,
  );
  if (!places.length) return null;

  const wanted = normalize(city);
  const ranked = places
    .map((place, index) => {
      const id = place.stop_area?.id ?? place.id ?? "";
      const name = place.stop_area?.name ?? place.name ?? "";
      const actual = normalize(name);
      let score = 1000 - index;
      if (actual === wanted) score += 300;
      else if (actual.startsWith(wanted + " ")) score += 220;
      else if (actual.includes(wanted)) score += 150;
      if (/gare|station|tgv|sncf/i.test(name)) score += 30;
      return { id, name, score };
    })
    .filter((place) => place.id && place.name)
    .sort((a, b) => b.score - a.score);

  return ranked[0] ? { id: ranked[0].id, name: ranked[0].name } : null;
}

function isRailJourney(journey: NavitiaJourneyPayload): boolean {
  return (journey.sections ?? []).some((section) => {
    const info = section.display_informations;
    const value = normalize(
      [info?.commercial_mode, info?.physical_mode, info?.network, info?.label, info?.name].join(" "),
    );
    return /(^| )(train|tgv|ter|intercites|intercity|rail|rer)( |$)/.test(value);
  });
}

function toLeg(journey: NavitiaJourneyPayload): NavitiaRailLeg | null {
  const departureTime = hhmm(journey.departure_date_time);
  const arrivalTime = hhmm(journey.arrival_date_time);
  if (!departureTime || !arrivalTime || !Number.isFinite(journey.duration)) return null;

  const sections = journey.sections ?? [];
  const publicTransportSections = sections.filter((section) => section.type === "public_transport");
  const first = publicTransportSections[0] ?? sections[0];
  const last = publicTransportSections[publicTransportSections.length - 1] ?? sections[sections.length - 1];

  return {
    departureTime,
    arrivalTime,
    durationMinutes: Math.max(1, Math.round(Number(journey.duration) / 60)),
    transfers: Math.max(0, Number(journey.nb_transfers) || 0),
    originStation: first?.from?.stop_area?.name ?? first?.from?.name ?? "Gare de départ",
    destinationStation: last?.to?.stop_area?.name ?? last?.to?.name ?? "Gare d’arrivée",
  };
}

async function searchLeg(options: {
  fromId: string;
  toId: string;
  date: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  maxDurationHours?: number | null;
}): Promise<NavitiaRailLeg | null> {
  const useArrival = !options.earliestDepartureTime && Boolean(options.latestArrivalTime);
  const time = useArrival
    ? options.latestArrivalTime!
    : options.earliestDepartureTime || "06:00";
  const url = new URL(`${NAVITIA_BASE_URL}/journeys`);
  url.searchParams.set("from", options.fromId);
  url.searchParams.set("to", options.toId);
  url.searchParams.set("datetime", `${options.date.replace(/-/g, "")}T${time.replace(":", "")}00`);
  url.searchParams.set("datetime_represents", useArrival ? "arrival" : "departure");
  url.searchParams.set("max_nb_transfers", "3");
  if (options.maxDurationHours && options.maxDurationHours > 0) {
    url.searchParams.set("max_duration", String(Math.round(options.maxDurationHours * 3600)));
  }

  const response = await fetchExternal(url, { method: "GET", headers: authHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Navitia journeys ${response.status}`);

  const payload = (await response.json()) as { journeys?: NavitiaJourneyPayload[] };
  const candidates = (payload.journeys ?? [])
    .filter(isRailJourney)
    .map(toLeg)
    .filter((leg): leg is NavitiaRailLeg => Boolean(leg))
    .filter((leg) => {
      if (options.earliestDepartureTime && leg.departureTime < options.earliestDepartureTime) return false;
      if (options.latestArrivalTime && leg.arrivalTime > options.latestArrivalTime) return false;
      if (
        options.maxDurationHours &&
        options.maxDurationHours > 0 &&
        leg.durationMinutes > options.maxDurationHours * 60
      ) return false;
      return true;
    });

  return candidates.sort(
    (a, b) => a.durationMinutes - b.durationMinutes || a.transfers - b.transfers,
  )[0] ?? null;
}

export async function searchNavitiaRoundTrip(options: {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  earliestReturnDepartureTime?: string | null;
  latestReturnTime?: string | null;
  maxTravelDurationHours?: number | null;
}): Promise<NavitiaRoundTripJourney | null> {
  if (!process.env["SNCF_KEY_API"]) return null;

  const [origin, destination] = await Promise.all([
    resolveStopArea(options.originCity),
    resolveStopArea(options.destinationCity),
  ]);
  if (!origin || !destination || origin.id === destination.id) return null;

  const outbound = await searchLeg({
    fromId: origin.id,
    toId: destination.id,
    date: options.departDate,
    earliestDepartureTime: options.earliestDepartureTime,
    latestArrivalTime: options.latestArrivalTime,
    maxDurationHours: options.maxTravelDurationHours,
  });
  if (!outbound) return null;

  const inbound = await searchLeg({
    fromId: destination.id,
    toId: origin.id,
    date: options.returnDate,
    earliestDepartureTime: options.earliestReturnDepartureTime,
    latestArrivalTime: options.latestReturnTime,
    maxDurationHours: options.maxTravelDurationHours,
  });
  if (!inbound) return null;

  return {
    outbound,
    inbound,
    outboundTime: outbound.departureTime,
    outboundArrivalTime: outbound.arrivalTime,
    returnDepartureTime: inbound.departureTime,
    returnTime: inbound.arrivalTime,
    outboundDurationMinutes: outbound.durationMinutes,
    returnDurationMinutes: inbound.durationMinutes,
    durationMinutes: outbound.durationMinutes + inbound.durationMinutes,
    stops: outbound.transfers + inbound.transfers,
    provider: "navitia",
    dataKind: "provider_offer",
  };
}
