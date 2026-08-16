import { describe, expect, it } from "vitest";
import { buildDateDecisionPatch } from "../availability.functions";
import { buildCostSplit } from "../krew/cost-split";
import { selectValidatedStayConcepts } from "../trips.functions";

describe("targeted trip lifecycle updates", () => {
  it("makes direct and voted dates converge on the same business state", () => {
    expect(buildDateDecisionPatch({ start: "2026-09-10", end: "2026-09-13" })).toMatchObject({
      start_date: "2026-09-10",
      end_date: "2026-09-13",
      dates_locked: true,
      date_confidence: "choisie",
    });
  });

  it("marks only date-dependent derived sections stale and preserves prior flags", () => {
    const patch = buildDateDecisionPatch({
      start: "2026-10-10",
      end: "2026-10-13",
      previousStart: "2026-09-10",
      previousEnd: "2026-09-13",
      refreshRequired: { destinations: false },
    });
    expect(patch.refresh_required).toEqual({
      destinations: false,
      accommodations: true,
      transports: true,
      activities: true,
    });
    expect(patch).not.toHaveProperty("group_itinerary");
    expect(patch).not.toHaveProperty("status");
  });

  it("never auto-selects every stay profile and rejects an empty organizer decision", () => {
    const concepts = [
      { id: "city", title: "City", rationale: "", affinity: 80, tags: [] },
      { id: "nature", title: "Nature", rationale: "", affinity: 70, tags: [] },
    ] as any;
    expect(selectValidatedStayConcepts(concepts, ["nature"]).map((concept) => concept.id)).toEqual([
      "nature",
    ]);
    expect(() => selectValidatedStayConcepts(concepts, [])).toThrow(/au moins un concept/);
  });

  it("keeps a gifted Star as a traveler while distributing shared costs only across payers", () => {
    const split = buildCostSplit({
      destinationName: "Lisbonne",
      accommodation: 100,
      activities: 20,
      food: 30,
      origins: [
        { city: "Participant", count: 7, pricePerPerson: 50 },
        { city: "Star", count: 1, pricePerPerson: 50, paysSharedCosts: false },
      ],
    });
    expect(split.lines.reduce((sum, line) => sum + line.count, 0)).toBe(8);
    expect(split.lines.find((line) => line.city === "Star")?.totalPerPerson).toBe(0);
    expect(split.sharedPerPerson).toBe(Math.round((150 * 8) / 7));
  });
});
