import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConcretePlaceProposal, resolveSearchIntentLocation } from "@/lib/krew/geoapify.server";
import { destinationGeographyMatches } from "@/lib/krew/planning-map-geography";

type Slot = Record<string, any>;
type Day = { day?: number; date?: string; slots?: Slot[] };

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  address: string | null;
};

const concreteLocationCache = new Map<string, ResolvedLocation | null>();

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function resolveConcretePlaceLocation(
  label: string,
  destination: string,
): Promise<ResolvedLocation | null> {
  const key = `${normalize(label)}::${normalize(destination)}`;
  if (concreteLocationCache.has(key)) return concreteLocationCache.get(key) ?? null;

  const apiKey = process.env["GEOAPIFY_API_KEY"];
  if (!apiKey) {
    concreteLocationCache.set(key, null);
    return null;
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", `${label}, ${destination}`);
    url.searchParams.set("limit", "5");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      concreteLocationCache.set(key, null);
      return null;
    }

    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];

    for (const hit of features) {
      const props = hit?.properties ?? {};
      const lat = typeof props.lat === "number" ? props.lat : hit?.geometry?.coordinates?.[1];
      const lon = typeof props.lon === "number" ? props.lon : hit?.geometry?.coordinates?.[0];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const geography = [props.city, props.municipality, props.county, props.state, props.formatted]
        .filter(Boolean)
        .join(" ");
      if (!destinationGeographyMatches(destination, geography)) continue;

      const result = {
        latitude: Number(lat),
        longitude: Number(lon),
        address: typeof props.formatted === "string" ? props.formatted : null,
      };
      concreteLocationCache.set(key, result);
      return result;
    }
  } catch {
    // The map must degrade gracefully if the provider is temporarily unavailable.
  }

  concreteLocationCache.set(key, null);
  return null;
}

async function enrichDays(days: Day[], destination: string): Promise<Day[]> {
  const enriched: Day[] = [];

  for (const day of days) {
    const slots: Slot[] = [];
    for (const rawSlot of Array.isArray(day?.slots) ? day.slots : []) {
      const slot = { ...rawSlot };
      const type = String(slot.type ?? "").toLowerCase();
      const hasCoordinates = Number.isFinite(Number(slot.latitude)) && Number.isFinite(Number(slot.longitude));
      const flexible = slot.locationContext === "flexible" || type === "libre" || type === "transport" || type === "hotel";

      if (!hasCoordinates && !flexible) {
        const label = typeof slot.label === "string" ? slot.label.trim() : "";
        let resolved: ResolvedLocation | null = null;

        if (label && isConcretePlaceProposal(label)) {
          resolved = await resolveConcretePlaceLocation(label, destination);
        }

        if (!resolved && typeof slot.searchIntent === "string" && slot.searchIntent.trim()) {
          const intent = await resolveSearchIntentLocation(slot.searchIntent, destination);
          if (intent) {
            resolved = {
              latitude: intent.latitude,
              longitude: intent.longitude,
              address: null,
            };
          }
        }

        if (resolved) {
          slot.latitude = resolved.latitude;
          slot.longitude = resolved.longitude;
          if (!slot.address && resolved.address) slot.address = resolved.address;
          slot.mapLocationResolved = true;
        }
      }

      slots.push(slot);
    }
    enriched.push({ ...day, slots });
  }

  return enriched;
}

export const getPlanningMapPayload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tripResult = await supabase
      .from("trips")
      .select("group_itinerary, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();

    if (tripResult.error) throw tripResult.error;
    if (!tripResult.data) throw new Error("Voyage introuvable");

    const itinerary = (tripResult.data.group_itinerary ?? {}) as Record<string, any>;
    const logistics = ((tripResult.data.group_logistics ?? {}) as Record<string, any>) || {};
    const destination = String(itinerary.destination ?? "").trim();
    const days = Array.isArray(itinerary.days) ? itinerary.days : [];
    const enrichedDays = destination ? await enrichDays(days, destination) : days;

    const selectedHotelId = typeof logistics.selectedHotelId === "string" ? logistics.selectedHotelId : null;
    const hotels = Array.isArray(logistics.hotels) ? logistics.hotels : [];
    let selectedLodging = selectedHotelId
      ? (hotels.find((hotel: any) => hotel?.id === selectedHotelId) ?? null)
      : null;

    const hasCoords = (hotel: any) => {
      const lat = Number(hotel?.latitude ?? hotel?.location?.latitude);
      const lon = Number(hotel?.longitude ?? hotel?.location?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lon);
    };

    if (selectedHotelId && (!selectedLodging || !hasCoords(selectedLodging)) && !selectedHotelId.startsWith("portal-")) {
      const accommodationResult = await supabase
        .from("accommodations")
        .select("id, name, type, latitude, longitude")
        .eq("id", selectedHotelId)
        .maybeSingle();
      if (!accommodationResult.error && accommodationResult.data) {
        selectedLodging = { ...(selectedLodging ?? {}), ...accommodationResult.data };
      }
    }

    return {
      destination: destination || null,
      days: enrichedDays,
      selectedLodging,
      hasPlanning: days.length > 0,
    };
  });
