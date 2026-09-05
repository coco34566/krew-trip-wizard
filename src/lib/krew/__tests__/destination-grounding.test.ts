import { describe, expect, it } from "vitest";
import { buildGroundingQueries } from "../trip-service";

describe("buildGroundingQueries", () => {
  it("prioritizes concrete anchors over a compound territory label", () => {
    expect(
      buildGroundingQueries({
        name: "Côte d'Émeraude - Dinard & Saint-Malo",
        country: "France",
        anchor_places: ["Dinard", "Saint-Malo"],
      }),
    ).toEqual(["Dinard, France", "Saint-Malo, France", "Côte d'Émeraude - Dinard & Saint-Malo, France"]);
  });

  it("deduplicates anchors and falls back to the candidate name", () => {
    expect(
      buildGroundingQueries({
        name: "Annecy",
        country: "France",
        anchor_places: ["Annecy", "Annecy"],
      }),
    ).toEqual(["Annecy, France"]);
  });
});
