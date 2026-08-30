import { describe, expect, it } from "vitest";

import {
  buildPlanningMapModel,
  buildPlanningMapsUrl,
  findPlanningMapGeographicOutlierIds,
  formatMapSegmentDistance,
  haversineKm,
} from "@/lib/krew/planning-map";

describe("planning map adapter", () => {
  it("keeps planning continuity rules without exposing numbering gaps", () => {
    const model = buildPlanningMapModel({
      destination: "Lisbonne",
      days: [{
        day: 1,
        slots: [
          { label: "A", type: "activite", latitude: 38.71, longitude: -9.14 },
          { label: "B", type: "resto", latitude: null, longitude: null },
          { label: "C", type: "bar", latitude: 38.72, longitude: -9.15 },
        ],
      }],
    });

    expect(model.activityPoints.map((point) => point.label)).toEqual(["A", "C"]);
    expect(model.activityPoints.map((point) => point.orderInDay)).toEqual([1, 2]);
    expect(model.segments).toHaveLength(0);
  });

  it("links only consecutive mappable activities and excludes transport slots", () => {
    const model = buildPlanningMapModel({
      destination: "Paris",
      days: [{
        day: 1,
        slots: [
          { label: "Musée", type: "activite", latitude: 48.8606, longitude: 2.3376 },
          { label: "Métro", type: "transport", latitude: 48.86, longitude: 2.34 },
          { label: "Dîner", type: "resto", latitude: 48.853, longitude: 2.3499 },
        ],
      }],
    });

    expect(model.activityPoints).toHaveLength(2);
    expect(model.activityPoints.map((point) => point.orderInDay)).toEqual([1, 2]);
    expect(model.segments).toHaveLength(1);
  });

  it("never connects the last point of one day to the first point of the next day", () => {
    const model = buildPlanningMapModel({
      days: [
        { day: 1, slots: [{ label: "J1", type: "activite", latitude: 48.85, longitude: 2.35 }] },
        { day: 2, slots: [{ label: "J2", type: "activite", latitude: 48.86, longitude: 2.36 }] },
      ],
    });

    expect(model.segments).toHaveLength(0);
    expect(model.activityPoints.map((point) => point.orderInDay)).toEqual([1, 1]);
  });

  it("flags an isolated 200+ km place inside an otherwise compact city trip", () => {
    const model = buildPlanningMapModel({
      destination: "Prague",
      days: [{
        day: 1,
        slots: [
          { label: "A", type: "resto", latitude: 50.0883, longitude: 14.4212 },
          { label: "B", type: "bar", latitude: 50.0792, longitude: 14.4162 },
          { label: "C", type: "activite", latitude: 50.0840, longitude: 14.4085 },
          { label: "Wrong homonym", type: "resto", latitude: 49.5980, longitude: 17.3677 },
        ],
      }],
    });

    expect(findPlanningMapGeographicOutlierIds(model.points)).toEqual([model.activityPoints[3]?.id]);
  });

  it("does not flag naturally spread regional itineraries", () => {
    const model = buildPlanningMapModel({
      days: [{
        day: 1,
        slots: [
          { label: "A", type: "activite", latitude: 45.0, longitude: 5.0 },
          { label: "B", type: "activite", latitude: 45.7, longitude: 5.8 },
          { label: "C", type: "activite", latitude: 46.4, longitude: 6.6 },
          { label: "D", type: "activite", latitude: 47.1, longitude: 7.4 },
        ],
      }],
    });

    expect(findPlanningMapGeographicOutlierIds(model.points)).toEqual([]);
  });

  it("adds only the selected lodging when it has real coordinates", () => {
    const model = buildPlanningMapModel({
      destination: "Porto",
      days: [],
      selectedLodging: { id: "hotel-1", name: "Casa Krew", latitude: 41.15, longitude: -8.61 },
    });
    expect(model.lodgingPoint?.label).toBe("Casa Krew");
  });

  it("reuses an existing Google Maps URL before creating a fallback", () => {
    const existing = "https://www.google.com/maps/search/?api=1&query=verified-place";
    expect(buildPlanningMapsUrl({ existingUrl: existing, name: "Different name", latitude: 1, longitude: 2 })).toBe(existing);
  });

  it("calculates and formats geographic distances", () => {
    const distance = haversineKm(
      { latitude: 48.8566, longitude: 2.3522 },
      { latitude: 48.8606, longitude: 2.3376 },
    );
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
    expect(formatMapSegmentDistance(0.46)).toBe("≈ 450 m");
  });
});
