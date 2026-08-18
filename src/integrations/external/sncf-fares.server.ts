export type FareRange = { min: number; max: number };
export type SncfRoundTripFares = {
  outboundFareRange: FareRange;
  returnFareRange: FareRange;
  roundTripFareRange: FareRange;
  source: "sncf_open_data";
};

const ENDPOINT =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tarifs-tgv-inoui-ouigo/records";
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const escapeQuery = (value: string) => value.replace(/["\\]/g, " ").trim();
const cityMatchesStation = (city: string, station: unknown) => {
  const normCity = normalize(city);
  const actual = normalize(station);
  if (!normCity || !actual) return false;

  // Major multi-station hubs
  if (normCity.includes("paris") && actual.includes("paris")) return true;
  if (normCity.includes("lyon") && actual.includes("lyon")) return true;
  if (normCity.includes("marseille") && actual.includes("marseille")) return true;
  if (normCity.includes("bordeaux") && actual.includes("bordeaux")) return true;
  if (normCity.includes("lille") && actual.includes("lille")) return true;

  const wanted = normCity
    .split(" ")
    .filter((word) => word.length >= 3);
  return wanted.length > 0 && wanted.every((word) => new RegExp(`(^| )${word}( |$)`).test(actual));
};
const positive = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

async function fetchDirection(
  origin: string,
  destination: string,
): Promise<Record<string, unknown>[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("limit", "100");
  url.searchParams.set(
    "where",
    `classe=2 AND search(gare_origine, "${escapeQuery(origin)}") AND search(gare_destination, "${escapeQuery(destination)}")`,
  );
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SNCF Open Data ${response.status}`);
  const payload = (await response.json()) as { results?: Record<string, unknown>[] };
  return (payload.results ?? []).filter(
    (row) =>
      cityMatchesStation(origin, row["gare_origine"]) &&
      cityMatchesStation(destination, row["gare_destination"]) &&
      Number(row["classe"]) === 2 &&
      /tgv inoui|ouigo/i.test(String(row["transporteur"] ?? "")),
  );
}

function rangeFor(rows: Record<string, unknown>[]): FareRange | null {
  const normal = rows.filter((row) => normalize(row["profil_tarifaire"]).includes("tarif normal"));
  const standard = rows.filter(
    (row) => !/promo|carte|enfant|jeune|senior|militaire/.test(normalize(row["profil_tarifaire"])),
  );
  const usable = normal.length ? normal : standard;
  const minimums = usable
    .map((row) => positive(row["prix_minimum"]))
    .filter((value): value is number => value != null);
  const maximums = usable
    .map((row) => positive(row["prix_maximum"]))
    .filter((value): value is number => value != null);
  if (!minimums.length && !maximums.length) return null;
  return {
    min: minimums.length ? Math.min(...minimums) : Math.min(...maximums),
    max: maximums.length ? Math.max(...maximums) : Math.max(...minimums),
  };
}

export async function searchSncfRoundTripFares(
  origin: string,
  destination: string,
): Promise<SncfRoundTripFares | null> {
  const [outboundRows, returnRows] = await Promise.all([
    fetchDirection(origin, destination),
    fetchDirection(destination, origin),
  ]);
  const outboundFareRange = rangeFor(outboundRows);
  const returnFareRange = rangeFor(returnRows);
  if (!outboundFareRange || !returnFareRange) return null;
  return {
    outboundFareRange,
    returnFareRange,
    roundTripFareRange: {
      min: outboundFareRange.min + returnFareRange.min,
      max: outboundFareRange.max + returnFareRange.max,
    },
    source: "sncf_open_data",
  };
}
