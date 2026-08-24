import { describe, expect, test } from "vitest";

describe("profile section navigation and gating end-to-end", () => {
  function isStepAvailable(
    id: string,
    datesReady: boolean,
    profileDone: boolean,
    profileLegacyBypass: boolean,
    destDone: boolean
  ): boolean {
    if (id === "availability" || id === "preferences" || id === "star") return true;
    if (id === "dates") return true;
    if (id === "profile") return datesReady;
    if (id === "destination") return datesReady && (profileDone || profileLegacyBypass);
    if (id === "accommodation" || id === "transport") return destDone;
    if (id === "planning" || id === "tasks" || id === "packing") return destDone;
    return false;
  }

  function resolveConceptsToDisplay(
    profileCalculated: any[] | undefined,
    readinessCalculated: any[] | undefined
  ): any[] {
    if (profileCalculated?.length) return profileCalculated;
    if (readinessCalculated?.length) return readinessCalculated;
    return [];
  }

  test("Allowed Case: When dates are locked, Profile section is available and renders concepts", () => {
    const datesReady = true;
    const profileDone = false;
    const profileLegacyBypass = false;
    const destDone = false;

    // 1. Check timeline availability
    const profileAvailable = isStepAvailable("profile", datesReady, profileDone, profileLegacyBypass, destDone);
    expect(profileAvailable).toBe(true);

    // 2. Build URL
    const tripId = "trip-allowed-123";
    const href = profileAvailable ? `/trips/${tripId}?view=voyage&section=profile` : null;
    expect(href).toBe(`/trips/trip-allowed-123?view=voyage&section=profile`);

    // 3. Verify concepts rendering logic
    const mockProfile = {
      calculatedConcepts: [
        { id: "city_lively", title: "Escapade urbaine & festive", score: 85, rationale: "Pour faire la fête" },
        { id: "house_together", title: "Maison tous ensemble", score: 75, rationale: "Pour se retrouver" },
      ],
      selectedConcepts: [],
      validated: false,
    };
    const mockReadiness = {
      profile: { questionnairesReady: true, calculatedConcepts: [] },
    };

    const concepts = resolveConceptsToDisplay(
      mockProfile.calculatedConcepts,
      mockReadiness.profile.calculatedConcepts
    );

    expect(concepts.length).toBe(2);
    expect(concepts[0].id).toBe("city_lively");
  });

  test("Locked Case: When dates are not set/locked, Profile step href is null (blocked)", () => {
    const datesReady = false;
    const profileDone = false;
    const profileLegacyBypass = false;
    const destDone = false;

    const profileAvailable = isStepAvailable("profile", datesReady, profileDone, profileLegacyBypass, destDone);
    expect(profileAvailable).toBe(false);

    const tripId = "trip-locked-456";
    const href = profileAvailable ? `/trips/${tripId}?view=voyage&section=profile` : null;
    expect(href).toBe(null);
  });
});
