import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/external/geo-weather.server", () => ({
  geocodeDestination: vi.fn(async (query: string) => {
    const normalized = query.toLowerCase();
    if (normalized.includes("paris")) {
      return { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522, population: null };
    }
    if (normalized.includes("lyon")) {
      return { name: "Lyon", country: "France", latitude: 45.764, longitude: 4.8357, population: null };
    }
    if (normalized.includes("catane") || normalized.includes("catania")) {
      return { name: "Catania", country: "Italie", latitude: 37.5079, longitude: 15.083, population: null };
    }
    return null;
  }),
  haversineKm: (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  },
}));

import { estimateTransport } from "../krew/engine";
import { resolveRouteDistanceKm } from "../krew/travel-distance.server";

describe("route distance and per-origin transport estimates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes an out-of-list destination by coordinates instead of Paris fallback", async () => {
    const result = await resolveRouteDistanceKm({
      originCity: "Lyon",
      destinationName: "Catane, Italie",
      fallbackDistanceKm: 1627,
    });

    expect(result.estimated).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(1000);
    expect(result.distanceKm).toBeLessThan(1400);
    expect(result.distanceKm).not.toBe(1627);
  });

  it("produces different transport estimates for Paris and Lyon to the same destination", async () => {
    const paris = await resolveRouteDistanceKm({
      originCity: "Paris",
      destinationName: "Catane, Italie",
    });
    const lyon = await resolveRouteDistanceKm({
      originCity: "Lyon",
      destinationName: "Catane, Italie",
    });

    expect(paris.distanceKm).not.toBe(lyon.distanceKm);
    expect(estimateTransport(paris.distanceKm)).not.toBe(estimateTransport(lyon.distanceKm));
  });
});
