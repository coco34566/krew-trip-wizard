import { describe, expect, it } from "vitest";

import {
  buildPlanningMapModel,
  buildPlanningMapsUrl,
  haversineKm,
} from "@/lib/krew/planning-map";

describe("planning map adapter", () => {
  it("keeps planning continuity rules without exposing numbering gaps", () => {
    const model = buildPlanningMapModel({
      destination: "Lisbonne",
      days: [
        {
          day: 1,
          slots: [
            { label: "A", type: "activite", latitude: 38.71, longitude: -9.14 },
            { label: "B", type: "resto", latitude: null, longitude: null },
            { label: "C", type: "bar", latitude: 38.72, longitude: -9.15 },
          ],
        },
      ],
    });

    expect(model.activityPoints.map((point) => point.label)).toEqual(["A", "C"]);
    expect(model.activityPoints.map((point) => point.orderInDay)).toEqual([1, 2]);
    expect(model.segments).toHaveLength(0);
    expect(model.activityPoints[1]?.distanceFromPreviousKm).toBeNull();
  });

  it("links only consecutive mappable activities and excludes transport slots", () => {
    const model = buildPlanningMapModel({
      destination: "Paris",
      days: [
        {
          day: 1,
          slots: [
            { label: "Musée", type: "activite", latitude: 48.8606, longitude: 2.3376 },
            { label: "Métro", type: "transport", latitude: 48.86, longitude: 2.34 },
            { label: "Dîner", type: "resto", latitude: 48.853, longitude: 2.3499 },
          ],
        },
      ],
    });

    expect(model.activityPoints).toHaveLength(2);
    expect(model.activityPoints.map((point) => point.orderInDay)).toEqual([1, 2]);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]?.fromId).toBe(model.activityPoints[0]?.id);
    expect(model.segments[0]?.toId).toBe(model.activityPoints[1]?.id);
    expect(model.segments[0]?.distanceKm).toBeGreaterThan(0);
  });

  it("adds only the selected lodging when it has real coordinates", () => {
    const model = buildPlanningMapModel({
      destination: "Porto",
      days: [],
      selectedLodging: {
        id: "hotel-1",
        name: "Casa Krew",
        latitude: 41.15,
        longitude: -8.61,
      },
    });

    expect(model.points).toHaveLength(1);
    expect(model.lodgingPoint?.label).toBe("Casa Krew");
    expect(model.lodgingPoint?.kind).toBe("lodging");
  });

  it("reuses an existing Google Maps URL before creating a fallback", () => {
    const existing = "https://www.google.com/maps/search/?api=1&query=verified-place";
    expect(
      buildPlanningMapsUrl({
        existingUrl: existing,
        name: "Different name",
        latitude: 1,
        longitude: 2,
      }),
    ).toBe(existing);
  });

  it("calculates a geographic distance without presenting routing semantics", () => {
    const distance = haversineKm(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8606, longitude: 2.3376 },
    );
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
  });
});
