function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DESTINATION_STOPWORDS = new Set([
  "cote",
  "region",
  "zone",
  "secteur",
  "autour",
  "alentours",
  "metropole",
  "agglomeration",
  "de",
  "du",
  "des",
  "d",
  "la",
  "le",
  "les",
  "l",
  "et",
]);

/**
 * Returns the meaningful geographic anchors contained in a destination label.
 * Example: "Côte de Cascais & Sintra" -> ["cascais", "sintra"].
 *
 * Planning destinations are sometimes regional marketing labels while geocoding
 * results contain only the actual city/municipality. Requiring the whole label
 * to be present rejects perfectly valid results such as "Cascais, Portugal".
 */
export function destinationGeographyAnchors(destination: string): string[] {
  const normalized = normalize(destination);
  if (!normalized) return [];

  const anchors = normalized
    .split(" ")
    .filter((token) => token.length >= 4 && !DESTINATION_STOPWORDS.has(token));

  return Array.from(new Set(anchors));
}

export function destinationGeographyMatches(destination: string, geography: string): boolean {
  const normalizedDestination = normalize(destination);
  const normalizedGeography = normalize(geography);
  if (!normalizedDestination || !normalizedGeography) return false;

  if (normalizedGeography.includes(normalizedDestination)) return true;

  const anchors = destinationGeographyAnchors(destination);
  return anchors.some((anchor) => normalizedGeography.includes(anchor));
}
