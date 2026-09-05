import { describe, expect, it } from "vitest";

import {
  destinationGeographyAnchors,
  destinationGeographyMatches,
} from "@/lib/krew/planning-map-geography";

describe("planning map regional geography matching", () => {
  it("extracts meaningful anchors from a regional destination label", () => {
    expect(destinationGeographyAnchors("Côte de Cascais & Sintra")).toEqual(["cascais", "sintra"]);
  });

  it("accepts a Cascais geocoding result for Côte de Cascais & Sintra", () => {
    expect(
      destinationGeographyMatches(
        "Côte de Cascais & Sintra",
        "Cascais, Lisboa, Portugal",
      ),
    ).toBe(true);
  });

  it("accepts a Sintra geocoding result for Côte de Cascais & Sintra", () => {
    expect(
      destinationGeographyMatches(
        "Côte de Cascais & Sintra",
        "Sintra, Lisboa, Portugal",
      ),
    ).toBe(true);
  });

  it("still rejects an unrelated geography", () => {
    expect(
      destinationGeographyMatches(
        "Côte de Cascais & Sintra",
        "Porto, Portugal",
      ),
    ).toBe(false);
  });

  it("keeps simple city matching strict", () => {
    expect(destinationGeographyMatches("Paris", "Paris, Île-de-France, France")).toBe(true);
    expect(destinationGeographyMatches("Paris", "Lyon, Auvergne-Rhône-Alpes, France")).toBe(false);
  });
});
