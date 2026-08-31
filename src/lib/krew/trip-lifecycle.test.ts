import { describe, expect, it } from "vitest";
import { getTripLifecycleState } from "./trip-lifecycle";

const now = new Date(2026, 7, 31, 12, 0, 0);

describe("getTripLifecycleState", () => {
  it("keeps unlocked trips in preparation", () => {
    expect(getTripLifecycleState({ datesLocked: false, startDate: "2026-08-31", endDate: "2026-09-02", now })).toBe("future");
  });

  it("is future before departure", () => {
    expect(getTripLifecycleState({ datesLocked: true, startDate: "2026-09-01", endDate: "2026-09-03", now })).toBe("future");
  });

  it("is live on departure day and during the trip", () => {
    expect(getTripLifecycleState({ datesLocked: true, startDate: "2026-08-31", endDate: "2026-09-02", now })).toBe("live");
    expect(getTripLifecycleState({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-08-31", now })).toBe("live");
  });

  it("is completed only after end_date", () => {
    expect(getTripLifecycleState({ datesLocked: true, startDate: "2026-08-28", endDate: "2026-08-30", now })).toBe("completed");
  });
});
