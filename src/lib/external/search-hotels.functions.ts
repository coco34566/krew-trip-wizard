// src/lib/external/search-hotels.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDesiredDestination } from "@/lib/krew/trip-service";

/**
 * Enrichit un voyage avec des données réelles :
 *  - géocodage + climat / saisonnalité (Open-Meteo, sans clé),
 *  - hébergements comparés sur Hotels.com, Expedia, Booking.com et Kayak,
 *  - activités issues de Klook et TripAdvisor.
 *
 * Les résultats sont normalisés puis upsertés dans le catalogue Krew
 * (`destinations` / `accommodations` / `activities`) via `source` + `external_id`,
 * pour que le moteur de scoring les utilise à la prochaine génération.
 *
 * Extrait dans une fonction réutilisable pour pouvoir être appelée :
 *  - manuellement, via le bouton "Rechercher hébergements & activités" (`searchExternalForTrip`) ;
 *  - automatiquement, juste avant de (re)générer les propositions (`generateRecommendationsForTrip`),
 *    pour que les suggestions s'appuient toujours sur des données à jour.
 */
export async function refreshExternalCatalogForTrip(
  supabase: any,
  tripId: string,
  destinationQuery: string,
) {
  const tripRes = await supabase.from("trips").select("*").eq("id", tripId).single();
  if (tripRes.error || !tripRes.data) throw tripRes.error ?? new Error("Voyage introuvable");
  const trip = tripRes.data as any;

  const prefsRes = await supabase
    .from("trip_preferences")
    .select("duration_nights")
    .eq("trip_id", tripId)
    .maybeSingle();
  const prefs = (prefsRes.data ?? null) as any;

  const { geocodeDestination, fetchClimate, distanceFromParisKm } = await import(
    "@/integrations/external/geo-weather.server"
  );
  const { searchHotelsAllProviders, searchActivitiesAllProviders } = await import(
    "@/integrations/external/travel-providers.server"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { aggregateParticipantPreferences } = await import("@/lib/krew/trip-service");

  const [place, aggregated] = await Promise.all([
    geocodeDestination(destinationQuery),
    aggregateParticipantPreferences(supabaseAdmin, tripId),
  ]);
  if (!place) {
    return {
      ok: false as const,
      message: `Destination "${destinationQuery}" introuvable.`,
      destinationsCount: 0,
      accommodationsCount: 0,
      activitiesCount: 0,
      providerErrors: [] as string[],
    };
  }

  const nights: number = prefs?.duration_nights ?? Math.max(1, trip.duration_nights ?? 2);
  const participants: number = Math.max(1, trip.participants_count ?? 2);
  const climate = await fetchClimate(place.latitude, place.longitude, {
    startDate: trip.start_date ?? null,
    endDate: trip.end_date ?? null,
  });

  const slug = place.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const rapidApiKey = process.env["HOTELS_RAPIDAPI_KEY"] ?? "";
  // Hosts optionnels — défauts dans DEFAULT_RAPIDAPI_HOSTS (travel-providers.server.ts)
  const providerConfig = {
    rapidApiKey,
    hotelsHost: process.env["HOTELS_RAPIDAPI_HOST"] ?? process.env["HOTELS_COM_RAPIDAPI_HOST"],
    hotelsComHost: process.env["HOTELS_COM_RAPIDAPI_HOST"] ?? process.env["HOTELS_RAPIDAPI_HOST"],
    bookingHost: process.env["BOOKING_RAPIDAPI_HOST"],
    expediaHost: process.env["EXPEDIA_RAPIDAPI_HOST"],
    kayakHost: process.env["KAYAK_RAPIDAPI_HOST"],
    tripadvisorHost: process.env["TRIPADVISOR_RAPIDAPI_HOST"],
    klookHost: process.env["KLOOK_RAPIDAPI_HOST"],
  };
  const searchParams = {
    destination: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    checkin: trip.start_date ?? null,
    checkout: trip.end_date ?? null,
    adults: participants,
    requiredAmenities: aggregated.requiredAmenities ?? [],
    roomTypePreferences: aggregated.roomTypePreferences ?? [],
  };

  const providerErrors: string[] = [];
  let hotels: Awaited<ReturnType<typeof searchHotelsAllProviders>>["hotels"] = [];
  let activities: Awaited<ReturnType<typeof searchActivitiesAllProviders>>["activities"] = [];

  if (rapidApiKey) {
    const [hotelRes, activityRes] = await Promise.all([
      searchHotelsAllProviders(providerConfig, searchParams),
      searchActivitiesAllProviders(providerConfig, searchParams),
    ]);
    hotels = hotelRes.hotels;
    activities = activityRes.activities;
    providerErrors.push(...hotelRes.errors, ...activityRes.errors);
  } else {
    providerErrors.push("Aucune clé RapidAPI configurée : seules la météo et la saisonnalité ont été mises à jour.");
  }

  // Coût quotidien moyen déduit des prix réels observés.
  const nightlyPrices = hotels
    .map((h) => h.offers[0]?.pricePerNight ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const medianNightly = nightlyPrices.length
    ? (nightlyPrices[Math.floor(nightlyPrices.length / 2)] as number)
    : null;

  const destinationRow = {
    slug,
    name: place.name,
    country: place.country || "—",
    description: climate.summary,
    latitude: place.latitude,
    longitude: place.longitude,
    climate: { months: climate.months, forecast: climate.forecast ?? null, summary: climate.summary },
    best_months: climate.bestMonths,
    distance_from_paris_km: distanceFromParisKm(place.latitude, place.longitude),
    ...(medianNightly ? { avg_daily_cost: Math.round(medianNightly / Math.max(1, participants) + 55) } : {}),
    source: "open-meteo",
    external_id: `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`,
  };

  const destUpsert = await supabaseAdmin
    .from("destinations")
    .upsert(destinationRow as never, { onConflict: "slug" })
    .select("id")
    .single();
  if (destUpsert.error) throw destUpsert.error;
  const destinationId = (destUpsert.data as { id: string }).id;

  let accommodationsCount = 0;
  if (hotels.length) {
    const rows = hotels.slice(0, 30).map((h) => {
      const best = h.offers[0];
      return {
        destination_id: destinationId,
        name: h.name,
        type: h.type || "hotel",
        description: h.description,
        price_per_night_per_person: Math.max(
          1,
          Math.round((best?.pricePerNight ?? 0) / Math.max(1, Math.ceil(participants / 2))),
        ),
        capacity: Math.max(2, participants),
        rating: h.rating > 5 ? Math.round((h.rating / 2) * 10) / 10 : h.rating,
        distance_center_km: h.distanceCenterKm,
        image_url: h.imageUrl,
        price_offers: h.offers,
        best_provider: best?.provider ?? null,
        booking_url: best?.url ?? null,
        source: "rapidapi",
        external_id: h.externalId,
      };
    });
    const res = await supabaseAdmin
      .from("accommodations")
      .upsert(rows as never, { onConflict: "source,external_id" });
    if (res.error) providerErrors.push(`upsert hébergements: ${res.error.message}`);
    else accommodationsCount = rows.length;
  }

  let activitiesCount = 0;
  if (activities.length) {
    const rows = activities.slice(0, 40).map((a) => ({
      destination_id: destinationId,
      name: a.name,
      category: a.category,
      description: a.description,
      price_per_person: a.pricePerPerson,
      duration_hours: a.durationHours,
      rating: a.rating > 5 ? Math.round((a.rating / 2) * 10) / 10 : a.rating,
      image_url: a.imageUrl,
      booking_url: a.bookingUrl,
      source: "rapidapi",
      external_id: a.externalId,
    }));
    const res = await supabaseAdmin
      .from("activities")
      .upsert(rows as never, { onConflict: "source,external_id" });
    if (res.error) providerErrors.push(`upsert activités: ${res.error.message}`);
    else activitiesCount = rows.length;
  }

  return {
    ok: true as const,
    destination: place.name,
    country: place.country,
    nights,
    weatherSummary: climate.summary,
    bestMonths: climate.bestMonths,
    medianNightly,
    comparedProviders: [...new Set(hotels.flatMap((h) => h.offers.map((o) => o.provider)))],
    destinationsCount: 1,
    accommodationsCount,
    activitiesCount,
    providerErrors,
  };
}

export const searchExternalForTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tripId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Résout la destination souhaitée en cherchant d'abord au niveau du voyage
    // (`trip_preferences`), puis, si vide, la destination la plus citée dans
    // les questionnaires individuels des participants (`trip_participant_preferences`).
    const destinationQuery = await resolveDesiredDestination(supabase, data.tripId);
    if (!destinationQuery) {
      return {
        ok: false as const,
        message: "Choisissez une destination souhaitée pour lancer la recherche externe.",
        destinationsCount: 0,
        accommodationsCount: 0,
        activitiesCount: 0,
        providerErrors: [] as string[],
      };
    }

    return refreshExternalCatalogForTrip(supabase, data.tripId, destinationQuery);
  });
