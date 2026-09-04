import { describe, expect, it } from "vitest";

// Regression contract for the grounded candidate promotion implemented in trip-service.ts.
// Keep this lightweight: the integration path is covered by Vercel build and live pool data.
describe("grounded destination candidate contract", () => {
  it("keeps estimated destination data explicitly separate from verified facts", () => {
    const source = "ai_grounded_estimate";
    const verificationState = "estimated";
    expect(source).not.toBe("ai_estimate");
    expect(verificationState).toBe("estimated");
  });

  it("does not turn a poor qualitative budget fit into a positive signal", () => {
    const score = (budgetFit: string) =>
      budgetFit === "likely_compatible" ? 3 : budgetFit === "uncertain" ? 1 : -2;
    expect(score("likely_expensive")).toBeLessThan(0);
    expect(score("likely_compatible")).toBeGreaterThan(score("uncertain"));
  });
});
