import { geocodeDestination, haversineKm } from "@/integrations/external/geo-weather.server";
import { estimateDistanceKm } from "./deep-links";

export type RouteDistanceEstimate = {
  distanceKm: number;
  estimated: boolean;
};

export async function resolveRouteDistanceKm(input: {
  originCity: string;
  destinationName: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  fallbackDistanceKm?: number | null;
}): Promise<RouteDistanceEstimate> {
  const originCity = input.originCity.trim();
  const destinationName = input.destinationName.trim();

  const origin = originCity ? await geocodeDestination(originCity).catch(() => null) : null;
  let destination =
    Number.isFinite(input.destinationLatitude) && Number.isFinite(input.destinationLongitude)
      ? {
          latitude: Number(input.destinationLatitude),
          longitude: Number(input.destinationLongitude),
        }
      : null;

  if (!destination && destinationName) {
    const geocoded = await geocodeDestination(destinationName).catch(() => null);
    if (geocoded) {
      destination = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      };
    }
  }

  if (origin && destination) {
    return {
      distanceKm: haversineKm(
        { lat: origin.latitude, lon: origin.longitude },
        { lat: destination.latitude, lon: destination.longitude },
      ),
      estimated: false,
    };
  }

  return {
    distanceKm: estimateDistanceKm(
      originCity,
      destinationName,
      input.fallbackDistanceKm,
    ),
    estimated: true,
  };
}
