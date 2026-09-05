import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isTripAdmin } from "@/lib/krew/engine";

function slugifyDestination(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const selectManualDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        destination: z.string().trim().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cleanName = data.destination.replace(/\s+/g, " ").trim();

    const tripRes = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id, group_logistics")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripRes.error) throw tripRes.error;
    if (!tripRes.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripRes.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l’organisateur ou co-organisateur peut choisir la destination",
      );
    }

    const { geocodeDestination, distanceFromParisKm, fetchClimate } = await import(
      "@/integrations/external/geo-weather.server"
    );
    const geo = await geocodeDestination(cleanName);
    if (!geo) {
      throw new Error("Destination introuvable. Précise une ville, une île ou une région connue.");
    }

    const country = String(
      (geo as any).country || (geo as any).countryName || (geo as any).country_code || "À préciser",
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existingRes = await supabaseAdmin
      .from("destinations")
      .select("id, name, country")
      .ilike("name", cleanName)
      .limit(1)
      .maybeSingle();
    if (existingRes.error) throw existingRes.error;

    let destinationId = (existingRes.data as any)?.id as string | undefined;
    let destinationName = (existingRes.data as any)?.name as string | undefined;
    let destinationCountry = (existingRes.data as any)?.country as string | undefined;

    if (!destinationId) {
      const baseSlug = slugifyDestination(cleanName) || "destination";
      const climate = await fetchClimate(geo.latitude, geo.longitude).catch(() => null);
      const inserted = await supabaseAdmin
        .from("destinations")
        .upsert(
          {
            slug: `manual-${baseSlug}`,
            name: cleanName,
            country,
            description: "Destination choisie manuellement par le groupe.",
            distance_from_paris_km: distanceFromParisKm(geo.latitude, geo.longitude),
            latitude: geo.latitude,
            longitude: geo.longitude,
            climate: climate ?? {},
            best_months: climate?.bestMonths ?? [],
            env_tags: [],
            anchor_places: [cleanName],
            source: "manual_group_choice",
            verification_state: "manual",
          } as any,
          { onConflict: "slug" },
        )
        .select("id, name, country")
        .single();
      if (inserted.error) throw inserted.error;
      destinationId = inserted.data.id;
      destinationName = inserted.data.name;
      destinationCountry = inserted.data.country;
    }

    const deselect = await supabaseAdmin
      .from("recommendations")
      .update({ is_selected: false })
      .eq("trip_id", data.tripId);
    if (deselect.error) throw deselect.error;

    const recommendation = await supabaseAdmin
      .from("recommendations")
      .insert({
        trip_id: data.tripId,
        destination_id: destinationId,
        score: 0,
        rationale: "Destination renseignée manuellement par le groupe.",
        match_reasons: ["Choisie par le groupe"],
        budget: { manualChoice: true },
        activity_ids: [],
        is_selected: true,
      } as any)
      .select("id")
      .single();
    if (recommendation.error) throw recommendation.error;

    const prefs = await supabaseAdmin.from("trip_preferences").upsert(
      {
        trip_id: data.tripId,
        desired_destination: destinationName || cleanName,
        let_krew_decide: false,
      },
      { onConflict: "trip_id" },
    );
    if (prefs.error) throw prefs.error;

    const previous = ((tripRes.data as any).group_logistics || {}) as Record<string, any>;
    const nextLogistics = {
      ...previous,
      destination: destinationName || cleanName,
      country: destinationCountry || country,
      hotels: [],
      hotelVotes: [],
      selectedHotelId: null,
      hotelBookingStatus: "estimé",
      hotelVoteTodo: null,
      transports: [],
      transportPicks: [],
      accommodationGeneration: null,
      accommodationProviderErrors: [],
      transportProviderErrors: [],
    };

    const tripUpdate = await supabaseAdmin
      .from("trips")
      .update({
        status: "valide",
        group_logistics: nextLogistics,
        group_itinerary: null,
        selected_activity_ids: [],
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (tripUpdate.error) throw tripUpdate.error;

    return {
      ok: true,
      recommendationId: recommendation.data.id as string,
      destinationName: destinationName || cleanName,
    };
  });
