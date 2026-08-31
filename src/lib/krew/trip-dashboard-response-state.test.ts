import { describe, expect, it } from "vitest";

import { getDashboardResponseState } from "./trip-dashboard-response-state";

describe("dashboard response state", () => {
  it("returns a neutral loading state before centralized progress is stable", () => {
    expect(
      getDashboardResponseState({
        progressReady: false,
        datesLocked: false,
        preferencesExpected: 6,
        preferencesAnswered: 0,
        availabilityExpected: 6,
        availabilityAnswered: 0,
      }),
    ).toEqual({ state: "loading" });
  });

  it("uses one centralized population for numerator and denominator once loaded", () => {
    expect(
      getDashboardResponseState({
        progressReady: true,
        datesLocked: false,
        preferencesExpected: 1,
        preferencesAnswered: 1,
        availabilityExpected: 1,
        availabilityAnswered: 1,
      }),
    ).toEqual({
      state: "ready",
      preferencesExpected: 1,
      preferencesAnswered: 1,
      availabilityExpected: 1,
      availabilityAnswered: 1,
    });
  });

  it("closes availability and preferences coherently once dates are locked", () => {
    expect(
      getDashboardResponseState({
        progressReady: true,
        datesLocked: true,
        preferencesExpected: 2,
        preferencesAnswered: 1,
        availabilityExpected: 2,
        availabilityAnswered: 1,
      }),
    ).toEqual({
      state: "ready",
      preferencesExpected: 2,
      preferencesAnswered: 2,
      availabilityExpected: 2,
      availabilityAnswered: 2,
    });
  });
});
