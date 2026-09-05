import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildFinalItinerarySlot,
  generateGroupItinerary as generateGroupItineraryLegacy,
  regenerateItinerarySlot as regenerateItinerarySlotLegacy,
} from "./trips.functions";
import {
  buildVerifiedPlaceFallbackUrl,
  convertIntentToPlaceRequirements,
  selectGeoapifyCandidate,
  type GeoapifyPlace,
  type PlaceRequirements,
} from "./krew/geoapify.server";
import { resolveActivityResourceForPlace } from "./krew/activity-ai.server";

type CandidateSelector = (options: {
  candidates: GeoapifyPlace[];
  req: PlaceRequirements;
  usedCandidateIdsSet: Set<string>;
  refCoords?: { latitude?: number | null; longitude?: number | null } | null;
  maxKm?: number;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number;
  accessibilityRequired?: boolean;
}) => Promise<GeoapifyPlace | null>;

type ResourceResolver = (
  place: GeoapifyPlace,
  destination?: string | null,
) => { url?: string | null; resourceKind?: unknown };

type RepairDependencies = {
  selectCandidate?: CandidateSelector;
  resolveResource?: ResourceResolver;
};

function uniquePlaces(pools: unknown): GeoapifyPlace[] {
  if (!pools || typeof pools !== "object") return [];
  const seen = new Set<string>();
  const places: GeoapifyPlace[] = [];
  for (const value of Object.values(pools as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    for (const raw of value) {
      const place = raw as GeoapifyPlace;
      if (!place?.id || !place?.name || place.verified !== true || seen.has(place.id)) continue;
      seen.add(place.id);
      places.push(place);
    }
  }
  return places;
}

function poolsForRequirement(
  pools: unknown,
  req: PlaceRequirements,
  allPlaces: GeoapifyPlace[],
): GeoapifyPlace[] {
  if (!pools || typeof pools !== "object") return allPlaces;
  const family = String(req.canonicalFamily || "").toLowerCase();
  const categories = (req.categories || []).map((category) => String(category).toLowerCase());
  const selected: GeoapifyPlace[] = [];
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(pools as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const lowerKey = key.toLowerCase();
    const relevant =
      (family && lowerKey.startsWith(`${family}::`)) ||
      categories.some((category) => category && lowerKey.includes(category));
    if (!relevant) continue;
    for (const raw of value) {
      const place = raw as GeoapifyPlace;
      if (!place?.id || !place?.name || place.verified !== true || seen.has(place.id)) continue;
      seen.add(place.id);
      selected.push(place);
    }
  }

  return selected.length ? selected : allPlaces;
}

function skeletonSlotFor(
  itinerary: any,
  dayNumber: number,
  slotIndex: number,
  finalSlot: any,
): any | null {
  const skeletonDay = itinerary?.skeleton?.days?.find?.((day: any) => day?.day === dayNumber);
  if (!skeletonDay || !Array.isArray(skeletonDay.slots)) return null;
  const sameTime = skeletonDay.slots.find(
    (slot: any) => slot?.time === finalSlot?.time && slot?.type === finalSlot?.type,
  );
  return sameTime ?? skeletonDay.slots[slotIndex] ?? null;
}

function shouldResolveRealPlace(slot: any): boolean {
  if (!slot || slot.verified === true) return false;
  if (slot.activityMode === "self_guided_group") return false;
  if (slot.locationContext === "lodging") return false;
  if (slot.type === "libre" && !slot.venueFamily) return false;
  return Boolean(slot.venueFamily || slot.searchIntent || slot.type === "resto" || slot.type === "bar" || slot.type === "activite");
}

function fallbackFamily(slot: any): string {
  if (slot.venueFamily) return String(slot.venueFamily);
  if (slot.type === "resto") return "restaurant";
  if (slot.type === "bar") return "bar_pub";
  return "local_experience";
}

/**
 * Repairs the legacy planning output without inventing places.
 *
 * The legacy generator first tries to verify Gemini's exact venue name. Its old
 * fallback then rejected every otherwise-valid Geoapify candidate when the real
 * venue had a different name. For regional destinations this could leave an
 * entire itinerary with generic Google Maps searches even though verified place
 * pools had already been fetched.
 *
 * This post-processing pass keeps exact verified matches intact, then resolves
 * each still-unverified external slot from the already-grounded Geoapify pools
 * using the slot intent. Only if no verified place is compatible do we keep a
 * generic search, and in that case we restore the honest activity wording from
 * the skeleton instead of displaying an unverified AI venue name as fact.
 */
export async function repairPlanningVerifiedPlaces(
  itinerary: any,
  dependencies: RepairDependencies = {},
): Promise<any> {
  if (!itinerary?.days?.length) return itinerary;

  const selectCandidate = dependencies.selectCandidate ?? (selectGeoapifyCandidate as CandidateSelector);
  const resolveResource = dependencies.resolveResource ?? (resolveActivityResourceForPlace as ResourceResolver);
  const destination = String(itinerary.destination || "").trim();
  const allPlaces = uniquePlaces(itinerary.placePools);
  const usedCandidateIds = new Set<string>(
    Array.isArray(itinerary.usedCandidateIds) ? itinerary.usedCandidateIds.map(String) : [],
  );

  const repairedDays = [];
  for (const day of itinerary.days as any[]) {
    let previousCoords: { latitude?: number | null; longitude?: number | null } | null = null;
    const repairedSlots = [];

    for (let slotIndex = 0; slotIndex < (day.slots ?? []).length; slotIndex += 1) {
      const slot = day.slots[slotIndex];

      if (slot?.verified === true && slot?.candidateId) {
        usedCandidateIds.add(String(slot.candidateId));
      }
      if (slot?.latitude != null && slot?.longitude != null) {
        previousCoords = { latitude: Number(slot.latitude), longitude: Number(slot.longitude) };
      }

      if (!shouldResolveRealPlace(slot) || allPlaces.length === 0) {
        repairedSlots.push(slot);
        continue;
      }

      const skeletonSlot = skeletonSlotFor(itinerary, Number(day.day), slotIndex, slot);
      const honestLabel = String(skeletonSlot?.label || slot?.label || "Activité").trim();
      const searchIntent = String(
        slot?.searchIntent || skeletonSlot?.searchIntent || honestLabel,
      ).trim();
      const venueFamily = fallbackFamily(slot);

      const req = convertIntentToPlaceRequirements(
        venueFamily,
        String(slot?.category || skeletonSlot?.category || slot?.type || "activite"),
        searchIntent,
        [],
        false,
        [],
        null,
        null,
        destination || null,
      );
      const candidates = poolsForRequirement(itinerary.placePools, req, allPlaces);
      const matchedPlace = await selectCandidate({
        candidates,
        req,
        usedCandidateIdsSet: usedCandidateIds,
        refCoords: previousCoords,
        maxKm: 50,
        date: day?.date ?? null,
        time: slot?.time ?? null,
        durationMinutes: Number(slot?.durationMinutes) || 90,
        accessibilityRequired: false,
      });

      if (matchedPlace) {
        usedCandidateIds.add(matchedPlace.id);
        if (matchedPlace.latitude != null && matchedPlace.longitude != null) {
          previousCoords = {
            latitude: matchedPlace.latitude,
            longitude: matchedPlace.longitude,
          };
        }
        const resolvedResource = resolveResource(matchedPlace, destination || null);
        const rebuilt = buildFinalItinerarySlot({
          slot: {
            ...(skeletonSlot || {}),
            ...slot,
            label: honestLabel,
            searchIntent,
            venueFamily,
          },
          matchedPlace,
          matchedSource: "geoapify_intent_fallback",
          mode: slot?.activityMode ?? null,
          resolvedResource,
        });
        repairedSlots.push({ ...slot, ...rebuilt });
        continue;
      }

      const fallbackMapUrl = buildVerifiedPlaceFallbackUrl(
        { name: searchIntent || honestLabel, address: destination || null },
        destination || null,
      );
      repairedSlots.push({
        ...slot,
        label: honestLabel,
        verified: false,
        source: "krew",
        url: fallbackMapUrl,
        resourceKind: fallbackMapUrl ? "maps" : null,
      });
    }

    repairedDays.push({ ...day, slots: repairedSlots });
  }

  return {
    ...itinerary,
    days: repairedDays,
    usedCandidateIds: Array.from(usedCandidateIds),
    telemetry: {
      ...(itinerary.telemetry || {}),
      verifiedPlaceFallbackRepair: true,
      unresolvedAfterRepair: repairedDays
        .flatMap((day: any) => day.slots ?? [])
        .filter((slot: any) => shouldResolveRealPlace(slot)).length,
    },
  };
}

async function persistRepairedItinerary(supabase: any, tripId: string, itinerary: any) {
  const repaired = await repairPlanningVerifiedPlaces(itinerary);
  const { error } = await supabase
    .from("trips")
    .update({ group_itinerary: repaired, updated_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
  return repaired;
}

export const generateGroupItineraryResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const legacyResult = await generateGroupItineraryLegacy({ data });
    const legacyItinerary = (legacyResult as any)?.itinerary;
    if (!legacyItinerary) return legacyResult;

    const repaired = await persistRepairedItinerary(context.supabase, data.tripId, legacyItinerary);
    return { ...(legacyResult as any), itinerary: repaired };
  });

export const regenerateItinerarySlotResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        day: z.number().int().min(1).max(21),
        slotIndex: z.number().int().min(0).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const legacyResult = await regenerateItinerarySlotLegacy({ data });
    const trip = await context.supabase
      .from("trips")
      .select("group_itinerary")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data?.group_itinerary) return legacyResult;

    const repaired = await persistRepairedItinerary(
      context.supabase,
      data.tripId,
      trip.data.group_itinerary,
    );
    return { ...(legacyResult as any), itinerary: repaired };
  });
