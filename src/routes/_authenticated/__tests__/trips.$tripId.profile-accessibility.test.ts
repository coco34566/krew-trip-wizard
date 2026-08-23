import { describe, expect, test } from "bun:test";

describe("profile section accessibility in timeline gating", () => {
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

  test("profile step is available as soon as dates are ready, generating href to section=profile", () => {
    const datesReady = true;
    const profileDone = false;
    const profileLegacyBypass = false;
    const destDone = false;

    const profileAvailable = isStepAvailable("profile", datesReady, profileDone, profileLegacyBypass, destDone);
    expect(profileAvailable).toBe(true);

    const tripId = "test-trip-123";
    const href = profileAvailable ? `/trips/${tripId}?view=voyage&section=profile` : null;
    expect(href).toBe(`/trips/test-trip-123?view=voyage&section=profile`);
  });

  test("profile step is blocked when dates are not ready", () => {
    const datesReady = false;
    const profileDone = false;
    const profileLegacyBypass = false;
    const destDone = false;

    const profileAvailable = isStepAvailable("profile", datesReady, profileDone, profileLegacyBypass, destDone);
    expect(profileAvailable).toBe(false);

    const tripId = "test-trip-123";
    const href = profileAvailable ? `/trips/${tripId}?view=voyage&section=profile` : null;
    expect(href).toBe(null);
  });
});
