import { afterEach, describe, expect, it } from "vitest";
import { getCompletedTripUserFixtureFromEnv } from "./manual-completed-trip-user.fixture";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("manual completed-trip fixture contract", () => {
  it("does not silently reuse the organizer URL for the participant", () => {
    process.env.KREW_COMPLETED_TRIP_URL = "https://example.test/trips/11111111-1111-4111-8111-111111111111";
    delete process.env.KREW_COMPLETED_TRIP_PARTICIPANT_URL;

    expect(getCompletedTripUserFixtureFromEnv().participantUrl).toBeUndefined();
  });

  it("keeps an explicit participant URL for the dedicated invited account", () => {
    process.env.KREW_COMPLETED_TRIP_URL = "https://example.test/trips/11111111-1111-4111-8111-111111111111";
    process.env.KREW_COMPLETED_TRIP_PARTICIPANT_URL = "https://example.test/trips/11111111-1111-4111-8111-111111111111?participant=1";

    expect(getCompletedTripUserFixtureFromEnv().participantUrl).toContain("participant=1");
  });
});
