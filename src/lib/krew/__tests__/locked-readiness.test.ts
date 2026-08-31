import { describe, expect, it } from "vitest";

import { evaluateStayProfileGate } from "../trip-service-legacy";

/**
 * Contract for the late-participant rule used by the public trip-service wrapper:
 * once a profile is already validated and dates are locked, a later denominator
 * increase must not invalidate the approved trip. The wrapper itself is exercised
 * in integration tests because assessGenerationReadiness requires Supabase.
 */
describe("locked response readiness", () => {
  it("shows why legacy readiness can regress when the denominator grows", () => {
    expect(
      evaluateStayProfileGate({
        answered: 1,
        expected: 2,
        validated: true,
        hasExistingRecommendations: false,
      }).canGenerate,
    ).toBe(true);

    expect(
      evaluateStayProfileGate({
        answered: 1,
        expected: 3,
        validated: true,
        hasExistingRecommendations: false,
      }).canGenerate,
    ).toBe(false);
  });
});
