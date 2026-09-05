import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

const inputSchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  externalId: z.string().trim().max(120).optional(),
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function allowedDistanceKm(destinationType: string | null | undefined) {
  const type = String(destinationType ?? "").toLowerCase();
  if (type.includes("region") || type.includes("territory") || type.includes("area")) return 180;
  if (type.includes("island") || type.includes("coast")) return 140;
  return 80;
}

export const getManualAccommodationContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const selectedRecommendation = await context.supabase
      .from("recommendations")
      .select("destination_id, destinations(name, country)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selectedRecommendation.error) throw selectedRecommendation.error;

    const destination = (selectedRecommendation.data as any)?.destinations;
    if (!destination) return { destinationName: null, destinationCountry: null };
    return {
      destinationName: String(destination.name || "") || null,
      destinationCountry: String(destination.country || "") || null,
    };
  });

export const selectManualAccommodation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const tripResult = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripResult.error) throw tripResult.error;
    if (!tripResult.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripResult.data, userId)) {
      throw new Error("403 Forbidden: seul l’organisateur ou co-organisateur peut choisir l’hébergement");
    }

    const selectedRecommendation = await supabase
      .from("recommendations")
      .select("id, destination_id, destinations(name, country, latitude, longitude, destination_type)")
      .eq("trip_id", data.tripId)
      .eq("is_selected", true)
      .maybeSingle();
    if (selectedRecommendation.error) throw selectedRecommendation.error;
    if (!selectedRecommendation.data?.destination_id) {
      throw new Error("Choisis d’abord une destination avant de renseigner l’hébergement");
    }

    const destination = (selectedRecommendation.data as any).destinations as {
      name?: string;
      country?: string;
      latitude?: number | null;
      longitude?: number | null;
      destination_type?: string | null;
    } | null;

    if (
      destination &&
      Number.isFinite(Number(destination.latitude)) &&
      Number.isFinite(Number(destination.longitude))
    ) {
      const distanceKm = haversineKm(
        Number(destination.latitude),
        Number(destination.longitude),
        data.latitude,
        data.longitude,
      );
      const maxDistanceKm = allowedDistanceKm(destination.destination_type);
      if (distanceKm > maxDistanceKm) {
        throw new Error(
          `Hébergement hors destination: ${data.name} se trouve à environ ${Math.round(distanceKm)} km de ${destination.name || "la destination sélectionnée"}.`,
        );
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    let accommodationId: string | null = null;
    if (data.externalId) {
      const existing = await admin
        .from("accommodations")
        .select("id")
        .eq("source", "manual_group_choice")
        .eq("external_id", `osm:${data.externalId}`)
        .eq("destination_id", selectedRecommendation.data.destination_id)
        .maybeSingle();
      if (existing.error) throw existing.error;
      accommodationId = existing.data?.id ?? null;
    }

    if (!accommodationId) {
      const inserted = await admin
        .from("accommodations")
        .insert({
          destination_id: selectedRecommendation.data.destination_id,
          name: data.name,
          description: `Hébergement choisi manuellement par le groupe · ${data.address}`,
          type: "manual",
          latitude: data.latitude,
          longitude: data.longitude,
          source: "manual_group_choice",
          external_id: data.externalId ? `osm:${data.externalId}` : null,
          verification_state: "manual",
          availability_verified: false,
          price_verified: false,
          price_per_night_per_person: 0,
          rating: 0,
          capacity: 0,
          distance_center_km: 0,
        })
        .select("id")
        .single();
      if (inserted.error) throw inserted.error;
      accommodationId = inserted.data.id;
    } else {
      const refreshed = await admin
        .from("accommodations")
        .update({
          name: data.name,
          description: `Hébergement choisi manuellement par le groupe · ${data.address}`,
          latitude: data.latitude,
          longitude: data.longitude,
          verification_state: "manual",
        })
        .eq("id", accommodationId);
      if (refreshed.error) throw refreshed.error;
    }

    const recommendationUpdate = await admin
      .from("recommendations")
      .update({ accommodation_id: accommodationId })
      .eq("id", selectedRecommendation.data.id);
    if (recommendationUpdate.error) throw recommendationUpdate.error;

    const previous = ((tripResult.data as any).group_logistics || {}) as Record<string, any>;
    const previousHotels = Array.isArray(previous.hotels) ? previous.hotels : [];
    const manualHotel = {
      id: accommodationId,
      accommodation_id: accommodationId,
      name: data.name,
      type: "manual",
      source: "manual_group_choice",
      manualChoice: true,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      location: {
        city: data.city || null,
        country: data.country || null,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
      },
      priceStatus: "unknown",
      availabilityVerified: false,
    };
    const hotels = [manualHotel, ...previousHotels.filter((hotel: any) => hotel?.id !== accommodationId)];
    const nextLogistics = {
      ...previous,
      hotels,
      hotelVotes: [],
      selectedHotelId: accommodationId,
      hotelBookingStatus: "réservé",
      hotelVoteTodo: null,
      manualAccommodation: {
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        selectedAt: new Date().toISOString(),
      },
    };

    const tripUpdate = await admin
      .from("trips")
      .update({
        group_logistics: nextLogistics,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.tripId);
    if (tripUpdate.error) throw tripUpdate.error;

    return {
      ok: true,
      accommodationId,
      accommodationName: data.name,
      address: data.address,
    };
  });
