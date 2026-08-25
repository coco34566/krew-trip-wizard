import { describe, expect, it } from "vitest";
import { discoverCandidateDestinations } from "../krew/destination-discovery.server";

describe("destination discovery origins", () => {
  it("recomputes known city distances from the actual departure origin", () => {
    const results = discoverCandidateDestinations(
      {
        ambiances: ["fete"],
        activityCategories: ["bars_clubs"],
        budgetPerPerson: 1000,
        maxDistanceKm: 1500,
        nights: 2,
        startMonth: 6,
        excludedCountries: [],
        departureCity: "Lyon",
        departureOrigins: [{ city: "Lyon", count: 4 }],
        participants: 4,
        eventType: "evjf",
        discoveryBranches: ["urban"],
      },
      50,
    );
    const budapest = results.find((candidate) => candidate.name === "Budapest");
    expect(budapest).toBeDefined();
    expect(budapest!.distanceKm).toBeGreaterThan(900);
    expect(budapest!.distanceKm).toBeLessThan(1250);
  });
});
