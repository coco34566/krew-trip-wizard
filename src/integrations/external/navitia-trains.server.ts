import { fetchExternal } from "./fetch-timeout.server";

const NAVITIA_BASE_URL = "https://api.navitia.io/v1";

type NavitiaCoord = { lat: string; lon: string };
type NavitiaPlace = {
  id?: string;
  name?: string;
  embedded_type?: string;
  administrative_region?: { coord?: NavitiaCoord; label?: string; name?: string };
  stop_area?: { coord?: NavitiaCoord; label?: string; name?: string };
};

type NavitiaSection = {
  type?: string;
  departure_date_time?: string;
  arrival_date_time?: string;
  from?: { name?: string };
  to?: { name?: string };
  display_informations?: { commercial_mode?: string; network?: string; label?: string };
  links?: Array<{ id?: string; type?: string; rel?: string }>;
};

type NavitiaJourney = {
  duration?: number;
  nb_transfers?: number;
  departure_date_time?: string;
  arrival_date_time?: string;
  sections?: NavitiaSection[];
};

export type NavitiaTrainLeg = {
  departureDateTime: string;
  arrivalDateTime: string;
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

export type NavitiaTrainSearchInput = {
  originCity: string;
  destinationCity: string;
  departDate: string;
  returnDate: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  earliestReturnDepartureTime?: string | null;
  latestReturnTime?: string | null;
  maxTravelDurationHours?: number | null;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function authHeaders(): HeadersInit {
  const token = process.env["SNCF_KEY_API"]?.trim();
  if (!token) throw new Error("SNCF_KEY_API manquante");
  return { Authorization: token, Accept: "application/json" };
}

function formatNavitiaDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function hhmm(value: string | undefined): string | null {
  if (!value || value.length < 13) return null;
  const time = value.slice(9, 13);
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

function coordOf(place: NavitiaPlace): NavitiaCoord | null {
  return place.administrative_region?.coord ?? place.stop_area?.coord ?? null;
}

function placeName(place: NavitiaPlace): string {
  return (
    place.administrative_region?.name ??
    place.administrative_region?.label ??
    place.stop_area?.name ??
    place.stop_area?.label ??
    place.name ??
    ""
  );
}

async function resolveCityCoord(city: string): Promise<NavitiaCoord | null> {
  const url = new URL(`${NAVITIA_BASE_URL}/places`);
  url.searchParams.set("q", city);
  url.searchParams.append("type[]", "administrative_region");
  url.searchParams.append("type[]", "stop_area");
  url.searchParams.set("disable_geojson", "true");
  url.searchParams.set("depth", "1");

  const response = await fetchExternal(url, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Navitia places ${response.status}: ${(await response.text().catch(() => "")).slice(0, 180)}`);
  }

  const payload = (await response.json()) as { places?: NavitiaPlace[] };
  const places = (payload.places ?? []).filter((place) => coordOf(place));
  if (!places.length) return null;

  const wanted = normalize(city);
  const exactAdmin = places.find(
    (place) =>
      place.embedded_type === "administrative_region" &&
      normalize(placeName(place)) === wanted,
  );
  const adminStartsWith = places.find(
    (place) =>
      place.embedded_type === "administrative_region" &&
      normalize(placeName(place)).startsWith(wanted),
  );
  return coordOf(exactAdmin ?? adminStartsWith ?? places[0]!);
}

function isRailSection(section: NavitiaSection): boolean {
  if (section.type !== "public_transport") return false;
  const physicalMode = (section.links ?? []).find(
    (link) => link.type === "physical_mode" || link.rel === "physical_mode",
  )?.id;
  if (
    physicalMode &&
    /physical_mode:(train|localtrain|longdistancetrain|rapidtransit|railshuttle)/i.test(
      physicalMode,
    )
  ) {
    return true;
  }

  const info = normalize(
    [
      section.display_informations?.commercial_mode,
      section.display_informations?.network,
      section.display_informations?.label,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return /(^| )(train|tgv|ter|ouigo|intercites|intercity|eurostar|thalys|rail)( |$)/.test(info);
}

function toTrainLeg(journey: NavitiaJourney): NavitiaTrainLeg | null {
  const departureDateTime = journey.departure_date_time;
  const arrivalDateTime = journey.arrival_date_time;
  if (!departureDateTime || !arrivalDateTime) return null;

  const railSections = (journey.sections ?? []).filter(isRailSection);
  if (!railSections.length) return null;

  const departureTime = hhmm(departureDateTime);
  const arrivalTime = hhmm(arrivalDateTime);
  if (!departureTime || !arrivalTime) return null;

  const firstRail = railSections[0]!;
  const lastRail = railSections[railSections.length - 1]!;
  return {
    departureDateTime,
    arrivalDateTime,
    departureTime,
    arrivalTime,
    durationMinutes: Math.max(1, Math.round(Number(journey.duration ?? 0) / 60)),
    transfers: Math.max(0, Number(journey.nb_transfers ?? railSections.length - 1)),
    departureStation: firstRail.from?.name ?? null,
    arrivalStation: lastRail.to?.name ?? null,
  };
}

function isLegCompatible(
  leg: NavitiaTrainLeg,
  constraints: {
    earliestDepartureTime?: string | null;
    latestArrivalTime?: string | null;
    maxTravelDurationHours?: number | null;
  },
): boolean {
  if (
    constraints.earliestDepartureTime &&
    leg.departureTime < constraints.earliestDepartureTime
  )
    return false;
  if (constraints.latestArrivalTime && leg.arrivalTime > constraints.latestArrivalTime)
    return false;
  if (
    constraints.maxTravelDurationHours &&
    constraints.maxTravelDurationHours > 0 &&
    leg.durationMinutes > constraints.maxTravelDurationHours * 60
  )
    return false;
  return true;
}

async function searchLeg(options: {
  from: NavitiaCoord;
  to: NavitiaCoord;
  date: string;
  earliestDepartureTime?: string | null;
  latestArrivalTime?: string | null;
  maxTravelDurationHours?: number | null;
  preferArrivalSearch?: boolean;
}): Promise<NavitiaTrainLeg | null> {
  const useArrival =
    options.preferArrivalSearch === true && Boolean(options.latestArrivalTime);
  const queryTime = useArrival
    ? options.latestArrivalTime!
    : options.earliestDepartureTime || "08:00";

  const url = new URL(`${NAVITIA_BASE_URL}/journeys`);
  url.searchParams.set("from", `${options.from.lon};${options.from.lat}`);
  url.searchParams.set("to", `${options.to.lon};${options.to.lat}`);
  url.searchParams.set("datetime", formatNavitiaDateTime(options.date, queryTime));
  url.searchParams.set("datetime_represents", useArrival ? "arrival" : "departure");
  url.searchParams.set("data_freshness", "base_schedule");
  url.searchParams.set("count", "8");
  url.searchParams.set("max_nb_transfers", "3");
  url.searchParams.set("depth", "1");
  if (options.maxTravelDurationHours && options.maxTravelDurationHours > 0) {
    url.searchParams.set(
      "max_duration",
      String(Math.ceil(options.maxTravelDurationHours * 3600)),
    );
  }

  const response = await fetchExternal(url, { headers: authHeaders() });
  const payload = (await response.json().catch(() => ({}))) as {
    journeys?: NavitiaJourney[];
    error?: { id?: string; message?: string };
  };
  if (!response.ok) {
    if (payload.error?.id === "no_solution" || response.status === 404) return null;
    throw new Error(
      `Navitia journeys ${response.status}: ${payload.error?.message ?? payload.error?.id ?? "erreur fournisseur"}`,
    );
  }

  const compatible = (payload.journeys ?? [])
    .map(toTrainLeg)
    .filter((leg): leg is NavitiaTrainLeg => Boolean(leg))
    .filter((leg) =>
      isLegCompatible(leg, {
        earliestDepartureTime: options.earliestDepartureTime,
        latestArrivalTime: options.latestArrivalTime,
        maxTravelDurationHours: options.maxTravelDurationHours,
      }),
    )
    .sort(
      (a, b) =>
        a.durationMinutes - b.durationMinutes ||
        a.transfers - b.transfers ||
        a.departureDateTime.localeCompare(b.departureDateTime),
    );

  return compatible[0] ?? null;
}

export async function searchNavitiaTrainRoundTrip(
  input: NavitiaTrainSearchInput,
): Promise<NavitiaTrainRoundTrip | null> {
  if (!process.env["SNCF_KEY_API"]?.trim()) return null;

  const [origin, destination] = await Promise.all([
    resolveCityCoord(input.originCity),
    resolveCityCoord(input.destinationCity),
  ]);
  if (!origin || !destination) return null;

  const [outbound, returnLeg] = await Promise.all([
    searchLeg({
      from: origin,
      to: destination,
      date: input.departDate,
      earliestDepartureTime: input.earliestDepartureTime,
      latestArrivalTime: input.latestArrivalTime,
      maxTravelDurationHours: input.maxTravelDurationHours,
    }),
    searchLeg({
      from: destination,
      to: origin,
      date: input.returnDate,
      earliestDepartureTime: input.earliestReturnDepartureTime,
      latestArrivalTime: input.latestReturnTime,
      maxTravelDurationHours: input.maxTravelDurationHours,
      preferArrivalSearch: true,
    }),
  ]);

  if (!outbound || !returnLeg) return null;
  return { outbound, return: returnLeg, source: "navitia" };
}
