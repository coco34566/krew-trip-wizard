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
    it("evaluates regional_explorer as regional policy with 30km radius", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Dordogne",
        nights: 2,
        participants: 6,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["regional_explorer"],
      });
      expect(policy).toEqual({ maxKm: 30, profile: "regional" });
    });

    it("evaluates charm_escape as regional policy with 30km radius", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Provence",
        nights: 2,
        participants: 6,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["charm_escape"],
      });
      expect(policy).toEqual({ maxKm: 30, profile: "regional" });
    });

    it("evaluates house_together as home policy with 8km radius", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Luberon",
        nights: 2,
        participants: 8,
        budgetPerPerson: 500,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["house_together"],
      });
      expect(policy).toEqual({ maxKm: 8, profile: "home" });
    });

    it("evaluates outdoor_active as outdoor policy with 30km radius", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Chamonix",
        nights: 2,
        participants: 4,
        budgetPerPerson: 500,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["outdoor_active"],
      });
      expect(policy).toEqual({ maxKm: 30, profile: "outdoor" });
    });

    it("evaluates nature_disconnect as outdoor policy with 30km radius", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Vosges",
        nights: 2,
        participants: 4,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["nature_disconnect"],
      });
      expect(policy).toEqual({ maxKm: 30, profile: "outdoor" });
    });

    it("evaluates groupAccommodationRole === centerpiece as home policy", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Annecy",
        nights: 2,
        participants: 6,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        validatedTripProfiles: ["city_discovery"],
        groupAccommodationRole: "centerpiece",
      });
      expect(policy).toEqual({ maxKm: 8, profile: "home" });
    });

    it("evaluates environmental signals (e.g. montagne/nature in wantedEnvTypes) as outdoor policy", async () => {
      const { geographyPolicy } = await import("../krew/activity-ai.server");
      const policy = geographyPolicy({
        destination: "Pyénées",
        nights: 2,
        participants: 6,
        budgetPerPerson: 400,
        ambiances: [],
        activityCategories: [],
        wantedEnvTypes: ["montagne"],
      });
      expect(policy).toEqual({ maxKm: 30, profile: "outdoor" });
    });
  });
});
