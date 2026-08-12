import { describe, expect, it } from "vitest";
import { buildGroupTravelProfile, QUESTIONNAIRE_SIGNAL_MAPPING } from "../krew/group-profile";

describe("group travel profile normalization", () => {
  it("exposes hard constraints, soft preferences and questionnaire mapping", () => {
    const profile = buildGroupTravelProfile({
      participants: 4,
      budgetPerPerson: 350,
      nights: 2,
      ambiances: ["fete"],
      activityCategories: ["bars_clubs"],
      maxDistanceKm: 2000,
      excludedCountries: [],
      letKrewDecide: true,
      needsCityCenter: true,
      startMonth: 6,
      transportModes: ["train", "voiture"],
      maxTravelDurationHours: 4,
      wantedEnvTypes: ["Centre-ville / urbain"],
      groupAgeRange: "20-25",
      vetoBudgetMax: 300,
    });

    expect(profile.hardConstraints.budgetVeto).toBe(300);
    expect(profile.hardConstraints.maxTravelDurationHours).toBe(4);
    expect(profile.softPreferences.environment).toContain("Centre-ville / urbain");
    expect(QUESTIONNAIRE_SIGNAL_MAPPING.some((m) => m.field.includes("transport_mode_accepted") && m.hardConstraint && m.apiQuery)).toBe(true);
  });
});
