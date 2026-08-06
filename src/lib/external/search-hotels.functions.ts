// src/lib/external/search-hotels.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { searchHotelsRapidAPI } from "@/integrations/external/hotels.rapidapi";
import type { AccommodationRecord } from "@/lib/krew/engine";

/**
 * Server function: aggregate participant prefs, call Hotels.com RapidAPI and
 * upsert accommodations into the `accommodations` table so the recommendation
 * engine can use them.
 */
export const searchExternalForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tripRes = await supabase.from("trips").select("*").eq("id", data.tripId).single();
    if (tripRes.error || !tripRes.data) throw tripRes.error ?? new Error("Trip not found");
    const trip = tripRes.data as any;

    const prefsRes = await supabase.from("trip_preferences").select("*").eq("trip_id", data.tripId).maybeSingle();
    const prefs = prefsRes.error ? null : prefsRes.data;

    const partPrefsRes = await supabase
      .from("trip_participant_preferences")
      .select("user_id, ambiances, activity_categories, budget_max, duration_nights_min, duration_nights_max")
      .eq("trip_id", data.tripId);
    const participantsPrefs = (partPrefsRes.data ?? []) as any[];

    const budgets = participantsPrefs.map((p) => (p?.budget_max ? Number(p.budget_max) : null)).filter(Boolean);
    const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : trip.budget_per_person;

    const ambianceCounts: Record<string, number> = {};
    for (const p of participantsPrefs) {
      for (const a of (p.ambiances ?? [])) {
        ambianceCounts[a] = (ambianceCounts[a] ?? 0) + 1;
      }
    }
    const ambiances = Object.entries(ambianceCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3);

    const activityCounts: Record<string, number> = {};
    for (const p of participantsPrefs) {
      for (const c of (p.activity_categories ?? [])) {
        activityCounts[c] = (activityCounts[c] ?? 0) + 1;
      }
    }
    const activityCategories = Object.entries(activityCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k);

    const nights = prefs?.duration_nights ?? Math.max(1, trip.duration_nights ?? 2);
    const destinationQuery = prefs?.desired_destination ?? trip.desired_destination ?? trip.departure_city ?? "";

    if (!destinationQuery) {
      return { accommodationsCount: 0, message: "No destination found to search" };
    }

    // Call RapidAPI hotels provider
    let hotelsRaw: any[] = [];
    try {
      hotelsRaw = await searchHotelsRapidAPI({
        destination: destinationQuery,
        checkin: trip.start_date ?? null,
        checkout: trip.end_date ?? null,
        adults: trip.participants_count ?? 2,
        pageSize: 40,
      });
    } catch (err) {
      console.error("searchHotelsRapidAPI failed", err);
      throw err;
    }

    // Map to AccommodationRecord shape
    const accommodations: AccommodationRecord[] = (hotelsRaw || [])
      .map((h: any) => {
        try {
          // Various possible shapes for price
          let pricePerNightTotal: number | null = null;
          if (h?.ratePlan?.price?.exactCurrent) pricePerNightTotal = Number(h.ratePlan.price.exactCurrent);
          if (!pricePerNightTotal && h?.price && typeof h.price === "object") {
            pricePerNightTotal = Number(h.price.rates?.[0]?.amount || h.price.amount || h.price.max || null);
          }
          if (!pricePerNightTotal && (h.minDailyRate || h.minPrice)) pricePerNightTotal = Number(h.minDailyRate ?? h.minPrice);

          const participants = Math.max(1, trip.participants_count ?? 1);
          const pricePerNightPerPerson = pricePerNightTotal ? Math.round(pricePerNightTotal / participants) : Math.round((h?.price || 0) / participants || 0);

          const acc: AccommodationRecord = {
            id: String(h.property_id ?? h.id ?? h.hotelId ?? h.impressionId ?? JSON.stringify(h)),
            destination_id: String(h.city_id ?? h.destinationId ?? h.destination_id ?? (h.address?.city ?? destinationQuery)),
            name: h.name || h.hotelName || h.title || "Hôtel",
            type: h.propertyType || h.type || "hotel",
            description: h.description || h.longDescription || null,
            price_per_night_per_person: Number(pricePerNightPerPerson ?? 0),
            capacity: h.rooms?.maxOccupancy ?? h.maxOccupancy ?? h.capacity ?? Math.max(2, participants),
            rating: Number(h.starRating ?? h.reviewScore ?? h.rating ?? 0),
            distance_center_km: h.distance?.value ? Number(h.distance.value) / 1000 : Number(h.distanceFromCenterKm ?? 0),
            image_url: (h.media && h.media[0]?.uri) || h.heroImage?.imageUrl || h.thumbnailUrl || null,
          };
          return acc;
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean) as AccommodationRecord[];

    // Upsert accommodations into DB
    for (const a of accommodations) {
      try {
        const up = await supabase.from("accommodations").upsert(
          {
            id: a.id,
            destination_id: a.destination_id,
            name: a.name,
            type: a.type,
            description: a.description,
            price_per_night_per_person: a.price_per_night_per_person,
            capacity: a.capacity,
            rating: a.rating,
            distance_center_km: a.distance_center_km,
            image_url: a.image_url,
          },
          { onConflict: "id" },
        );
        if (up.error) console.error("Upsert accommodation failed", up.error);
      } catch (err) {
        console.error("Upsert accommodation exception", err);
      }
    }

    return {
      accommodationsCount: accommodations.length,
      avgBudget,
      ambiances,
      activityCategories,
    };
  });
