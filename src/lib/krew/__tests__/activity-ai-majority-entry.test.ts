import { describe, expect, it } from "vitest";

import { normalizePlanningTransportMajority } from "../activity-ai.entry";

const baseInput = {
  destination: "Lisbonne",
  nights: 2,
  participants: 8,
  budgetPerPerson: 500,
  ambiances: [],
  activityCategories: [],
};

describe("planning transport majority aggregation", () => {
  it("does not let one late arrival block the group", () => {
    const transportPicksSummary = [
      "10:00", "10:10", "10:20", "10:30", "10:40", "10:50", "11:00", "18:30",
    ].map((arrival, index) => ({
      city: index % 2 ? "Paris" : "Lyon",
      mode: index % 3 === 0 ? "train" : index % 3 === 1 ? "flight" : "car",
      arrival,
      departure: "18:00",
    }));

    const normalized = normalizePlanningTransportMajority({
      ...baseInput,
      latestGroupArrival: "18:30",
      transportPicksSummary,
    });

    expect(normalized.latestGroupArrival).toBe("10:30");
    expect(normalized.latestGroupArrival).not.toBe("18:30");
    expect(normalized.transportPicksSummary).toBe(transportPicksSummary);
  });

  it("does not let one early departure truncate the last day", () => {
    const departures = [
      "10:00", "17:30", "17:45", "18:00", "18:10", "18:20", "18:30", "18:40",
    ];
    const transportPicksSummary = departures.map((departure, index) => ({
      city: "Paris",
      mode: index % 3 === 0 ? "train" : index % 3 === 1 ? "flight" : "car",
      arrival: "10:30",
      departure,
    }));

    const normalized = normalizePlanningTransportMajority({
      ...baseInput,
      earliestGroupDeparture: "10:00",
      transportPicksSummary,
    });

    expect(normalized.earliestGroupDeparture).toBe("18:00");
    expect(normalized.earliestGroupDeparture).not.toBe("10:00");
    expect(normalized.transportPicksSummary?.map((pick) => pick.mode)).toEqual(
      transportPicksSummary.map((pick) => pick.mode),
    );
  });
});
