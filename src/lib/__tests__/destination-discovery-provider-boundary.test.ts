import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { refreshExternalCatalogForTrip } from "../external/search-hotels.functions";

const tripServiceSource = readFileSync(`${process.cwd()}/src/lib/krew/trip-service.ts`, "utf8");
const generationSource = tripServiceSource.slice(
  tripServiceSource.indexOf("export async function generateRecommendationsForTrip"),
);

describe("destination discovery external-provider boundary", () => {
  it("does not enrich the catalog or invoke accommodation/activity providers", () => {
    const forbiddenCalls = [
      "enrichCatalogWithExternalApis",
      "refreshExternalCatalogForTrip",
      "searchHotelsStayApi",
      "searchHotelsAllProviders",
      "searchActivitiesAllProviders",
      "discoverProperties",
      "TripAdvisor",
      "tripadvisor",
      "StayAPI",
      "stayapi",
    ];

    for (const providerCall of forbiddenCalls) {
      expect(
        generationSource,
        `${providerCall} must stay outside destination discovery`,
      ).not.toContain(providerCall);
    }
  });

  it("keeps the real StayAPI-backed accommodation refresh available to the Hotels stage", () => {
    const hotelRefreshSource = readFileSync(
      `${process.cwd()}/src/lib/external/search-hotels.functions.ts`,
      "utf8",
    );

    expect(refreshExternalCatalogForTrip).toBeTypeOf("function");
    expect(hotelRefreshSource).toContain("searchHotelsStayApi");
    expect(hotelRefreshSource).toContain('import("@/integrations/external/stayapi-hotels.server")');
  });
});
