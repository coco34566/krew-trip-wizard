import { resolveActivityResourceUrl } from "@/lib/krew/activity-ai.server";

export function buildFinalItinerarySlot(options: {
  slot: any;
  matchedPlace?: any | null;
  matchedSource?: string | null;
  mode?: string | null;
  resolvedResource?: { url?: string | null; resourceKind?: any } | null;
  webUrl?: string | null;
  fallbackMapUrl?: string | null;
}) {
  const { slot: s, matchedPlace, matchedSource, mode, resolvedResource, webUrl, fallbackMapUrl } = options;

  const estimatedPrices = {
    estimatedPriceMinPerPerson: (s as any).estimatedPriceMinPerPerson ?? null,
    estimatedPriceMaxPerPerson: (s as any).estimatedPriceMaxPerPerson ?? null,
    estimatedPriceCurrency: (s as any).estimatedPriceCurrency ?? null,
  };

  if (matchedPlace) {
    return {
      moment: s.moment,
      time: s.time,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      type: s.type,
      category: s.category,
      venueFamily: s.venueFamily,
      searchIntent: s.searchIntent,
      locationContext: s.locationContext ?? "external",
      label: matchedPlace.name,
      detail:
        s.detail ||
        s.searchIntent ||
        "Lieu sélectionné par KREW",
      address: matchedPlace.address || null,
      ...resolvedResource,
      activityMode: mode,
      candidateId: matchedPlace.id,
      verified: true,
      source: matchedSource || "geoapify",
      latitude: matchedPlace.latitude,
      longitude: matchedPlace.longitude,
      ...estimatedPrices,
    };
  }

  if (webUrl) {
    const resLink = resolveActivityResourceUrl(webUrl);
    return {
      moment: s.moment,
      time: s.time,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      type: s.type,
      category: s.category,
      venueFamily: s.venueFamily,
      searchIntent: s.searchIntent,
      locationContext: s.locationContext ?? "external",
      label: (s as any).suggestedPlace || s.label,
      detail:
        s.detail ||
        s.searchIntent ||
        "Réservation ou choix du lieu à préciser",
      address: null,
      verified: false,
      source: "krew_web",
      url: resLink.url,
      resourceKind: resLink.resourceKind ?? "website",
      ...estimatedPrices,
    };
  }

  return {
    moment: s.moment,
    time: s.time,
    endTime: s.endTime,
    durationMinutes: s.durationMinutes,
    type: s.type,
    category: s.category,
    venueFamily: s.venueFamily,
    searchIntent: s.searchIntent,
    locationContext: s.locationContext ?? "external",
    label: (s as any).suggestedPlace || s.label,
    detail:
      s.detail ||
      s.searchIntent ||
      "Réservation ou choix du lieu à préciser",
    address: null,
    verified: false,
    source: "krew",
    url: fallbackMapUrl || null,
    resourceKind: fallbackMapUrl ? "maps" : null,
    ...estimatedPrices,
  };
}

export function isSameSuggestedPlace(
  suggestedPlace: string | null | undefined,
  candidateName: string | null | undefined,
): boolean {
  if (!suggestedPlace || !suggestedPlace.trim()) {
    return true;
  }
  if (!candidateName || !candidateName.trim()) {
    return false;
  }

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normSuggested = normalize(suggestedPlace);
  const normCandidate = normalize(candidateName);

  if (!normSuggested) return true;
  if (!normCandidate) return false;

  // Exact match or space-insensitive match
  if (normSuggested === normCandidate) return true;
  const noSpaceSuggested = normSuggested.replace(/\s+/g, "");
  const noSpaceCandidate = normCandidate.replace(/\s+/g, "");
  if (noSpaceSuggested === noSpaceCandidate) return true;

  const GENERIC_STOP_WORDS = new Set([
    "the",
    "de",
    "du",
    "des",
    "la",
    "le",
    "les",
    "and",
    "et",
    "un",
    "une",
    "restaurant",
    "cafe",
    "bar",
    "hotel",
    "budapest",
    "bains",
    "bain",
    "bath",
    "baths",
    "spa",
    "museum",
    "musee",
    "market",
    "marche",
    "thermes",
    "thermal",
  ]);

  const suggestedTokens = normSuggested.split(" ").filter(Boolean);
  const candidateTokens = normCandidate.split(" ").filter(Boolean);

  const sigSuggested = suggestedTokens.filter((t) => !GENERIC_STOP_WORDS.has(t));

  if (sigSuggested.length === 0) {
    return false;
  }

  let matchCount = 0;
  for (const token of sigSuggested) {
    const matched = candidateTokens.some(
      (cToken) =>
        cToken === token ||
        (token.length >= 4 && (cToken.includes(token) || token.includes(cToken)))
    );
    if (matched) {
      matchCount++;
    }
  }

  const requiredMatches = sigSuggested.length <= 2 ? sigSuggested.length : Math.ceil(sigSuggested.length * 0.75);

  return matchCount >= requiredMatches;
}
