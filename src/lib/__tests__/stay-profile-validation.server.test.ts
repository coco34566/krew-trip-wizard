import { describe, expect, it } from "vitest";
import { selectValidatedStayConcepts, stayProfileValidationSchema } from "../trips.functions";
import type { StayConcept } from "../krew/stay-profiles";

const concepts: StayConcept[] = ["city_lively", "city_discovery", "charm_escape"].map(
  (id, index) => ({
    id,
    title: id,
    profiles: [id as StayConcept["profiles"][number]],
    score: 90 - index,
    rationale: "test",
  }),
);
const tripId = "11111111-1111-4111-8111-111111111111";

describe("server stay profile validation", () => {
  it("rejects an empty selection", () => {
    expect(() => stayProfileValidationSchema.parse({ tripId, selectedConceptIds: [] })).toThrow();
  });
  it("accepts one valid concept", () => {
    const data = stayProfileValidationSchema.parse({
      tripId,
      selectedConceptIds: [concepts[0]!.id],
    });
    expect(selectValidatedStayConcepts(concepts, data.selectedConceptIds)).toEqual([concepts[0]]);
  });
  it("accepts three valid concepts", () => {
    const ids = concepts.map((concept) => concept.id);
    expect(
      selectValidatedStayConcepts(
        concepts,
        stayProfileValidationSchema.parse({ tripId, selectedConceptIds: ids }).selectedConceptIds,
      ),
    ).toHaveLength(3);
  });
  it("rejects four concepts", () => {
    expect(() =>
      stayProfileValidationSchema.parse({ tripId, selectedConceptIds: ["a", "b", "c", "d"] }),
    ).toThrow();
  });
  it("rejects an unknown concept id", () => {
    expect(() => selectValidatedStayConcepts(concepts, ["unknown"])).toThrow(
      "Concept de voyage invalide",
    );
  });
  it("rejects validation when no concept was calculated", () => {
    expect(() => selectValidatedStayConcepts([], ["city_lively"])).toThrow(
      "Aucun concept de voyage calculé",
    );
  });
});
