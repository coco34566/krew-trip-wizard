export const STAY_PROFILE_IDS = [
  "city_lively",
  "city_discovery",
  "charm_escape",
  "regional_explorer",
  "house_together",
  "nature_disconnect",
  "exceptional_experience",
  "outdoor_active",
  "wellness_slow",
] as const;

export type StayProfileId = (typeof STAY_PROFILE_IDS)[number];
export type LocalMobilityPreference = "walk_transit" | "car_if_worth_it" | "car_ok";
export type AccommodationRole = "base_only" | "part_of_stay" | "centerpiece";

export type StayProfilePreference = {
  ambiances?: string[];
  activityCategories?: string[];
  wantedEnvType?: string | null;
  travelPace?: string | null;
  requiredAmenities?: string[];
  localMobility?: LocalMobilityPreference | null;
  accommodationRole?: AccommodationRole | null;
  isStar?: boolean;
  weight?: number;
};

export type ProfileAffinity = { id: StayProfileId; score: number; evidence: string[] };
export type StayConcept = {
  id: string;
  title: string;
  profiles: StayProfileId[];
  score: number;
  rationale: string;
};
export type DiscoveryBranch = "urban" | "regional" | "property_led" | "outdoor";

export const PROFILE_LABELS: Record<StayProfileId, string> = {
  city_lively: "City trip animé",
  city_discovery: "City trip découverte",
  charm_escape: "Escapade de charme",
  regional_explorer: "Région à explorer",
  house_together: "Maison entre nous",
  nature_disconnect: "Nature & déconnexion",
  exceptional_experience: "Expérience exceptionnelle",
  outdoor_active: "Évasion outdoor & sportive",
  wellness_slow: "Parenthèse détente & bien-être",
};

const norm = (values: string[] = []) =>
  values.map((v) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
const includesAny = (values: string[], terms: string[]) =>
  values.some((v) => terms.some((t) => v.includes(t)));

export function calculateStayProfileAffinities(
  preference: StayProfilePreference,
): ProfileAffinity[] {
  const env = norm(String(preference.wantedEnvType ?? "").split(/[,;|]/));
  const activities = norm(preference.activityCategories);
  const moods = norm(preference.ambiances);
  const all = [...env, ...activities, ...moods, ...norm(preference.requiredAmenities)];
  const scores = Object.fromEntries(STAY_PROFILE_IDS.map((id) => [id, 25])) as Record<
    StayProfileId,
    number
  >;
  const evidence = Object.fromEntries(STAY_PROFILE_IDS.map((id) => [id, [] as string[]])) as Record<
    StayProfileId,
    string[]
  >;
  const add = (ids: StayProfileId[], points: number, why: string) =>
    ids.forEach((id) => {
      scores[id] += points;
      evidence[id].push(why);
    });

  if (includesAny(env, ["urbain", "centre-ville"]))
    add(["city_lively", "city_discovery"], 24, "environnement urbain");
  if (includesAny(env, ["quartier anime"])) add(["city_lively"], 22, "quartier animé");
  if (includesAny(env, ["village"]))
    add(["charm_escape", "regional_explorer"], 20, "village de charme");
  if (includesAny(env, ["nature", "montagne", "lac", "riviere", "mer"]))
    add(["regional_explorer", "nature_disconnect"], 13, "cadre naturel");
  if (includesAny(env, ["montagne", "lac", "riviere"]))
    add(["outdoor_active"], 16, "terrain outdoor");
  if (includesAny(all, ["culture", "musee", "visite", "patrimoine"]))
    add(["city_discovery", "charm_escape", "regional_explorer"], 15, "culture et patrimoine");
  if (includesAny(all, ["gastronomie", "oenolog", "restaurant"]))
    add(
      ["city_discovery", "charm_escape", "regional_explorer", "wellness_slow"],
      10,
      "gastronomie",
    );
  if (includesAny(all, ["bar", "club", "soiree", "fete", "nightlife"])) {
    add(["city_lively"], 23, "sorties et vie nocturne");
    add(["nature_disconnect", "wellness_slow"], -12, "animation prioritaire");
  }
  if (
    includesAny(all, [
      "randon",
      "velo",
      "ski",
      "surf",
      "voile",
      "rafting",
      "nautique",
      "sport",
      "aventure",
      "sensation",
    ])
  )
    add(["outdoor_active", "regional_explorer"], 17, "activités outdoor");
  if (includesAny(all, ["insolite", "experience", "original", "luxe"]))
    add(["exceptional_experience"], 24, "expérience mémorable");
  if (includesAny(all, ["detente", "spa", "piscine", "bien-etre", "chill"]))
    add(["wellness_slow", "nature_disconnect", "house_together"], 16, "détente et temps ensemble");
  if (includesAny(all, ["maison", "villa", "gite", "airbnb"]))
    add(["house_together"], 21, "logement collectif");
  if (preference.travelPace === "plein_programme") {
    add(["city_lively", "outdoor_active"], 12, "rythme soutenu");
    add(["wellness_slow", "nature_disconnect"], -10, "rythme soutenu");
  }
  if (preference.travelPace === "chill") {
    add(["wellness_slow", "nature_disconnect", "house_together"], 14, "rythme tranquille");
    add(["city_lively"], -9, "rythme tranquille");
  }
  if (preference.travelPace === "equilibre")
    add(
      ["city_discovery", "charm_escape", "regional_explorer", "house_together"],
      8,
      "rythme équilibré",
    );
  if (preference.localMobility === "walk_transit") {
    add(["city_lively", "city_discovery"], 15, "mobilité sans voiture");
    add(["regional_explorer"], -7, "déplacements locaux limités");
  }
  if (preference.localMobility === "car_ok" || preference.localMobility === "car_if_worth_it")
    add(["regional_explorer", "charm_escape", "outdoor_active"], 11, "voiture locale acceptée");
  if (preference.accommodationRole === "base_only") {
    add(
      ["city_lively", "city_discovery", "regional_explorer"],
      10,
      "logement comme point de chute",
    );
    add(["house_together"], -15, "logement fonctionnel");
  }
  if (preference.accommodationRole === "part_of_stay")
    add(["house_together", "wellness_slow", "charm_escape"], 12, "logement important");
  if (preference.accommodationRole === "centerpiece") {
    add(
      ["house_together", "exceptional_experience", "wellness_slow"],
      22,
      "logement au cœur du voyage",
    );
    add(["city_lively", "city_discovery"], -12, "séjour centré sur le logement");
  }
  return STAY_PROFILE_IDS.map((id) => ({
    id,
    score: Math.max(0, Math.min(100, scores[id])),
    evidence: evidence[id],
  })).sort((a, b) => b.score - a.score);
}

export function aggregateStayProfiles(preferences: StayProfilePreference[]): ProfileAffinity[] {
  if (!preferences.length)
    return STAY_PROFILE_IDS.map((id) => ({
      id,
      score: 50,
      evidence: ["données historiques absentes"],
    }));
  const individual = preferences.map((p) => ({
    weight: p.isStar ? Math.max(1, p.weight ?? 1) : 1,
    affinities: calculateStayProfileAffinities(p),
  }));
  return STAY_PROFILE_IDS.map((id) => {
    const values = individual.map((p) => ({
      score: p.affinities.find((a) => a.id === id)!.score,
      weight: p.weight,
    }));
    const mean =
      values.reduce((s, v) => s + v.score * v.weight, 0) / values.reduce((s, v) => s + v.weight, 0);
    const minimum = Math.min(...values.map((v) => v.score));
    const satisfied = values.filter((v) => v.score >= 50).length / values.length;
    return {
      id,
      score: Math.round(mean * 0.65 + minimum * 0.2 + satisfied * 100 * 0.15),
      evidence: [
        `${values.filter((v) => v.score >= 50).length}/${values.length} participants satisfaits`,
        `satisfaction minimale ${minimum}`,
      ],
    };
  }).sort((a, b) => b.score - a.score);
}

export function buildStayConcepts(affinities: ProfileAffinity[], max = 3): StayConcept[] {
  const sorted = [...affinities].sort((a, b) => b.score - a.score);
  return sorted.slice(0, max).map((a) => ({
    id: a.id,
    profiles: [a.id],
    title: PROFILE_LABELS[a.id],
    score: a.score,
    rationale: a.evidence.join(" · ") || PROFILE_LABELS[a.id],
  }));
}

export function routeDiscovery(concepts: StayConcept[]): {
  branches: DiscoveryBranch[];
  propertyDiscovery: boolean;
} {
  const profiles = new Set(concepts.flatMap((c) => c.profiles));
  const branches: DiscoveryBranch[] = [];
  if (profiles.has("city_lively") || profiles.has("city_discovery")) branches.push("urban");
  if (profiles.has("regional_explorer") || profiles.has("charm_escape")) branches.push("regional");
  if (profiles.has("outdoor_active") || profiles.has("nature_disconnect")) branches.push("outdoor");
  const propertyDiscovery =
    profiles.has("house_together") || profiles.has("exceptional_experience");
  if (propertyDiscovery) branches.push("property_led");
  return { branches: [...new Set(branches)], propertyDiscovery };
}
