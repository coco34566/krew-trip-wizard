import { describe, expect, it } from "vitest";
import { selectValidatedStayConcepts, stayProfileValidationSchema } from "../trips.functions";
import type { StayConcept } from "../krew/stay-profiles";

import { PROFILE_LABELS, type StayProfileId } from "../krew/stay-profiles";

const concepts: StayConcept[] = ["city_lively", "city_discovery", "charm_escape"].map(
  (id, index) => ({
    id,
    title: PROFILE_LABELS[id as StayProfileId],
    profiles: [id as StayConcept["profiles"][number]],
    score: 90 - index,
    rationale: PROFILE_LABELS[id as StayProfileId],
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
      "Profil de voyage invalide",
    );
  });
  it("rejects a canonical concept ID if it was not proposed/calculated", () => {
    expect(() => selectValidatedStayConcepts(concepts, ["wellness_slow"])).toThrow(
      "Profil de voyage non proposé pour ce séjour",
    );
  });
  it("accepts a valid concept selected from legacy composite calculated concepts", () => {
    const legacyCalculated = [
      {
        profiles: ["house_together", "regional_explorer", "charm_escape"],
        title: "Une grande maison dans une belle région à explorer",
      },
    ] as any[];

    const selected = selectValidatedStayConcepts(legacyCalculated, ["regional_explorer"]);
    expect(selected).toEqual([
      {
        id: "regional_explorer",
        profiles: ["regional_explorer"],
        title: PROFILE_LABELS["regional_explorer"],
        score: 50,
        rationale: PROFILE_LABELS["regional_explorer"],
      },
    ]);
  });
});
