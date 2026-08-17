// src/lib/external/search-hotels.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDesiredDestination } from "@/lib/krew/trip-service";
import { normalizeActivityCategory } from "@/lib/krew/discovery-enrichment";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";

const externalSearchesInFlight = new Map<string, Promise<any>>();

async function runExternalCatalogRefresh(
  supabase: any,
  tripId: string,
  destinationQuery: string,
) {
  if (process.env["TRAVEL_PROVIDERS_ENABLED"] === "false") {
    return { ok: false as const, message: "Les fournisseurs de voyage sont temporairement désactivés.", destinationsCount: 0, accommodationsCount: 0, activitiesCount: 0, providerErrors: ["providers_disabled"] };
  }
  const tripRes = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (tripRes.error || !tripRes.data) throw tripRes.error ?? new Error("Voyage introuvable");
  const trip = tripRes.data as any;
  const prefsRes = await supabase.from("trip_preferences").select("duration_nights").eq("trip_id", tripId).maybeSingle();
  const prefs = (prefsRes.data ?? null) as any;
  const { geocodeDestination, fetchClimate, distanceFromParisKm } = await import("@/integrations/external/geo-weather.server");
  const { searchHotelsStayApi } = await import("@/integrations/external/stayapi-hotels.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
  const [place, aggregated] = await Promise.all([geocodeDestination(destinationQuery), aggregateParticipantPreferences(supabaseAdmin, tripId)]);
  if (!place) return { ok: false as const, message: `Destination "${destinationQuery}" introuvable.`, destinationsCount: 0, accommodationsCount: 0, activitiesCount: 0, providerErrors: [] as string[] };
  const nights: number = prefs?.duration_nights ?? Math.max(1, trip.duration_nights ?? 2);
  const checkin = (trip.start_date as string | null) ?? null;
  const checkout = (trip.end_date as string | null) ?? null;
  const partsRes = await supabaseAdmin.from("trip_participants").select("id, user_id, email, display_name, status").eq("trip_id", tripId);
  const participantsList = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");
  const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
  const participants = Math.max(1, getEffectiveParticipantsCount(trip, participantsList));
  const climate = await fetchClimate(place.latitude, place.longitude, checkin && checkout ? { startDate: checkin, endDate: checkout } : {});
  const normalizedQuery = destinationQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const slugQuery = normalizedQuery.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const existingDest = await supabaseAdmin.from("destinations").select("id, slug, source, external_id, name, country").or(`slug.eq.${slugQuery},name.ilike.${destinationQuery}`).maybeSingle();
  const slug = existingDest.data?.slug ?? slugQuery;
  const externalId = existingDest.data?.external_id ?? `discovery:${slug}`;
  const source = existingDest.data?.source ?? "krew_discovery";
  const soloRoomRequests = (aggregated.individualPreferences ?? []).filter((p: any) => {
    const room = String(p.roomTypePreference ?? p.room_type_preference ?? "").toLowerCase();
    return p.acceptsSharedRoom === false || /solo|single|individuelle/.test(room);
  }).length;
  const rooms = Math.max(1, Math.ceil((participants + soloRoomRequests) / 2));
  const searchParams = checkin && checkout ? { destination: existingDest.data?.name ?? place.name, latitude: place.latitude, longitude: place.longitude, checkin, checkout, adults: participants, rooms, requiredAmenities: aggregated.requiredAmenities ?? [], roomTypePreferences: aggregated.roomTypePreferences ?? [] } : null;
  const providerErrors: string[] = [];
  let hotels: Awaited<ReturnType<typeof searchHotelsStayApi>> = [];

  const stayApiKey = process.env["STAYAPI_API_KEY"] ?? "";
  if (!checkin || !checkout) {
    providerErrors.push("Dates réelles absentes : disponibilité et prix non vérifiés");
  } else if (process.env["STAYAPI_ENABLED"] === "false") {
    providerErrors.push("StayAPI temporairement désactivée");
  } else if (!stayApiKey) {
    providerErrors.push("STAYAPI_API_KEY is not configured");
  } else {
    console.info("[Krew API] Recherche hébergements en cours via StayAPI...");
    try {
      hotels = await searchHotelsStayApi(searchParams!);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerErrors.push(message.slice(0, 500));
      console.error("[Krew API] StayAPI accommodation search failed:", message);
    }
  }

  // The existing KREW allocation reserves 35% of the trip budget for lodging.
  // A veto remains hard; the median/aggregated amount is the target.
  const targetStayPerPerson = Math.max(0, Number(aggregated.aggregatedBudget ?? trip.budget_per_person ?? 0) * 0.35);
  const hardTripCap = aggregated.hasBudgetVeto
    ? Number(aggregated.vetoBudgetMax ?? 0)
    : Number(aggregated.minGroupBudget ?? 0);
  const hardStayPerPerson = hardTripCap > 0 ? hardTripCap * 0.35 : null;
  const rawHotelsCount = hotels.length;
  if (hardStayPerPerson != null) {
    hotels = hotels.filter((hotel) => (hotel.offers[0]?.perPersonStay ?? Infinity) <= hardStayPerPerson);
  } else if (targetStayPerPerson > 0) {
    // Keep a small premium band, but never allow massively over-target offers.
    hotels = hotels.filter((hotel) => (hotel.offers[0]?.perPersonStay ?? Infinity) <= targetStayPerPerson * 1.25);
  }
  const minRating = Number(aggregated.minAccommodationRating ?? 0);
  const afterBudgetCount = hotels.length;
  if (minRating > 0) hotels = hotels.filter((h) => !h.rating || h.rating >= minRating);
  console.info("[Krew API] StayAPI accommodation results", {
    destination: destinationQuery,
    rawHotelsCount,
    afterBudgetCount,
    validHotelsCount: hotels.length,
    minRating,
  });
  const nightlyPrices = hotels.map((h) => h.offers[0]?.pricePerNight ?? 0).filter((p) => p > 0).sort((a, b) => a - b);
  const medianNightly = nightlyPrices.length ? nightlyPrices[Math.floor(nightlyPrices.length / 2)] : null;
  const destinationRow = { ...(existingDest.data?.id ? { id: existingDest.data.id } : {}), slug, name: existingDest.data?.name ?? place.name, country: (existingDest.data?.country ?? place.country) || "—", description: climate.summary, latitude: place.latitude, longitude: place.longitude, climate: { months: climate.months, forecast: climate.forecast ?? null, summary: climate.summary }, best_months: climate.bestMonths, distance_from_paris_km: distanceFromParisKm(place.latitude, place.longitude), ...(medianNightly ? { avg_daily_cost: Math.round(medianNightly / Math.max(1, participants) + 55) } : {}), source, external_id: externalId };
  const destUpsert = await supabaseAdmin.from("destinations").upsert(destinationRow as never, { onConflict: "slug" }).select("id").single();
  if (destUpsert.error) throw destUpsert.error;
  const destinationId = (destUpsert.data as { id: string }).id;
  let activitiesCount = 0;
  const rapidApiKey = process.env["HOTELS_RAPIDAPI_KEY"] ?? process.env["RAPIDAPI_KEY"] ?? "";
  if (rapidApiKey && process.env["ACTIVITY_PROVIDERS_ENABLED"] !== "false") {
    try {
      const { searchActivitiesAllProviders } = await import("@/integrations/external/travel-providers.server");
      const activityResult = await searchActivitiesAllProviders({ rapidApiKey }, {
        destination: existingDest.data?.name ?? place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        checkin,
        checkout,
        adults: participants,
      });
      providerErrors.push(...activityResult.errors);
      const activityRows = activityResult.activities.map((activity) => ({
        destination_id: destinationId,
        name: activity.name,
        category: normalizeActivityCategory(activity.name, activity.category),
        description: activity.description,
        price_per_person: activity.pricePerPerson,
        duration_hours: activity.durationHours,
        rating: activity.rating,
        image_url: activity.imageUrl,
        booking_url: activity.bookingUrl,
        source: activity.provider,
        external_id: activity.externalId,
      }));
      if (activityRows.length) {
        const existingActivities = await supabaseAdmin
          .from("activities")
          .select("id, source, external_id")
          .in("external_id", activityRows.map((row) => row.external_id));
        const activityIds = new Map(
          (existingActivities.data ?? []).map((row: any) => [`${row.source}:${row.external_id}`, row.id]),
        );
        const rowsWithIds = activityRows.map((row) => ({
          ...row,
          id: activityIds.get(`${row.source}:${row.external_id}`) ?? crypto.randomUUID(),
        }));
        const activityUpsert = await supabaseAdmin.from("activities").upsert(rowsWithIds as never, { onConflict: "id" }).select("id");
        if (activityUpsert.error) providerErrors.push(`upsert activités: ${activityUpsert.error.message}`);
        else activitiesCount = activityUpsert.data?.length ?? activityRows.length;
      }
    } catch (error) {
      providerErrors.push(`activités: ${String(error).slice(0, 300)}`);
    }
  }
  let accommodationsCount = 0;
  if (hotels.length) {
    const rows = hotels.map((h) => { const best = h.offers.find((offer) => Boolean(offer.url)) ?? h.offers[0]; return { destination_id: destinationId, name: h.name, type: h.type || "other", description: h.description, price_per_night_per_person: Math.max(1, Math.round(best?.perPersonPerNight ?? 0)), capacity: h.capacity ?? 0, rating: h.rating > 5 ? Math.round((h.rating / 2) * 10) / 10 : h.rating, distance_center_km: h.distanceCenterKm, image_url: h.imageUrl, price_offers: h.offers, best_provider: best?.provider ?? null, booking_url: best?.url ?? null, source: best?.provider ?? "stayapi", external_id: h.externalId, price_verified: true, availability_verified: true, verification_state: "confirmed" }; });
    // Do not rely on a composite ON CONFLICT target here: some deployed KREW
    // databases only have a partial unique index for (source, external_id),
    // which PostgREST cannot infer. Resolve existing rows first, then let the
    // regular primary-key upsert update them or insert new provider results.
    const existing = await supabaseAdmin
      .from("accommodations")
      .select("id, source, external_id")
      .in("external_id", rows.map((row) => row.external_id));
    if (existing.error) {
      providerErrors.push(`lecture hébergements existants: ${existing.error.message}`);
    }
    const existingIds = new Map(
      (existing.data ?? []).map((row: any) => [`${row.source}:${row.external_id}`, row.id]),
    );
    const rowsWithIds = rows.map((row) => {
      const id = existingIds.get(`${row.source}:${row.external_id}`);
      return { ...row, id: id ?? crypto.randomUUID() };
    });
    const res = await supabaseAdmin
      .from("accommodations")
      .upsert(rowsWithIds as never, { onConflict: "id" })
      .select("id");
    if (res.error) providerErrors.push(`upsert hébergements: ${res.error.message}`); else accommodationsCount = res.data?.length ?? rows.length;
  }
  console.info("[Krew API] StayAPI accommodation persistence", {
    destination: destinationQuery,
    validHotelsCount: hotels.length,
    accommodationsCount,
    providerErrorsCount: providerErrors.length,
  });
  if (accommodationsCount === 0) {
    return {
      ok: false as const,
      message: providerErrors[0] ?? `StayAPI n'a retourné aucun hôtel exploitable pour ${destinationQuery}.`,
      destination: place.name,
      country: place.country,
      nights,
      weatherSummary: climate.summary,
      bestMonths: climate.bestMonths,
      medianNightly,
      comparedProviders: [] as string[],
      destinationsCount: 1,
      accommodationsCount: 0,
      activitiesCount,
      providerErrors,
    };
  }
  return { ok: true as const, destination: place.name, country: place.country, nights, weatherSummary: climate.summary, bestMonths: climate.bestMonths, medianNightly, comparedProviders: [...new Set(hotels.flatMap((h) => h.offers.map((o) => o.provider)))], destinationsCount: 1, accommodationsCount, activitiesCount, providerErrors };
}

/** Shares identical in-flight provider work within a server instance. */
export function refreshExternalCatalogForTrip(
  supabase: any,
  tripId: string,
  destinationQuery: string,
) {
  const key = `${tripId}:${destinationQuery.trim().toLowerCase()}`;
  const pending = externalSearchesInFlight.get(key);
  if (pending) return pending;
  const request = runExternalCatalogRefresh(supabase, tripId, destinationQuery).finally(() => {
    externalSearchesInFlight.delete(key);
  });
  externalSearchesInFlight.set(key, request);
  return request;
}

export const searchExternalForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertNotRateLimited(supabase, {
      tripId: data.tripId,
      userId,
      kind: "logistics",
      windowSeconds: Number(process.env["RATE_LIMIT_LOGISTICS_WINDOW_SEC"]) || 120,
      maxCalls: Number(process.env["RATE_LIMIT_LOGISTICS_MAX"]) || 1,
    });
    const destinationQuery = await resolveDesiredDestination(supabase, data.tripId);
    if (!destinationQuery) return { ok: false as const, message: "Choisissez une destination souhaitée pour lancer la recherche externe.", destinationsCount: 0, accommodationsCount: 0, activitiesCount: 0, providerErrors: [] as string[] };
    return refreshExternalCatalogForTrip(supabase, data.tripId, destinationQuery);
  });
