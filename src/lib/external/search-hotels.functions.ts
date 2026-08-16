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
  const checkin =
    (trip.start_date as string) ||
    new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
  const checkout =
    (trip.end_date as string) ||
    new Date(new Date(checkin).getTime() + nights * 86400000).toISOString().slice(0, 10);

  const partsRes = await supabaseAdmin
    .from("trip_participants")
    .select("id, user_id, email, display_name, status")
    .eq("trip_id", tripId);
  const participantsList = (partsRes.data ?? []).filter((p: any) => p.status !== "absent");
  const { getEffectiveParticipantsCount } = await import("@/lib/krew/trip-service");
  const effCount = getEffectiveParticipantsCount(trip, participantsList);
  const participants: number = Math.max(1, effCount);

  const climate = await fetchClimate(place.latitude, place.longitude, {
    startDate: checkin,
    endDate: checkout,
  });

  const normalizedQuery = destinationQuery
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const slugQuery = normalizedQuery.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const existingDest = await supabaseAdmin
    .from("destinations")
    .select("id, slug, source, external_id, name, country")
    .or(`slug.eq.${slugQuery},name.ilike.${destinationQuery}`)
    .maybeSingle();

  const slug = existingDest.data?.slug ?? slugQuery;
  const externalId = existingDest.data?.external_id ?? `discovery:${slug}`;
  const source = existingDest.data?.source ?? "krew_discovery";

  const rapidApiKey = process.env["HOTELS_RAPIDAPI_KEY"] ?? "";
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

  const soloRoomRequests = (aggregated.individualPreferences ?? []).filter((p: any) => {
    const room = String(p.roomTypePreference ?? p.room_type_preference ?? "").toLowerCase();
    return p.acceptsSharedRoom === false || /solo|single|individuelle/.test(room);
  }).length;
  const rooms = Math.max(1, Math.ceil((participants + soloRoomRequests) / 2));

  const searchParams = {
    destination: existingDest.data?.name ?? place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    checkin,
    checkout,
    adults: participants,
    rooms,
    requiredAmenities: aggregated.requiredAmenities ?? [],
    roomTypePreferences: aggregated.roomTypePreferences ?? [],
  };

  const providerErrors: string[] = [];
  let hotels: Awaited<ReturnType<typeof searchHotelsAllProviders>>["hotels"] = [];
  let activities: Awaited<ReturnType<typeof searchActivitiesAllProviders>>["activities"] = [];

  if (rapidApiKey) {
    console.info("[Krew API] Clé HOTELS_RAPIDAPI_KEY détectée. Lancement de la recherche d'hôtels et d'activités réels.");
    const [hotelRes, activityRes] = await Promise.all([
      searchHotelsAllProviders(providerConfig, searchParams),
      searchActivitiesAllProviders(providerConfig, searchParams),
    ]);
    hotels = hotelRes.hotels;
    activities = activityRes.activities;
    providerErrors.push(...hotelRes.errors, ...activityRes.errors);
  } else {
    console.warn("[Krew API] Clé HOTELS_RAPIDAPI_KEY absente. Les fonctionnalités de recherche d'établissements réels (Hotels, TripAdvisor, Kiwi, BlaBlaCar Bus) nécessitent cette clé.");
    providerErrors.push("Aucune clé RapidAPI configurée : seules la météo et la saisonnalité ont été mises à jour.");
  }

  // Appliquer immédiatement les contraintes d'hébergement qui sont représentables
  // de façon fiable avec les données fournisseur normalisées. Les autres restent
  // disponibles au moteur de scoring afin de ne jamais inventer une contrainte.
  const minRating = Number(aggregated.minAccommodationRating ?? 0);
  if (minRating > 0) {
    hotels = hotels.filter((h) => !h.rating || h.rating >= minRating);
  }

  // Ne jamais transformer une offre fournisseur sans URL en "offre réservable".
  // Elle peut rester dans le catalogue pour enrichissement/scoring, mais seule une
  // offre disposant d'un lien fournisseur réel est éligible à une carte actionnable.
  hotels = hotels.filter((h) => h.offers.some((offer) => Boolean(offer.url)));

  const nightlyPrices = hotels
    .map((h) => h.offers[0]?.pricePerNight ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const medianNightly = nightlyPrices.length
    ? (nightlyPrices[Math.floor(nightlyPrices.length / 2)] as number)
    : null;

  const destinationRow = {
    ...(existingDest.data?.id ? { id: existingDest.data.id } : {}),
    slug,
    name: existingDest.data?.name ?? place.name,
    country: (existingDest.data?.country ?? place.country) || "—",
    description: climate.summary,
    latitude: place.latitude,
    longitude: place.longitude,
    climate: { months: climate.months, forecast: climate.forecast ?? null, summary: climate.summary },
    best_months: climate.bestMonths,
    distance_from_paris_km: distanceFromParisKm(place.latitude, place.longitude),
    ...(medianNightly ? { avg_daily_cost: Math.round(medianNightly / Math.max(1, participants) + 55) } : {}),
    source,
    external_id: externalId,
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
      const best = h.offers.find((offer) => Boolean(offer.url)) ?? h.offers[0];
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
      .upsert(rows as never, { onConflict: "source,external_id" })
      .select("id");
    if (res.error) providerErrors.push(`upsert hébergements: ${res.error.message}`);
    else accommodationsCount = res.data?.length ?? rows.length;
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
