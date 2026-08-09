import { describe, expect, it } from "vitest";
import {
  discoverCandidateDestinations,
  listCityProfilesForNames,
} from "../krew/destination-discovery.server";

describe("destination-discovery (lodgingFocus and new cities)", () => {
  it("should have lodgingFocus populated for listCityProfilesForNames", () => {
    const profiles = listCityProfilesForNames(["Luberon", "Budapest", "Ibiza"]);
    expect(profiles).toHaveLength(3);

    const luberon = profiles.find((p) => p.name === "Luberon")!;
    expect(luberon.lodgingFocus).toBe("maison_groupe");
    expect(luberon.country).toBe("France");

    const budapest = profiles.find((p) => p.name === "Budapest")!;
    expect(budapest.lodgingFocus).toBe("citybreak");

    const ibiza = profiles.find((p) => p.name === "Ibiza")!;
    expect(ibiza.lodgingFocus).toBe("les_deux");
  });

  it("should discover the newly added rural group destinations based on criteria", () => {
    const discovered = discoverCandidateDestinations({
      ambiances: ["detente", "culturel"],
      activityCategories: ["gastronomie", "culturel"],
      budgetPerPerson: 600,
      maxDistanceKm: 2000,
      nights: 3,
      startMonth: 6,
      excludedCountries: [],
      departureCity: "Paris",
      participants: 8,
    }, 15);

    expect(discovered.length).toBeGreaterThan(0);
    const names = discovered.map((d) => d.name);
    expect(names).toContain("Luberon");
    expect(names).toContain("Dordogne");
  });
});
