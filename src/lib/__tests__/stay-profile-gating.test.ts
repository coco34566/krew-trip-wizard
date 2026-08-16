import { describe, expect, it } from "vitest";
import { evaluateStayProfileGate } from "../krew/trip-service";

describe("trip stay profile gating", () => {
  it("keeps the profile and destination locked while questionnaires are incomplete", () => {
    expect(
      evaluateStayProfileGate({
        answered: 0,
        expected: 4,
        validated: false,
        hasExistingRecommendations: false,
      }),
    ).toEqual({
      questionnairesReady: false,
      legacyBypass: false,
      profileValidated: false,
      canGenerate: false,
    });
  });

  it("opens profile validation, but not generation, at the existing 40% threshold", () => {
    const gate = evaluateStayProfileGate({
      answered: 2,
      expected: 5,
      validated: false,
      hasExistingRecommendations: false,
    });
    expect(gate.questionnairesReady).toBe(true);
    expect(gate.canGenerate).toBe(false);
  });

  it("allows generation after organizer validation", () => {
    expect(
      evaluateStayProfileGate({
        answered: 2,
        expected: 5,
        validated: true,
        hasExistingRecommendations: false,
      }).canGenerate,
    ).toBe(true);
  });

  it("preserves old trips that already have recommendations", () => {
    const gate = evaluateStayProfileGate({
      answered: 0,
      expected: 8,
      validated: false,
      hasExistingRecommendations: true,
    });
    expect(gate.legacyBypass).toBe(true);
    expect(gate.profileValidated).toBe(true);
    expect(gate.canGenerate).toBe(true);
  });
});
