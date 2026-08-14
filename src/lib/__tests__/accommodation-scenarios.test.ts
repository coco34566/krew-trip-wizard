import { describe, expect, it } from "vitest";
import { buildDefaultRoomScenario } from "../krew/accommodation-scenarios";

describe("accommodation scenarios", () => {
  it("uses two people per room by default", () => {
    const scenario = buildDefaultRoomScenario({
      participants: 8,
      nights: 2,
      pricePerNightPerPerson: 80,
      type: "hôtel",
      capacity: 2,
    });

    expect(scenario.units).toEqual([{ kind: "double", count: 4 }]);
    expect(scenario.privateRooms).toBe(4);
  });

  it("isolates participants requesting solo rooms and shares the rest", () => {
    const scenario = buildDefaultRoomScenario({
      participants: 8,
      nights: 2,
      pricePerNightPerPerson: 80,
      type: "hôtel",
      capacity: 2,
      roomPreferences: [
        { userId: "a", roomTypePreference: "solo" },
        { userId: "b", acceptsSharedRoom: false },
      ],
    });

    expect(scenario.units).toEqual([
      { kind: "solo", count: 2 },
      { kind: "double", count: 3 },
    ]);
    expect(scenario.privateRooms).toBe(5);
  });

  it("keeps an entire-home scenario as a single accommodation unit", () => {
    const scenario = buildDefaultRoomScenario({
      participants: 8,
      nights: 2,
      pricePerNightPerPerson: 100,
      type: "villa",
      capacity: 10,
    });

    expect(scenario.units).toEqual([{ kind: "entire", count: 1 }]);
    expect(scenario.totalCost).toBe(1600);
  });
});
