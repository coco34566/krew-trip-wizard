import type { AccommodationRecord, ActivityRecord, DestinationRecord, TravelCatalog } from "./engine";

const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function normalizeActivityCategory(name: string, category: string): string {
  const value = norm(`${name} ${category}`);
  if (/randon|trail|velo|cycl|tennis|padel|kayak|cano|voile|surf|sport|ski|escalad/.test(value)) return "sport";
  if (/spa|sauna|massage|bien.etre|detente|thermal/.test(value)) return "detente";
  if (/vin|oenolog|gastronom|cuisine|degust/.test(value)) return "gastronomie";
  if (/muse|culture|patrimoine|visite|histor/.test(value)) return "culture";
  return norm(category).replace(/\s+/g, "_") || "experiences";
}

function dedupeKey(row: ActivityRecord | AccommodationRecord): string {
  const externalId = (row as any).external_id;
  const source = (row as any).source;
  if (externalId) return `${source ?? "unknown"}:${externalId}`;
  const latitude = (row as any).latitude;
  const longitude = (row as any).longitude;
  if (latitude != null && longitude != null) return `${norm(row.name)}:${latitude}:${longitude}`;
  return norm(row.name);
}

/** Attach data fetched around anchor towns to the single parent territory. */
export function attachAnchorEnrichments(
  catalog: TravelCatalog,
  parents: DestinationRecord[],
): TravelCatalog {
  const destinationByName = new Map(catalog.destinations.map((destination) => [norm(destination.name), destination]));
  const parentBySourceId = new Map<string, DestinationRecord>();
  for (const parent of parents) {
    parentBySourceId.set(parent.id, parent);
    for (const anchor of parent.anchor_places ?? []) {
      const anchorDestination = destinationByName.get(norm(anchor));
      if (anchorDestination && anchorDestination.id !== parent.id) parentBySourceId.set(anchorDestination.id, parent);
    }
  }

  const remap = <T extends ActivityRecord | AccommodationRecord>(rows: T[]): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const row of rows) {
      const parent = parentBySourceId.get(row.destination_id);
      const mapped = parent ? { ...row, destination_id: parent.id } : row;
      const key = `${mapped.destination_id}:${dedupeKey(mapped)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(mapped as T);
    }
    return result;
  };

  const parentIds = new Set(parents.map((parent) => parent.id));
  const anchorIds = new Set(
    [...parentBySourceId.keys()].filter((destinationId) => !parentIds.has(destinationId)),
  );
  return {
    ...catalog,
    destinations: catalog.destinations.filter((destination) => !anchorIds.has(destination.id)),
    activities: remap(catalog.activities),
    accommodations: remap(catalog.accommodations),
  };
}
