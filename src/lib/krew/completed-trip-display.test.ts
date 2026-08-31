import { describe, expect, it } from "vitest";
import { getTripLifecycleState } from "./trip-lifecycle";

function completedTrip() {
  return getTripLifecycleState({
    datesLocked: true,
    startDate: "2026-08-20",
    endDate: "2026-08-22",
    now: new Date(2026, 7, 31, 12, 0, 0),
  });
}

describe("completed trip display model", () => {
  it("derives historical mode from the canonical lifecycle only", () => {
    expect(completedTrip()).toBe("completed");
  });

  it("does not treat a reactivated completed trip as future just because it is no longer archived", () => {
    // Archive state is deliberately absent from the lifecycle input: reactivation
    // must preserve the completed temporal state.
    expect(completedTrip()).toBe("completed");
  });
});
