import { describe, expect, it } from "vitest";
import { buildGroundingQueries } from "../trip-service";

describe("buildGroundingQueries", () => {
  it("prioritizes concrete anchor towns for a compound territory", () => {
    expect(buildGroundingQueries({
      name: "Côte d'Émeraude - Dinard & Saint-Malo",
      country: "France",
      anchor_places: ["Dinard", "Saint-Malo"],
    })).toEqual([
      "Dinard, France",
      "Saint-Malo, France",
      "Côte d'Émeraude - Dinard & Saint-Malo, France",
    ]);
  });
});
