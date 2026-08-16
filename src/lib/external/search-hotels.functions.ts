// src/lib/external/search-hotels.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDesiredDestination } from "@/lib/krew/trip-service";

export async function refreshExternalCatalogForTrip(
  supabase: any,
  tripId: string,
  destinationQuery: string,
) {
  const tripRes = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (tripRes.error || !tripRes.data) throw tripRes.error ?? new Error("Voyage introuvable");
  const trip = tripRes.data as any;
  const prefsRes = await supabase.from("trip_preferences").select("duration_nights").eq("trip_id", tripId).maybeSingle();
  const prefs = (prefsRes.data ?? null) as any;
  const { geocodeDestination, fetchClimate, distanceFromParisKm } = await import("@/integrations/external/geo-weather.server");
  const { searchHotelsAllProviders } = await import("@/integrations/external/travel-providers.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");
  const [place, aggregated] = await Promise.all([geocodeDestination(destinationQuery), aggregateParticipantPreferences(supabaseAdmin, tripId)]);
  if (!place) return { ok: false as const, message: `Destination "${destinationQuery}" introuvable.`, destinationsCount: 0, accommodationsCount: 0, activitiesCount: 0, providerErrors: [] as string[] };
  const nights: number = prefs?.duration_nights ?? Math.max(1, trip.duration_nights ?? 2);
  const checkin = (trip.start_date as string) || new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const checkout = (trip.end_date as string) || new Date(new Date(checkin).getTime() + nights * 86400000).toISOString().slice(0, 10);
  const partsRes = await supabaseAdmin.from("trip_participants").select("id, user_id, email, display_name, status").eq("trip_id", tripId);
  const participantsList = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");
  const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
  const participants = Math.max(1, getEffectiveParticipantsCount(trip, participantsList));
  const climate = await fetchClimate(place.latitude, place.longitude, { startDate: checkin, endDate: checkout });
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
  const searchParams = { destination: existingDest.data?.name ?? place.name, latitude: place.latitude, longitude: place.longitude, checkin, checkout, adults: participants, rooms, requiredAmenities: aggregated.requiredAmenities ?? [], roomTypePreferences: aggregated.roomTypePreferences ?? [] };
  const providerErrors: string[] = [];
  let hotels: Awaited<ReturnType<typeof searchHotelsAllProviders>>["hotels"] = [];
  const rapidApiKey = process.env["HOTELS_RAPIDAPI_KEY"] ?? "";
  if (rapidApiKey) {
    console.info("[Krew API] Clé HOTELS_RAPIDAPI_KEY détectée. Recherche hébergements uniquement.");
    const hotelRes = await searchHotelsAllProviders({ rapidApiKey, hotelsHost: process.env["HOTELS_RAPIDAPI_HOST"] ?? process.env["HOTELS_COM_RAPIDAPI_HOST"], hotelsComHost: process.env["HOTELS_COM_RAPIDAPI_HOST"] ?? process.env["HOTELS_RAPIDAPI_HOST"], bookingHost: process.env["BOOKING_RAPIDAPI_HOST"], expediaHost: process.env["EXPEDIA_RAPIDAPI_HOST"] }, searchParams);
    hotels = hotelRes.hotels;
    providerErrors.push(...hotelRes.errors);
  } else {
    providerErrors.push("Aucune clé RapidAPI configurée pour la recherche d'hébergements.");
  }
  const minRating = Number(aggregated.minAccommodationRating ?? 0);
  if (minRating > 0) hotels = hotels.filter((h) => !h.rating || h.rating >= minRating);
  hotels = hotels.filter((h) => h.offers.some((offer) => Boolean(offer.url)));
  const nightlyPrices = hotels.map((h) => h.offers[0]?.pricePerNight ?? 0).filter((p) => p > 0).sort((a, b) => a - b);
  const medianNightly = nightlyPrices.length ? nightlyPrices[Math.floor(nightlyPrices.length / 2)] : null;
  const destinationRow = { ...(existingDest.data?.id ? { id: existingDest.data.id } : {}), slug, name: existingDest.data?.name ?? place.name, country: (existingDest.data?.country ?? place.country) || "—", description: climate.summary, latitude: place.latitude, longitude: place.longitude, climate: { months: climate.months, forecast: climate.forecast ?? null, summary: climate.summary }, best_months: climate.bestMonths, distance_from_paris_km: distanceFromParisKm(place.latitude, place.longitude), ...(medianNightly ? { avg_daily_cost: Math.round(medianNightly / Math.max(1, participants) + 55) } : {}), source, external_id: externalId };
  const destUpsert = await supabaseAdmin.from("destinations").upsert(destinationRow as never, { onConflict: "slug" }).select("id").single();
  if (destUpsert.error) throw destUpsert.error;
  const destinationId = (destUpsert.data as { id: string }).id;
  let accommodationsCount = 0;
  if (hotels.length) {
    const rows = hotels.slice(0, 30).map((h) => { const best = h.offers.find((offer) => Boolean(offer.url)) ?? h.offers[0]; return { destination_id: destinationId, name: h.name, type: h.type || "hotel", description: h.description, price_per_night_per_person: Math.max(1, Math.round((best?.pricePerNight ?? 0) / Math.max(1, Math.ceil(participants / 2)))), capacity: Math.max(2, participants), rating: h.rating > 5 ? Math.round((h.rating / 2) * 10) / 10 : h.rating, distance_center_km: h.distanceCenterKm, image_url: h.imageUrl, price_offers: h.offers, best_provider: best?.provider ?? null, booking_url: best?.url ?? null, source: best?.provider ?? "stayapi", external_id: h.externalId }; });
    const res = await supabaseAdmin.from("accommodations").upsert(rows as never, { onConflict: "source,external_id" }).select("id");
    if (res.error) providerErrors.push(`upsert hébergements: ${res.error.message}`); else accommodationsCount = res.data?.length ?? rows.length;
  }
  return { ok: true as const, destination: place.name, country: place.country, nights, weatherSummary: climate.summary, bestMonths: climate.bestMonths, medianNightly, comparedProviders: [...new Set(hotels.flatMap((h) => h.offers.map((o) => o.provider)))], destinationsCount: 1, accommodationsCount, activitiesCount: 0, providerErrors };
}

export const searchExternalForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const destinationQuery = await resolveDesiredDestination(supabase, data.tripId);
    if (!destinationQuery) return { ok: false as const, message: "Choisissez une destination souhaitée pour lancer la recherche externe.", destinationsCount: 0, accommodationsCount: 0, activitiesCount: 0, providerErrors: [] as string[] };
    return refreshExternalCatalogForTrip(supabase, data.tripId, destinationQuery);
  });
