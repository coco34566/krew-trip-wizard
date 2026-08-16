import { describe, expect, it } from "vitest";
import { discoverCandidateDestinations } from "../krew/destination-discovery.server";
import { parseDiscoveryCandidates } from "../krew/destination-ai.server";

const base = {
  ambiances: ["detente"],
  activityCategories: [],
  budgetPerPerson: 600,
  maxDistanceKm: 2000,
  nights: 3,
  startMonth: 6,
  excludedCountries: [],
  departureCity: "Paris",
  participants: 6,
};

describe("Discovery Router destination shapes", () => {
  it.each(["city_lively", "city_discovery"])("keeps %s on real cities", () => {
    const found = discoverCandidateDestinations({ ...base, discoveryBranches: ["urban"] }, 8);
    expect(found.length).toBeGreaterThan(0);
    expect(
      found.every(
        (candidate) =>
          candidate.destinationType === "city" && candidate.anchorPlaces?.[0] === candidate.name,
      ),
    ).toBe(true);
  });

  it("discovers territories for house + region + charm", () => {
    const found = discoverCandidateDestinations(
      { ...base, discoveryBranches: ["regional"], accommodationRole: "centerpiece" },
      10,
    );
    expect(
      found.some(
        (candidate) =>
          candidate.destinationType === "region_territory" && candidate.name === "Luberon",
      ),
    ).toBe(true);
    expect(found.find((candidate) => candidate.name === "Luberon")?.anchorPlaces).toContain(
      "Gordes",
    );
  });

  it("discovers outdoor areas matching requested activities", () => {
    const found = discoverCandidateDestinations(
      { ...base, discoveryBranches: ["outdoor"], activityCategories: ["ski", "randonnée"] },
      10,
    );
    expect(
      found.some(
        (candidate) => candidate.destinationType === "outdoor_area" && candidate.name === "Vercors",
      ),
    ).toBe(true);
    expect(found.every((candidate) => candidate.destinationType !== "city")).toBe(true);
  });

  it("allows mixed profiles without quotas", () => {
    const found = discoverCandidateDestinations(
      { ...base, discoveryBranches: ["urban", "regional", "outdoor"] },
      20,
    );
    expect(new Set(found.map((candidate) => candidate.destinationType)).size).toBeGreaterThan(1);
  });

  it("keeps no-car mobility meaningful", () => {
    const walking = discoverCandidateDestinations(
      { ...base, discoveryBranches: ["regional", "outdoor"], localMobility: "walk_transit" },
      20,
    );
    expect(walking.find((candidate) => candidate.name === "Côte basque")!.affinity).toBeGreaterThan(
      walking.find((candidate) => candidate.name === "Luberon")!.affinity,
    );
  });

  it("parses provider-independent territories and legacy cities", () => {
    const modern = parseDiscoveryCandidates(
      JSON.stringify({
        destinations: [
          {
            title: "Dolomites",
            country: "Italie",
            region: "Trentin",
            destinationType: "outdoor_area",
            anchorPlaces: ["Cortina"],
            why: "ski",
          },
        ],
      }),
    );
    expect(modern[0]).toMatchObject({
      name: "Dolomites",
      destinationType: "outdoor_area",
      anchorPlaces: ["Cortina"],
    });
    const legacy = parseDiscoveryCandidates(
      '{"cities":[{"name":"Lisbonne","country":"Portugal","why":"culture"}]}',
    );
    expect(legacy[0]).toMatchObject({
      name: "Lisbonne",
      destinationType: "city",
      anchorPlaces: ["Lisbonne"],
    });
  });
});
