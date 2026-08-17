import type {
  AccommodationRole,
  LocalMobilityPreference,
  ProfileAffinity,
  StayProfileId,
} from "./stay-profiles";

export const ACCOMMODATION_CONCEPT_IDS = [
  "central_hotel",
  "comfort_hotel",
  "aparthotel",
  "entire_city_home",
  "group_house",
  "nature_stay",
  "exceptional_property",
  "wellness_property",
] as const;
export type AccommodationConceptId = (typeof ACCOMMODATION_CONCEPT_IDS)[number];
export type AccommodationLocationIntent =
  "hyper_central" | "central" | "near_activity_hub" | "regional_flexible" | "remote_desired";
export type AccommodationConceptScore = { concept: AccommodationConceptId; score: number };

export const ACCOMMODATION_PROPERTY_TYPES: Record<AccommodationConceptId, string[]> = {
  central_hotel: ["hotel", "boutique_hotel"],
  comfort_hotel: ["hotel", "boutique_hotel"],
  aparthotel: ["aparthotel"],
  entire_city_home: ["entire_apartment", "entire_home"],
  group_house: ["house", "villa", "gite", "entire_home"],
  nature_stay: ["chalet", "lodge", "gite", "cabin", "nature_hotel"],
  exceptional_property: ["villa", "estate", "domain", "boutique_hotel", "unique_stay"],
  wellness_property: ["spa_hotel", "resort", "wellness_retreat", "villa"],
};

const weights: Record<AccommodationConceptId, Partial<Record<StayProfileId, number>>> = {
  central_hotel: { city_lively: 0.55, city_discovery: 0.45 },
  comfort_hotel: {
    city_discovery: 0.35,
    charm_escape: 0.25,
    wellness_slow: 0.25,
    exceptional_experience: 0.15,
  },
  aparthotel: {
    city_discovery: 0.35,
    city_lively: 0.25,
    house_together: 0.25,
    regional_explorer: 0.15,
  },
  entire_city_home: {
    house_together: 0.35,
    city_discovery: 0.3,
    city_lively: 0.2,
    charm_escape: 0.15,
  },
  group_house: {
    house_together: 0.45,
    regional_explorer: 0.2,
    charm_escape: 0.15,
    nature_disconnect: 0.1,
    wellness_slow: 0.1,
  },
  nature_stay: {
    nature_disconnect: 0.35,
    outdoor_active: 0.3,
    regional_explorer: 0.2,
    charm_escape: 0.15,
  },
  exceptional_property: {
    exceptional_experience: 0.55,
    house_together: 0.2,
    charm_escape: 0.15,
    wellness_slow: 0.1,
  },
  wellness_property: {
    wellness_slow: 0.55,
    nature_disconnect: 0.2,
    exceptional_experience: 0.15,
    house_together: 0.1,
  },
};
const add = (
  target: Partial<Record<AccommodationConceptId, number>>,
  values: Partial<Record<AccommodationConceptId, number>>,
) =>
  Object.entries(values).forEach(([id, value]) => {
    target[id as AccommodationConceptId] =
      (target[id as AccommodationConceptId] ?? 0) + (value ?? 0);
  });

export function scoreAccommodationConcepts(input: {
  affinities: ProfileAffinity[];
  ageRange?: string | null;
  groupSize: number;
  needsCityCenter?: boolean | null;
}): AccommodationConceptScore[] {
  const profiles = Object.fromEntries(
    input.affinities.map(({ id, score }) => [id, score]),
  ) as Partial<Record<StayProfileId, number>>;
  const modifiers: Partial<Record<AccommodationConceptId, number>> = {};
  const age = input.ageRange ?? "";
  if (/18\s*[-–]\s*25/.test(age))
    add(modifiers, { entire_city_home: 5, aparthotel: 4, comfort_hotel: -3 });
  else if (/35\s*[-–]\s*45/.test(age)) add(modifiers, { aparthotel: 2, comfort_hotel: 3 });
  else if (/45\s*[-–]\s*60/.test(age))
    add(modifiers, { comfort_hotel: 5, aparthotel: 3, entire_city_home: -3 });
  else if (/60\+|60\s*(?:ans)?\s*et\s*plus/i.test(age))
    add(modifiers, { comfort_hotel: 7, aparthotel: 4, entire_city_home: -5 });
  if (input.groupSize <= 4)
    add(modifiers, { central_hotel: 3, comfort_hotel: 3, entire_city_home: 3 });
  else if (input.groupSize <= 8)
    add(modifiers, { aparthotel: 4, entire_city_home: 5, group_house: 5 });
  else if (input.groupSize <= 12)
    add(modifiers, { group_house: 8, aparthotel: 5, exceptional_property: 3 });
  else add(modifiers, { group_house: 10, exceptional_property: 5, entire_city_home: -4 });
  if (input.needsCityCenter === true)
    add(modifiers, {
      central_hotel: 6,
      aparthotel: 4,
      entire_city_home: 4,
      group_house: -3,
      nature_stay: -5,
    });
  return ACCOMMODATION_CONCEPT_IDS.map((concept) => ({
    concept,
    score: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          Object.entries(weights[concept]).reduce(
            (sum, [id, weight]) => sum + (profiles[id as StayProfileId] ?? 0) * (weight ?? 0),
            0,
          ) + (modifiers[concept] ?? 0),
        ),
      ),
    ),
  })).sort((a, b) => b.score - a.score);
}

export function calculateRoomConfiguration(participants: number, singleRooms: number) {
  const singles = Math.max(0, Math.min(participants, singleRooms));
  const doubleRooms = Math.ceil((participants - singles) / 2);
  return {
    size: participants,
    singleRooms: singles,
    doubleRooms,
    targetBedrooms: singles + doubleRooms,
    minCapacity: participants,
  };
}

export function resolveAccommodationLocationIntent(input: {
  topProfiles: StayProfileId[];
  localMobility?: LocalMobilityPreference | null;
  accommodationRole?: AccommodationRole | null;
  needsCityCenter?: boolean | null;
}): AccommodationLocationIntent {
  const [top] = input.topProfiles;
  if (input.topProfiles.includes("city_lively") && input.localMobility === "walk_transit")
    return "hyper_central";
  if (input.topProfiles.includes("city_discovery") && input.localMobility === "walk_transit")
    return "central";
  if (top === "outdoor_active") return "near_activity_hub";
  if (
    top === "regional_explorer" &&
    ["car_ok", "car_if_worth_it"].includes(input.localMobility ?? "")
  )
    return "regional_flexible";
  if (top === "nature_disconnect" && input.accommodationRole === "centerpiece")
    return "remote_desired";
  return input.needsCityCenter === true ? "central" : "regional_flexible";
}

export function selectAccommodationStrategies(
  scores: AccommodationConceptScore[],
): AccommodationConceptScore[] {
  if (!scores.length) return [];
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const selected = sorted
    .filter((item, i) => i === 0 || item.score >= sorted[0]!.score - 15)
    .slice(0, 3);
  const family = (id: AccommodationConceptId) =>
    ["group_house", "exceptional_property", "wellness_property", "nature_stay"].includes(id)
      ? "property"
      : "urban";
  if (selected.length === 2 && family(selected[0]!.concept) === family(selected[1]!.concept)) {
    const alternative = sorted.find(
      (item) => family(item.concept) !== family(selected[0]!.concept) && item.score >= 60,
    );
    if (alternative) selected.push(alternative);
  }
  return selected;
}

export function resultsAllocation(count: number): number[] {
  return count <= 1 ? [5] : count === 2 ? [3, 2] : [3, 2, 1];
}
