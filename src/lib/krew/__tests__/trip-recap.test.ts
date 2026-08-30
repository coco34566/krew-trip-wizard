import { describe, expect, it } from "vitest";
import { buildTripRecap } from "@/lib/krew/trip-recap";

const now = new Date("2026-08-30T12:00:00Z");

function source(overrides: Record<string, unknown> = {}) {
  return {
    trip: {
      name: "Lisbonne entre amis",
      start_date: "2026-08-27",
      end_date: "2026-08-29",
      participants_count: 8,
      selected_activity_ids: ["a", "b", "b", "c"],
      group_itinerary: { days: [{ day: 1 }, { day: 2 }, { day: 3 }] },
      group_logistics: {
        selectedHotelId: "hotel-1",
        hotels: [{ id: "hotel-1", name: "Casa Krew" }],
      },
      ...(overrides.trip as Record<string, unknown> | undefined),
    },
    destination: { name: "Lisbonne", country: "Portugal" },
    photoCount: 0,
    ...overrides,
  };
}

describe("buildTripRecap", () => {
  it("builds only reliable recap facts for an ended prepared trip", () => {
    const recap = buildTripRecap(source(), now);

    expect(recap.eligible).toBe(true);
    expect(recap.durationDays).toBe(3);
    expect(recap.participantsCount).toBe(8);
    expect(recap.activitiesCount).toBe(3);
    expect(recap.accommodationName).toBe("Casa Krew");
    expect(recap.destinationName).toBe("Lisbonne");
  });

  it("does not unlock before the effective end of the trip", () => {
    const recap = buildTripRecap(source({ trip: { end_date: "2026-08-31" } }), now);
    expect(recap.eligible).toBe(false);
  });

  it("does not create a recap for a legacy trip with dates but no concrete travel artefact", () => {
    const recap = buildTripRecap(
      source({
        trip: {
          selected_activity_ids: null,
          group_itinerary: null,
          group_logistics: null,
        },
      }),
      now,
    );
    expect(recap.eligible).toBe(false);
  });

  it("supports an ended trip with no photos when the planning exists", () => {
    const recap = buildTripRecap(source({ photoCount: 0 }), now);
    expect(recap.eligible).toBe(true);
  });

  it("keeps optional facts absent instead of inventing them", () => {
    const recap = buildTripRecap(
      source({
        trip: {
          participants_count: 0,
          selected_activity_ids: null,
          group_itinerary: { days: [{ day: 1 }] },
          group_logistics: null,
        },
      }),
      now,
    );

    expect(recap.eligible).toBe(true);
    expect(recap.participantsCount).toBeNull();
    expect(recap.activitiesCount).toBeNull();
    expect(recap.accommodationName).toBeNull();
  });
});
