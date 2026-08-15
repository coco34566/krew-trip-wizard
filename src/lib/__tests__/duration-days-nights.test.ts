import { describe, it, expect } from "vitest";
import { rankDateWindows, type AvailabilityEntry, windowOkFor } from "../krew/availability";

describe("Duration Days vs Nights rules", () => {
  it("covers 1 day correctly (same start and end date)", () => {
    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01"],
        blockedDates: [],
        flexDays: 0,
        durationNights: 0,
      },
    ];

    // 1 day = 0 nights
    const windows = rankDateWindows(entries, 0, 1);
    expect(windows.length).toBeGreaterThan(0);
    const best = windows[0]!;
    expect(best.start).toBe("2026-08-01");
    expect(best.end).toBe("2026-08-01"); // same start and end date!
    expect(best.nights).toBe(0);
    expect(best.covered).toBe(1);
    expect(best.coverageRatio).toBe(1);
  });

  it("CAS 1: trip configured for 2 days -> persisted duration_nights = 1 -> group date window J1 -> J2 (1 night)", () => {
    const durationDays = 2;
    const durationNights = Math.max(1, durationDays - 1); // 1 night
    expect(durationNights).toBe(1);

    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01", "2026-08-02", "2026-08-03"],
        blockedDates: [],
        flexDays: 0,
        durationNights,
      },
    ];

    const windows = rankDateWindows(entries, durationNights, 1);
    expect(windows.length).toBeGreaterThan(0);
    const best = windows[0]!;
    expect(best.start).toBe("2026-08-01");
    expect(best.end).toBe("2026-08-02"); // J1 -> J2 and NOT J1 -> J3
    expect(best.nights).toBe(1);
  });

  it("CAS 2: trip configured for 3 days -> persisted duration_nights = 2 -> group date window J1 -> J3 (2 nights)", () => {
    const durationDays = 3;
    const durationNights = Math.max(1, durationDays - 1); // 2 nights
    expect(durationNights).toBe(2);

    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"],
        blockedDates: [],
        flexDays: 0,
        durationNights,
      },
    ];

    const windows = rankDateWindows(entries, durationNights, 1);
    expect(windows.length).toBeGreaterThan(0);
    const best = windows[0]!;
    expect(best.start).toBe("2026-08-01");
    expect(best.end).toBe("2026-08-03"); // J1 -> J3 (2 nights)
    expect(best.nights).toBe(2);
  });

  it("covers 2 days correctly (J1/J2, Saturday and Sunday, which is 1 night)", () => {
    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01", "2026-08-02"],
        blockedDates: [],
        flexDays: 0,
        durationNights: 1,
      },
    ];

    // 2 days = 1 night
    const windows = rankDateWindows(entries, 1, 1);
    expect(windows.length).toBeGreaterThan(0);
    const best = windows[0]!;
    expect(best.start).toBe("2026-08-01");
    expect(best.end).toBe("2026-08-02"); // J1 and J2 (Saturday to Sunday)
    expect(best.nights).toBe(1);
    expect(best.covered).toBe(1);
    expect(best.coverageRatio).toBe(1);
  });

  it("covers 3 days correctly (J1/J2/J3, which is 2 nights)", () => {
    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01", "2026-08-02", "2026-08-03"],
        blockedDates: [],
        flexDays: 0,
        durationNights: 2,
      },
    ];

    // 3 days = 2 nights
    const windows = rankDateWindows(entries, 2, 1);
    expect(windows.length).toBeGreaterThan(0);
    const best = windows[0]!;
    expect(best.start).toBe("2026-08-01");
    expect(best.end).toBe("2026-08-03"); // J1, J2, J3 (Saturday to Monday)
    expect(best.nights).toBe(2);
    expect(best.covered).toBe(1);
    expect(best.coverageRatio).toBe(1);
  });

  it("prohibits windows if a participant's availability does not fully cover the window", () => {
    const entries: AvailabilityEntry[] = [
      {
        userId: "user-1",
        availableDates: ["2026-08-01", "2026-08-02"], // Saturday and Sunday only (2 days)
        blockedDates: [],
        flexDays: 0,
        durationNights: 2,
      },
    ];

    // A 3 days trip (2 nights, Saturday to Monday) cannot fit in Saturday/Sunday availability
    const isOk = windowOkFor(entries[0]!, "2026-08-01", "2026-08-03");
    expect(isOk).toBe(false);
  });

  it("finds the exact requested duration (3 days = 2 nights) when common availability spans 4 days", () => {
    // Example from spec:
    // Requested trip = 3 days (2 nights)
    // A available: 10-13 August (10, 11, 12, 13)
    // B available: 11-14 August (11, 12, 13, 14)
    // C available: 11-13 August (11, 12, 13)
    // Expected: propose 11-13 August = 3 days (2 nights)
    const entries: AvailabilityEntry[] = [
      {
        userId: "A",
        availableDates: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"],
        blockedDates: [],
        flexDays: 0,
      },
      {
        userId: "B",
        availableDates: ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"],
        blockedDates: [],
        flexDays: 0,
      },
      {
        userId: "C",
        availableDates: ["2026-08-11", "2026-08-12", "2026-08-13"],
        blockedDates: [],
        flexDays: 0,
      },
    ];

    // Requested duration = 3 days = 2 nights
    const windows = rankDateWindows(entries, 2, 5);
    expect(windows.length).toBeGreaterThan(0);
    const topWindow = windows[0]!;
    expect(topWindow.start).toBe("2026-08-11");
    expect(topWindow.end).toBe("2026-08-13"); // 11 to 13 = 3 days / 2 nights!
    expect(topWindow.covered).toBe(3);
    expect(topWindow.total).toBe(3);
    expect(topWindow.nights).toBe(2);
  });
});
