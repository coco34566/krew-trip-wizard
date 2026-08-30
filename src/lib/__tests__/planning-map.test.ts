import { describe, expect, it } from "vitest";

import { buildKrewMapsSearchUrl, buildPlanningMapModel, haversineKm } from "@/lib/krew/planning-map";

describe("planning map adapter", () => {
  it("keeps the real day/slot order and only maps planned non-transport slots with coordinates", () => {
    const model = buildPlanningMapModel({
      destination: "Paris",
      days: [
        {
          day: 2,
          slots: [
            { label: "Départ gare", type: "transport", latitude: 48.84, longitude: 2.37 },
            { label: "Musée", type: "activite", latitude: 48.86, longitude: 2.34 },
            { label: "Dîner", type: "resto", latitude: 48.85, longitude: 2.35 },
          ],
        },
        {
          day: 1,
          slots: [{ label: "Brunch", type: "resto", latitude: 48.87, longitude: 2.36 }],
        },
      ],
    });

    expect(model.activities.map((point) => [point.day, point.sequenceInDay, point.name])).toEqual([
      [2, 1, "Musée"],
      [2, 2, "Dîner"],
      [1, 1, "Brunch"],
    ]);
  });

  it("does not bridge over an unmappable intermediate planning step", () => {
    const model = buildPlanningMapModel({
      days: [
        {
          day: 1,
          slots: [
            { label: "A", type: "activite", latitude: 48.85, longitude: 2.35 },
            { label: "B", type: "activite" },
            { label: "C", type: "activite", latitude: 48.87, longitude: 2.37 },
          ],
        },
      ],
    });

    expect(model.activities).toHaveLength(2);
    expect(model.segments).toHaveLength(0);
    expect(model.activities[1]?.sequenceInDay).toBe(3);
  });

  it("only includes the selected accommodation passed by the caller and never fabricates its coordinates", () => {
    const withoutCoordinates = buildPlanningMapModel({
      days: [],
      selectedAccommodation: { id: "hotel-1", name: "KREW House" },
    });
    expect(withoutCoordinates.accommodation).toBeNull();
    expect(withoutCoordinates.points).toHaveLength(0);

    const withCoordinates = buildPlanningMapModel({
      days: [],
      selectedAccommodation: {
        id: "hotel-1",
        name: "KREW House",
        latitude: 48.86,
        longitude: 2.35,
      },
    });
    expect(withCoordinates.accommodation?.id).toBe("hotel-1");
    expect(withCoordinates.points).toHaveLength(1);
  });

  it("keeps zero-distance consecutive activities as a valid segment", () => {
    const model = buildPlanningMapModel({
      days: [
        {
          day: 1,
          slots: [
            { label: "A", type: "activite", latitude: 48.85, longitude: 2.35 },
            { label: "B", type: "resto", latitude: 48.85, longitude: 2.35 },
          ],
        },
      ],
    });
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]?.distanceKm).toBe(0);
  });

  it("computes geographic distance with Haversine and labels Maps using KREW's existing search convention", () => {
    expect(haversineKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 48.8606, longitude: 2.3376 })).toBeGreaterThan(1);
    expect(
      buildKrewMapsSearchUrl({ name: "Musée du Louvre", address: "Rue de Rivoli, Paris" }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mus%C3%A9e%20du%20Louvre%2C%20Rue%20de%20Rivoli%2C%20Paris",
    );
  });
});
