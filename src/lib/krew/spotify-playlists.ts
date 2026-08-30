export type MusicSlot = "journey" | "setting" | "group";

export const VALID_MUSIC_TAGS = [
  "2000s",
  "2010s",
  "acoustic",
  "active",
  "apero",
  "beach",
  "brunch",
  "car",
  "chanson",
  "chill",
  "city",
  "classics",
  "club",
  "convivial",
  "cosy",
  "current",
  "dance",
  "daytime",
  "dinner",
  "disco",
  "easy",
  "electronic",
  "feel_good",
  "friends",
  "funk",
  "happy",
  "high_energy",
  "home",
  "house",
  "lake",
  "mixed_age",
  "morning",
  "mountain",
  "nature",
  "nightlife",
  "nostalgia",
  "party",
  "pool",
  "pop",
  "recovery",
  "return_trip",
  "road_trip",
  "singalong",
  "slow",
  "sport",
  "sun",
  "summer",
  "sunset",
  "village",
  "young",
] as const;

export type MusicTag = (typeof VALID_MUSIC_TAGS)[number];

const VALID_TAG_SET = new Set<string>(VALID_MUSIC_TAGS);

export type SpotifyPlaylistCatalogEntry = {
  id: string;
  spotifyPlaylistId: string;
  name: string;
  tags: MusicTag[];
  slots: MusicSlot[];
  priority: number;
  active: boolean;
  verifiedAt: string;
  seasonality?: "summer";
  reviewAfter?: string;
};

const VERIFIED_AT = "2026-08-30";

export const SPOTIFY_PLAYLIST_CATALOG: SpotifyPlaylistCatalogEntry[] = [
  {
    id: "classic-road-trip-songs",
    spotifyPlaylistId: "37i9dQZF1DX9wC1KY45plY",
    name: "Classic Road Trip Songs",
    tags: ["road_trip", "classics", "singalong", "car", "feel_good", "mixed_age"],
    slots: ["journey"],
    priority: 95,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "songs-to-sing-in-the-car",
    spotifyPlaylistId: "37i9dQZF1DWWMOmoXKqHTD",
    name: "Songs to Sing in the Car",
    tags: ["road_trip", "singalong", "pop", "friends", "car", "high_energy"],
    slots: ["journey", "group"],
    priority: 96,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "acoustic-chill",
    spotifyPlaylistId: "37i9dQZF1DWYGZAMYFDM8S",
    name: "Acoustic Chill",
    tags: ["chill", "nature", "mountain", "cosy", "recovery", "slow"],
    slots: ["setting", "group"],
    priority: 90,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "feel-good-acoustic",
    spotifyPlaylistId: "37i9dQZF1DWXRvPx3nttRN",
    name: "Feel Good Acoustic",
    tags: ["acoustic", "feel_good", "cosy", "morning", "return_trip", "nature"],
    slots: ["journey", "setting"],
    priority: 88,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "dinner-with-friends",
    spotifyPlaylistId: "37i9dQZF1DX4xuWVBs4FgJ",
    name: "Dinner with Friends",
    tags: ["friends", "dinner", "apero", "home", "chill", "convivial"],
    slots: ["setting", "group"],
    priority: 92,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "morning-motivation",
    spotifyPlaylistId: "37i9dQZF1DXc5e2bJhV6pu",
    name: "Morning Motivation",
    tags: ["morning", "active", "feel_good", "high_energy"],
    slots: ["journey", "setting"],
    priority: 84,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "wake-up-happy",
    spotifyPlaylistId: "37i9dQZF1DX0UrRvztWcAU",
    name: "Wake Up Happy",
    tags: ["morning", "brunch", "happy", "easy", "friends"],
    slots: ["journey", "setting"],
    priority: 86,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "poolside-selection",
    spotifyPlaylistId: "37i9dQZF1DX2cEUXdJJLVG",
    name: "Poolside Selection",
    tags: ["pool", "summer", "sun", "daytime", "chill", "friends"],
    slots: ["setting", "group"],
    priority: 94,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "sunny-beats",
    spotifyPlaylistId: "37i9dQZF1DXbtuVQL4zoey",
    name: "Sunny Beats",
    tags: ["sun", "summer", "pool", "road_trip", "sunset", "chill"],
    slots: ["journey", "setting"],
    priority: 91,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "summer-hits",
    spotifyPlaylistId: "37i9dQZF1DX1gRalH1mWrP",
    name: "Summer Hits 2026",
    tags: ["summer", "current", "beach", "party", "sun", "young"],
    slots: ["setting", "group"],
    priority: 80,
    active: true,
    verifiedAt: VERIFIED_AT,
    seasonality: "summer",
    reviewAfter: "2026-09-30",
  },
  {
    id: "housewerk",
    spotifyPlaylistId: "37i9dQZF1DXa8NOEUWPn9W",
    name: "Housewerk",
    tags: ["house", "party", "sunset", "nightlife", "electronic"],
    slots: ["setting", "group"],
    priority: 93,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "mint",
    spotifyPlaylistId: "37i9dQZF1DX4dyzvuaRJ0n",
    name: "mint",
    tags: ["electronic", "dance", "current", "party", "club", "high_energy"],
    slots: ["group"],
    priority: 91,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "all-out-2000s",
    spotifyPlaylistId: "37i9dQZF1DX4o1oenSJRJd",
    name: "All Out 2000s",
    tags: ["2000s", "nostalgia", "party", "singalong"],
    slots: ["group"],
    priority: 89,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "all-out-2010s",
    spotifyPlaylistId: "37i9dQZF1DX5Ejj0EkURtP",
    name: "All Out 2010s",
    tags: ["2010s", "nostalgia", "party", "pop", "singalong"],
    slots: ["group"],
    priority: 88,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "disco-forever",
    spotifyPlaylistId: "37i9dQZF1DX1MUPbVKMgJE",
    name: "Disco Forever",
    tags: ["disco", "funk", "party", "classics", "mixed_age", "singalong"],
    slots: ["group"],
    priority: 87,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
  {
    id: "standards-chanson-francaise",
    spotifyPlaylistId: "37i9dQZF1DWTypZHlgEy1G",
    name: "Standards de la Chanson Française",
    tags: ["chanson", "classics", "mixed_age", "singalong"],
    slots: ["journey", "group"],
    priority: 75,
    active: true,
    verifiedAt: VERIFIED_AT,
  },
];

export type MusicContextInput = {
  ambiances?: string[] | null;
  activityCategories?: string[] | null;
  selectedActivities?: string[] | null;
  wantedEnvType?: string | string[] | null;
  groupAgeRange?: string | null;
  travelPace?: string | null;
  transportModes?: string[] | null;
  accommodationRole?: string | null;
  accommodationType?: string | null;
  requiredAmenities?: string[] | null;
  destination?: string | null;
  eventType?: string | null;
  startDate?: string | null;
};

export type MusicContext = {
  weightedTags: Partial<Record<MusicTag, number>>;
  ageTags: MusicTag[];
  hasNonAgeSignal: boolean;
};

export type SpotifyPlaylistRecommendation = {
  id: string;
  spotifyPlaylistId: string;
  name: string;
  url: string;
  slot: MusicSlot;
  slotLabel: string;
  score: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function addTag(target: Partial<Record<MusicTag, number>>, tag: MusicTag, weight: number) {
  target[tag] = Math.max(target[tag] ?? 0, weight);
}

function addTagsFromText(
  weightedTags: Partial<Record<MusicTag, number>>,
  raw: string,
  weight: number,
) {
  const text = normalize(raw);
  const mappings: Array<[RegExp, MusicTag[]]> = [
    [/(fest|party|soiree|fete)/, ["party", "high_energy"]],
    [/(nightlife|club|boite|dance)/, ["nightlife", "club", "dance"]],
    [/(chill|calme|detente|relax)/, ["chill", "slow"]],
    [/(convivial|amis|friends|apero)/, ["convivial", "friends", "apero"]],
    [/(sport|actif|active|rando|hike|trek)/, ["sport", "active", "nature"]],
    [/(bar|pub)/, ["apero", "nightlife"]],
    [/(restaurant|diner|dinner)/, ["dinner", "convivial"]],
    [/(brunch)/, ["brunch", "morning"]],
    [/(plage|beach|mer|sea)/, ["beach", "sun"]],
    [/(piscine|pool)/, ["pool", "sun"]],
    [/(bateau|boat)/, ["sun", "chill"]],
    [/(montagne|mountain|ski)/, ["mountain", "nature"]],
    [/(nature|foret|forest|camp)/, ["nature"]],
    [/(lac|lake)/, ["lake", "nature"]],
    [/(village|campagne|rural)/, ["village", "cosy"]],
    [/(urbain|urban|ville|city)/, ["city"]],
    [/(maison|villa|chalet|home)/, ["home", "convivial"]],
    [/(matin|morning|reveil)/, ["morning"]],
    [/(sunset|coucher de soleil)/, ["sunset"]],
  ];

  for (const [pattern, tags] of mappings) {
    if (pattern.test(text)) tags.forEach((tag) => addTag(weightedTags, tag, weight));
  }
}

function ageTagsFor(range?: string | null): MusicTag[] {
  const text = normalize(range ?? "");
  if (!text) return [];
  if (/18\s*25|18\s*a\s*25|20\s*25/.test(text)) return ["current", "2010s", "young"];
  if (/25\s*35|28\s*38|30\s*35/.test(text)) return ["2000s", "2010s"];
  if (/35\s*45|45\s*60|60/.test(text)) return ["classics", "disco", "mixed_age"];
  if (/multi|mix|intergen/.test(text)) return ["mixed_age", "classics", "singalong"];
  return [];
}

export function buildMusicContext(input: MusicContextInput): MusicContext {
  const weightedTags: Partial<Record<MusicTag, number>> = {};

  for (const value of input.ambiances ?? []) addTagsFromText(weightedTags, value, 5);
  for (const value of [...(input.activityCategories ?? []), ...(input.selectedActivities ?? [])]) {
    addTagsFromText(weightedTags, value, 3);
  }

  const environments = Array.isArray(input.wantedEnvType)
    ? input.wantedEnvType
    : input.wantedEnvType
      ? [input.wantedEnvType]
      : [];
  for (const value of environments) addTagsFromText(weightedTags, value, 3);

  if (input.travelPace) {
    const pace = normalize(input.travelPace);
    if (pace.includes("chill")) {
      addTag(weightedTags, "chill", 2);
      addTag(weightedTags, "slow", 2);
    } else if (pace.includes("plein") || pace.includes("actif")) {
      addTag(weightedTags, "active", 2);
      addTag(weightedTags, "high_energy", 2);
    }
  }

  for (const mode of input.transportModes ?? []) {
    const normalizedMode = normalize(mode);
    if (normalizedMode.includes("voiture") || normalizedMode.includes("car")) {
      addTag(weightedTags, "car", 2);
      addTag(weightedTags, "road_trip", 2);
    }
  }

  for (const value of [input.accommodationRole, input.accommodationType, ...(input.requiredAmenities ?? [])]) {
    if (value) addTagsFromText(weightedTags, value, 2);
  }

  if (input.eventType && /(evg|evjf|anniversaire)/i.test(input.eventType)) {
    addTag(weightedTags, "party", 4);
    addTag(weightedTags, "friends", 2);
  }

  if (input.destination) addTagsFromText(weightedTags, input.destination, 1);

  if (input.startDate) {
    const month = new Date(`${input.startDate}T12:00:00Z`).getUTCMonth() + 1;
    if (month >= 6 && month <= 8) addTag(weightedTags, "summer", 1);
  }

  return {
    weightedTags,
    ageTags: ageTagsFor(input.groupAgeRange),
    hasNonAgeSignal: Object.keys(weightedTags).length > 0,
  };
}

export function spotifyPlaylistUrl(spotifyPlaylistId: string): string {
  return `https://open.spotify.com/playlist/${spotifyPlaylistId}`;
}

function contradictionPenalty(entry: SpotifyPlaylistCatalogEntry, context: MusicContext): number {
  const tags = new Set(entry.tags);
  if ((context.weightedTags.chill ?? 0) >= 4 && (tags.has("high_energy") || tags.has("club"))) return -5;
  if ((context.weightedTags.nightlife ?? 0) >= 4 && tags.has("slow")) return -5;
  return 0;
}

function scoreEntry(entry: SpotifyPlaylistCatalogEntry, context: MusicContext): number {
  let score = contradictionPenalty(entry, context);
  for (const tag of entry.tags) score += context.weightedTags[tag] ?? 0;

  if (score > 0 && context.hasNonAgeSignal && entry.tags.some((tag) => context.ageTags.includes(tag))) {
    score += 1;
  }
  return score;
}

function slotLabel(slot: MusicSlot, entry: SpotifyPlaylistCatalogEntry, context: MusicContext): string {
  const tags = new Set(entry.tags);
  if (slot === "journey") {
    if (tags.has("road_trip") || (context.weightedTags.car ?? 0) > 0) return "Pour la route";
    if (tags.has("morning")) return "Réveil tranquille";
    return "Pour le départ";
  }
  if (slot === "setting") {
    if (tags.has("pool") || tags.has("sun") || tags.has("beach")) return "Au soleil";
    if (tags.has("recovery") || tags.has("slow")) return "Retour au calme";
    if (tags.has("dinner") || tags.has("apero")) return "Pour l’apéro";
    return "Dans le décor";
  }
  if (tags.has("party") || tags.has("dance") || tags.has("club")) return "Quand ça part";
  if (tags.has("dinner") || tags.has("apero")) return "Pour l’apéro";
  return "Tous ensemble";
}

const FALLBACK_BY_SLOT: Record<MusicSlot, string[]> = {
  journey: ["classic-road-trip-songs", "feel-good-acoustic"],
  setting: ["feel-good-acoustic", "acoustic-chill"],
  group: ["dinner-with-friends", "disco-forever"],
};

export function recommendSpotifyPlaylists(
  context: MusicContext,
  catalog: SpotifyPlaylistCatalogEntry[] = SPOTIFY_PLAYLIST_CATALOG,
): SpotifyPlaylistRecommendation[] {
  const activeCatalog = catalog.filter((entry) => entry.active);
  const used = new Set<string>();
  const results: SpotifyPlaylistRecommendation[] = [];

  for (const slot of ["journey", "setting", "group"] as const) {
    const candidates = activeCatalog
      .filter((entry) => entry.slots.includes(slot) && !used.has(entry.id))
      .map((entry) => ({ entry, score: scoreEntry(entry, context) }))
      .sort((a, b) => b.score - a.score || b.entry.priority - a.entry.priority || a.entry.id.localeCompare(b.entry.id));

    let selected = candidates.find((candidate) => candidate.score > 0) ?? null;

    if (!selected) {
      const fallback = FALLBACK_BY_SLOT[slot]
        .map((id) => activeCatalog.find((entry) => entry.id === id && entry.slots.includes(slot) && !used.has(entry.id)))
        .find(Boolean);
      if (fallback) selected = { entry: fallback, score: 0 };
    }

    if (!selected) continue;

    used.add(selected.entry.id);
    results.push({
      id: selected.entry.id,
      spotifyPlaylistId: selected.entry.spotifyPlaylistId,
      name: selected.entry.name,
      url: spotifyPlaylistUrl(selected.entry.spotifyPlaylistId),
      slot,
      slotLabel: slotLabel(slot, selected.entry, context),
      score: selected.score,
    });
  }

  return results.slice(0, 3);
}

export function isValidMusicTag(tag: string): tag is MusicTag {
  return VALID_TAG_SET.has(tag);
}
