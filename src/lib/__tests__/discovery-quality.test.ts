import { describe, expect, it } from "vitest";
import { attachAnchorEnrichments, normalizeActivityCategory } from "../krew/discovery-enrichment";
import { onsiteActivityCategories, resolvePropertyDestination } from "../krew/property-discovery.server";
import { aggregateLocalMobility } from "../krew/trip-service";
import { buildProposals, type AccommodationRecord, type DestinationRecord, type ScoringContext, type TravelCatalog } from "../krew/engine";

const destination = (id: string, name: string, anchors: string[], type: NonNullable<DestinationRecord["destination_type"]>): DestinationRecord => ({
  id, slug: id, name, country: "France", description: null, image_url: null,
  avg_daily_cost: 80, distance_from_paris_km: 300, popularity: 0.7, rating: 4.2,
  best_months: [5, 6, 7], score_fete: 0.4, score_aventure: 0.8, score_detente: 0.8,
  score_luxe: 0.5, score_insolite: 0.6, score_sportif: 0.9, score_culturel: 0.7,
  destination_type: type, anchor_places: anchors,
});

const baseContext: ScoringContext = {
  participants: 8, budgetPerPerson: 900, nights: 2, letKrewDecide: true,
  needsCityCenter: false, startMonth: 6, ambiances: [], activityCategories: ["sport"],
  maxDistanceKm: 1000, excludedCountries: [], datesVerified: true,
};

const accommodation = (id: string, destinationId: string, onsite: string[] = [], source = "stayapi"): AccommodationRecord => ({
  id, destination_id: destinationId, name: id, type: "villa", description: null,
  price_per_night_per_person: 70, capacity: 10, rating: 4.5, distance_center_km: 20,
  image_url: null, source, onsite_activity_categories: onsite,
  ...(source.startsWith("property_web:") ? { price_verified: true, availability_verified: true, verification_state: "confirmed" as const } : {}),
});

describe("territory and property discovery quality", () => {
  it("attaches Luberon anchor activities to the parent territory", () => {
    const luberon = destination("luberon", "Luberon", ["Lourmarin", "Gordes"], "region_territory");
    const lourmarin = destination("lourmarin", "Lourmarin", [], "town_village");
    const gordes = destination("gordes", "Gordes", [], "town_village");
    const catalog = attachAnchorEnrichments({ destinations: [luberon, lourmarin, gordes], accommodations: [], activities: [
      { id: "wine", destination_id: "lourmarin", name: "Œnologie", category: "gastronomie", description: null, price_per_person: 20, duration_hours: 2, rating: 4.5, image_url: null },
      { id: "hike", destination_id: "gordes", name: "Randonnée", category: "sport", description: null, price_per_person: 0, duration_hours: 3, rating: 4.5, image_url: null },
    ] }, [luberon]);
    expect(catalog.activities.map((activity) => activity.destination_id)).toEqual(["luberon", "luberon"]);
    expect(buildProposals(catalog, baseContext, 1)[0]?.subScores.sActivities).toBe(1);
  });

  it("attaches a Bonnieux accommodation to Luberon", () => {
    const luberon = destination("luberon", "Luberon", ["Bonnieux"], "region_territory");
    const bonnieux = destination("bonnieux", "Bonnieux", [], "town_village");
    const catalog = attachAnchorEnrichments({ destinations: [luberon, bonnieux], activities: [], accommodations: [accommodation("house", "bonnieux")] }, [luberon]);
    expect(catalog.accommodations[0]?.destination_id).toBe("luberon");
  });

  it("attaches Villard-de-Lans activities to Vercors", () => {
    const vercors = destination("vercors", "Vercors", ["Villard-de-Lans"], "outdoor_area");
    const anchor = destination("villard", "Villard-de-Lans", [], "town_village");
    const catalog = attachAnchorEnrichments({ destinations: [vercors, anchor], accommodations: [accommodation("chalet", "vercors")], activities: [
      { id: "trail", destination_id: "villard", name: "Trail", category: "sport", description: null, price_per_person: 0, duration_hours: 3, rating: 4.7, image_url: null },
    ] }, [vercors]);
    expect(buildProposals(catalog, baseContext, 1)[0]?.subScores.sActivities).toBe(1);
  });

  it("deduplicates the same anchor activity", () => {
    const luberon = destination("luberon", "Luberon", ["Gordes", "Bonnieux"], "region_territory");
    const rows = ["gordes", "bonnieux"].map((destination_id, index) => ({ id: `hike-${index}`, destination_id, external_id: "provider-hike", source: "provider", name: "Randonnée ocre", category: "sport", description: null, price_per_person: 0, duration_hours: 2, rating: 4.4, image_url: null }));
    const catalog = attachAnchorEnrichments({ destinations: [luberon, destination("gordes", "Gordes", [], "town_village"), destination("bonnieux", "Bonnieux", [], "town_village")], accommodations: [], activities: rows }, [luberon]);
    expect(catalog.activities).toHaveLength(1);
    expect(catalog.destinations.map((candidate) => candidate.name)).toEqual(["Luberon"]);
  });

  it("maps only verified onsite sports and wellness", () => {
    expect(onsiteActivityCategories([{ value: "tennis", state: "confirmed" }, { value: "vélos", state: "confirmed" }, { value: "spa", state: "confirmed" }, { value: "kayak", state: "inferred" }]))
      .toEqual(expect.arrayContaining(["sport", "detente"]));
    expect(onsiteActivityCategories([{ value: "kayak", state: "inferred" }])).toEqual([]);
  });

  it("normalizes provider anchor activities into KREW categories", () => {
    expect(normalizeActivityCategory("Randonnée des ocres", "Outdoor")).toBe("sport");
    expect(normalizeActivityCategory("Dégustation de vins", "Food tour")).toBe("gastronomie");
  });

  it("onsite sport increases property activity matching", () => {
    const area = destination("estate-area", "Perche", [], "region_territory");
    const without = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("estate", area.id, [], "property_web:source")] }, { ...baseContext, groupLocalMobility: "car_ok" }, 1)[0]!;
    const withSport = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("estate", area.id, ["sport"], "property_web:source")] }, { ...baseContext, groupLocalMobility: "car_ok" }, 1)[0]!;
    expect(withSport.subScores.sActivities).toBeGreaterThan(without.subScores.sActivities);
  });

  it("onsite wellness satisfies a détente activity wish", () => {
    const area = destination("spa-area", "Touraine", [], "region_territory");
    const proposal = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("spa-estate", area.id, ["detente"], "property_web:source")] }, { ...baseContext, activityCategories: ["detente"] }, 1)[0]!;
    expect(proposal.subScores.sActivities).toBe(1);
  });

  it("penalizes an isolated car-dependent house for a walk/transit group", () => {
    const area = destination("rural", "Campagne", [], "region_territory");
    const walk = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("isolated", area.id, [], "property_web:source")] }, { ...baseContext, groupLocalMobility: "walk_transit" }, 1)[0]!;
    const car = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("isolated", area.id, [], "property_web:source")] }, { ...baseContext, groupLocalMobility: "car_ok" }, 1)[0]!;
    expect(walk.score).toBeLessThan(car.score);
  });

  it("keeps a self-contained estate viable for a walk/transit group", () => {
    const area = destination("autonomous", "Domaine", [], "region_territory");
    const isolated = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("isolated", area.id, [], "property_web:source")] }, { ...baseContext, groupLocalMobility: "walk_transit" }, 1)[0]!;
    const autonomous = buildProposals({ destinations: [area], activities: [], accommodations: [accommodation("autonomous", area.id, ["sport", "detente", "gastronomie", "culture"], "property_web:source")] }, { ...baseContext, groupLocalMobility: "walk_transit" }, 1)[0]!;
    expect(autonomous.score).toBeGreaterThan(isolated.score);
  });

  it("aggregates mobility instead of selecting the first answer", () => {
    expect(aggregateLocalMobility([{ localMobility: "car_ok" }, { localMobility: "walk_transit" }, { localMobility: "walk_transit" }]).value).toBe("walk_transit");
  });

  it("preserves Star weighting in mobility aggregation", () => {
    expect(aggregateLocalMobility([{ localMobility: "car_ok" }, { localMobility: "car_ok" }, { localMobility: "walk_transit", weight: 3.2 }]).value).toBe("walk_transit");
  });

  it("prefers a resolved rural territory over an unusable fallback", () => {
    expect(resolvePropertyDestination({ region: "Perche", locality: "Hameau des Bois", country: "France" })).toEqual({ name: "Perche", country: "France" });
    expect(resolvePropertyDestination({})).toBeNull();
  });
});
