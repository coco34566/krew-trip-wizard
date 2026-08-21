import { describe, expect, it } from "vitest";
import {
  selectValidatedStayConcepts,
  stayProfileValidationSchema,
} from "../trips.functions";
import { STAY_PROFILE_IDS, PROFILE_LABELS, type StayConcept, type StayProfileId } from "../krew/stay-profiles";
import { buildPlanningBrief } from "../krew/activity-ai.server";

describe("Stay Profile Refinements & Regressions", () => {
  describe("Profile Selection & Validation", () => {
    it("enforces minimum 1 and maximum 3 canonical profiles", () => {
      expect(() => stayProfileValidationSchema.parse({ tripId: "11111111-1111-4111-8111-111111111111", selectedConceptIds: [] })).toThrow();
      expect(() =>
        stayProfileValidationSchema.parse({
          tripId: "11111111-1111-4111-8111-111111111111",
          selectedConceptIds: ["city_lively", "city_discovery", "charm_escape", "regional_explorer"],
        }),
      ).toThrow();

      const parsed = stayProfileValidationSchema.parse({
        tripId: "11111111-1111-4111-8111-111111111111",
        selectedConceptIds: ["house_together", "regional_explorer"],
      });
      expect(parsed.selectedConceptIds).toEqual(["house_together", "regional_explorer"]);
    });

    it("accepts only canonical profile IDs", () => {
      const concepts: StayConcept[] = [
        { id: "house_together", title: "Maison entre nous", profiles: ["house_together"], score: 80, rationale: "" },
      ];
      expect(() => selectValidatedStayConcepts(concepts, ["fake_profile"])).toThrow("Profil de voyage invalide");

      const selected = selectValidatedStayConcepts(concepts, ["house_together"]);
      expect(selected).toHaveLength(1);
      expect(selected[0]?.id).toBe("house_together");
      expect(selected[0]?.title).toBe("Maison entre nous");
    });
  });

  describe("geographyPolicy & Preference Signals", () => {
    it("respects regional_explorer without defaulting to city policy", () => {
      const brief = buildPlanningBrief({
        destination: "Dordogne",
        nights: 2,
        participants: 6,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["regional_explorer"],
      });
      expect(brief.validatedTripProfiles).toContain("regional_explorer");
    });

    it("respects house_together or centerpiece lodging as home policy", () => {
      const briefHome = buildPlanningBrief({
        destination: "Luberon",
        nights: 2,
        participants: 8,
        budgetPerPerson: 500,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["house_together"],
      });
      expect(briefHome.validatedTripProfiles).toContain("house_together");
    });
  });
});
