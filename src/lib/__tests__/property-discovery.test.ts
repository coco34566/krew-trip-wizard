import { describe, expect, it } from "vitest";
import {
  buildPropertyQueries,
  normalizePropertySearchResult,
  propertyToAccommodationRow,
  shouldDiscoverProperties,
} from "../krew/property-discovery.server";

const house = {
  id: "house",
  title: "Maison entre nous",
  profiles: ["house_together" as const],
  score: 90,
  rationale: "",
};
const city = {
  id: "city",
  title: "City",
  profiles: ["city_lively" as const],
  score: 90,
  rationale: "",
};

describe("property-led discovery", () => {
  it("is disabled for a validated city-only profile", () => {
    expect(shouldDiscoverProperties({ concepts: [city], participants: 8 })).toBe(false);
    expect(buildPropertyQueries({ concepts: [city], participants: 8 })).toEqual([]);
  });

  it("builds bounded, targeted searches for Maison entre nous", () => {
    const queries = buildPropertyQueries({
      concepts: [house],
      participants: 12,
      territories: ["Dordogne"],
      amenities: ["piscine", "tennis"],
      activities: ["pétanque"],
      localMobility: "car_ok",
    });
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContain("12 personnes piscine tennis pétanque Dordogne");
  });

  it("normalizes public search facts without claiming verification", () => {
    const property = normalizePropertySearchResult(
      {
        title: "Grand domaine à Nogent-le-Rotrou - 14 personnes",
        link: "https://example.org/domaine",
        snippet: "7 chambres, piscine, spa et tennis · 2800 € le week-end",
      },
      "2026-08-16T00:00:00Z",
    )!;
    expect(property).toMatchObject({
      locality: "Nogent-le-Rotrou",
      capacity: { value: 14, state: "inferred" },
      priceVerified: false,
      availabilityVerified: false,
    });
    expect(property.amenities.map((item) => item.value)).toEqual(
      expect.arrayContaining(["piscine", "spa", "tennis"]),
    );
  });

  it("does not inject a property without a known price", () => {
    const property = normalizePropertySearchResult(
      { title: "Gîte à Apt - 12 personnes", link: "https://example.org/gite", snippet: "piscine" },
      "2026-08-16T00:00:00Z",
    )!;
    expect(propertyToAccommodationRow(property, "destination", 10, 2)).toBeNull();
  });

  it("does not inject a property with insufficient capacity", () => {
    const property = normalizePropertySearchResult(
      {
        title: "Villa à Apt - 8 personnes",
        link: "https://example.org/villa",
        snippet: "1200 € le week-end",
      },
      "2026-08-16T00:00:00Z",
    )!;
    expect(propertyToAccommodationRow(property, "destination", 10, 2)).toBeNull();
  });

  it("keeps compatible unverified offers exploratory instead of injecting them", () => {
    const property = normalizePropertySearchResult(
      {
        title: "Chalet à Vercors - 12 personnes",
        link: "https://example.org/chalet",
        snippet: "6 chambres sauna · 2400 € le week-end",
      },
      "2026-08-16T00:00:00Z",
    )!;
    expect(propertyToAccommodationRow(property, "new-destination", 12, 2)).toBeNull();
  });

  it("never converts an unknown price type", () => {
    const property = normalizePropertySearchResult({ title: "Domaine à Perche - 12 personnes", link: "https://example.org/perche", snippet: "2400 €" }, "2026-08-16T00:00:00Z")!;
    property.priceVerified = true; property.availabilityVerified = true; property.price!.state = "confirmed";
    expect(propertyToAccommodationRow(property, "perche", 12, 2)).toBeNull();
  });
});
