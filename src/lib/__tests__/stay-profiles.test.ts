import { describe, expect, it } from "vitest";
import {
  aggregateStayProfiles,
  buildStayConcepts,
  calculateStayProfileAffinities,
  routeDiscovery,
} from "../krew/stay-profiles";
import {
  buildPropertyQueries,
  discoverProperties,
  shouldDiscoverProperties,
} from "../krew/property-discovery.server";

const score = (input: Parameters<typeof calculateStayProfileAffinities>[0], id: string) =>
  calculateStayProfileAffinities(input).find((p) => p.id === id)!.score;

describe("stay profile discovery", () => {
  it("routes an obvious lively city trip only toward urban discovery", () => {
    const a = calculateStayProfileAffinities({
      wantedEnvType: "Centre-ville / urbain, Quartier animé",
      ambiances: ["fete"],
      activityCategories: ["bars_clubs", "soirees"],
      travelPace: "plein_programme",
      localMobility: "walk_transit",
      accommodationRole: "base_only",
    });
    const route = routeDiscovery(buildStayConcepts(a, 1));
    expect(a[0]?.id).toBe("city_lively");
    expect(route.branches).toEqual(["urban"]);
    expect(route.propertyDiscovery).toBe(false);
  });
  it("recognises cultural city discovery", () =>
    expect(
      score(
        {
          wantedEnvType: "Centre-ville / urbain",
          activityCategories: ["culturel", "gastronomie"],
          travelPace: "equilibre",
        },
        "city_discovery",
      ),
    ).toBeGreaterThan(65));
  it("selects top canonical profiles without composite titles", () => {
    const concepts = buildStayConcepts(
      calculateStayProfileAffinities({
        wantedEnvType: "Village de charme, Nature",
        activityCategories: ["gastronomie"],
        requiredAmenities: ["maison"],
        travelPace: "equilibre",
        localMobility: "car_ok",
        accommodationRole: "centerpiece",
      }),
    );
    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.every((c) => c.profiles.length === 1)).toBe(true);
    expect(
      concepts.some(
        (c) => c.profiles[0] === "house_together" || c.profiles[0] === "regional_explorer" || c.profiles[0] === "charm_escape",
      ),
    ).toBe(true);
  });
  it("routes nature and sport toward outdoor zones", () =>
    expect(
      routeDiscovery(
        buildStayConcepts(
          calculateStayProfileAffinities({
            wantedEnvType: "Montagne, Lac / rivière",
            activityCategories: ["randonnée", "vélo"],
            travelPace: "plein_programme",
          }),
        ),
      ).branches,
    ).toContain("outdoor"));
  it("activates property discovery only from strong property concepts", () => {
    const concepts = buildStayConcepts(
      calculateStayProfileAffinities({
        requiredAmenities: ["maison", "piscine"],
        ambiances: ["insolite"],
        accommodationRole: "centerpiece",
      }),
    );
    expect(shouldDiscoverProperties({ concepts, participants: 12 })).toBe(true);
    expect(
      buildPropertyQueries({
        concepts,
        participants: 12,
        territories: ["Dordogne"],
        amenities: ["piscine"],
      })[0],
    ).toContain("12 personnes piscine Dordogne");
  });
  it("finds a coherent slow nature profile", () =>
    expect(
      score(
        { wantedEnvType: "Nature", ambiances: ["detente"], travelPace: "chill" },
        "wellness_slow",
      ),
    ).toBeGreaterThan(50));
  it("allows several branches for mixed concepts", () =>
    expect(
      routeDiscovery([
        {
          id: "mixed",
          title: "mix",
          profiles: ["city_discovery", "regional_explorer"],
          score: 80,
          rationale: "",
        },
      ]).branches,
    ).toEqual(["urban", "regional"]));
  it("uses no-car as a soft negative, not a hard exclusion", () =>
    expect(
      score(
        { wantedEnvType: "Village de charme", localMobility: "walk_transit" },
        "regional_explorer",
      ),
    ).toBeGreaterThan(0));
  it("preserves Star weighting while retaining minimum satisfaction", () => {
    const result = aggregateStayProfiles([
      { wantedEnvType: "urbain" },
      { wantedEnvType: "nature", isStar: true, weight: 3.2 },
    ]);
    expect(result.find((p) => p.id === "nature_disconnect")!.score).toBeGreaterThan(
      result.find((p) => p.id === "city_lively")!.score,
    );
  });
  it("is neutral for historical trips without the new fields", () =>
    expect(() => aggregateStayProfiles([{ ambiances: [] }])).not.toThrow());
  it("does not impose city candidates on a house/nature group", () => {
    const route = routeDiscovery(
      buildStayConcepts(
        calculateStayProfileAffinities({
          wantedEnvType: "Nature",
          requiredAmenities: ["maison"],
          accommodationRole: "centerpiece",
          travelPace: "chill",
        }),
        1,
      ),
    );
    expect(route.branches).not.toContain("urban");
  });
  it("does not impose property candidates on a very urban group", () =>
    expect(
      routeDiscovery(
        buildStayConcepts(
          calculateStayProfileAffinities({
            wantedEnvType: "Centre-ville / urbain",
            activityCategories: ["bars_clubs"],
            accommodationRole: "base_only",
          }),
          1,
        ),
      ).propertyDiscovery,
    ).toBe(false));
  it("does not make budget part of profile affinity", () =>
    expect(calculateStayProfileAffinities({ ambiances: ["insolite"] })).toEqual(
      calculateStayProfileAffinities({ ambiances: ["insolite"] }),
    ));
  it("returns at most three justified concepts without padding", () =>
    expect(
      buildStayConcepts([
        { id: "city_lively", score: 90, evidence: [] },
        ...(
          [
            "city_discovery",
            "charm_escape",
            "regional_explorer",
            "house_together",
            "nature_disconnect",
            "exceptional_experience",
            "outdoor_active",
            "wellness_slow",
          ] as const
        ).map((id) => ({ id, score: 0, evidence: [] })),
      ], 1),
    ).toHaveLength(1));
  it("continues cleanly when property search is unavailable", async () => {
    const previous = process.env["SERPER_API_KEY"];
    delete process.env["SERPER_API_KEY"];
    await expect(
      discoverProperties({
        concepts: [
          { id: "h", title: "Maison", profiles: ["house_together"], score: 80, rationale: "" },
        ],
        participants: 10,
      }),
    ).resolves.toEqual([]);
    if (previous) process.env["SERPER_API_KEY"] = previous;
  });
});
