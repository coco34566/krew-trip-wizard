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
const cityMatchesStation = (city: string, station: unknown) => {
  const wanted = normalize(city)
    .split(" ")
    .filter((x) => x.length >= 3);
  const actual = normalize(station);
  return wanted.length > 0 && wanted.every((word) => new RegExp(`(^| )${word}( |$)`).test(actual));
};
const number = (value: unknown) => {
  const parsed = Number(
    String(value ?? "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, ""),
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const field = (row: Record<string, unknown>, names: string[]) =>
  names.map((name) => row[name]).find((value) => value != null);

function rangeFor(
  rows: Record<string, unknown>[],
  origin: string,
  destination: string,
): FareRange | null {
  const matching = rows.filter(
    (row) =>
      cityMatchesStation(origin, field(row, ["origine", "gare_origine", "od_origine"])) &&
      cityMatchesStation(
        destination,
        field(row, ["destination", "gare_destination", "od_destination"]),
      ) &&
      normalize(field(row, ["classe", "class"])) !== "1",
  );
  const normal = matching.filter((row) =>
    normalize(field(row, ["libelle_tarif", "tarif", "profil_tarif"])).includes("tarif normal"),
  );
  const usable = normal.length
    ? normal
    : matching.filter(
        (row) =>
          !/promo|carte|enfant|jeune|senior|militaire/.test(
            normalize(field(row, ["libelle_tarif", "tarif", "profil_tarif"])),
          ),
      );
  const prices = usable
    .flatMap((row) => [
      number(field(row, ["prix_min", "tarif_min", "min"])),
      number(field(row, ["prix_max", "tarif_max", "max"])),
      number(field(row, ["prix", "tarif"])),
    ])
    .filter((value): value is number => value != null);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;
}

export async function searchSncfRoundTripFares(
  origin: string,
  destination: string,
): Promise<SncfRoundTripFares | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("limit", "100");
  url.searchParams.set("where", `classe=2`);
  const response = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SNCF Open Data ${response.status}`);
  const payload = (await response.json()) as { results?: Record<string, unknown>[] };
  const rows = payload.results ?? [];
  const outboundFareRange = rangeFor(rows, origin, destination);
  const returnFareRange = rangeFor(rows, destination, origin);
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
