import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tripInputSchema } from "@/lib/krew/trip-service";
import { isTripAdmin } from "@/lib/krew/engine";

export const tripParticipantsCountInputSchema = z.object({
  tripId: z.string().uuid(),
  participantsCount: z.number().int().min(2).max(25),
});

export async function updateTripParticipantsCountForUser(
  supabase: any,
  userId: string,
  data: z.infer<typeof tripParticipantsCountInputSchema>,
) {
  const trip = await supabase
    .from("trips")
    .select("id, owner_id, co_organizer_id")
    .eq("id", data.tripId)
    .maybeSingle();
  if (trip.error) throw trip.error;
  if (!trip.data) throw new Error("Voyage introuvable");
  if (!isTripAdmin(trip.data, userId))
    throw new Error("Seul l'organisateur ou le co-organisateur peut modifier le groupe");
  const updated = await supabase
    .from("trips")
    .update({ participants_count: data.participantsCount, updated_at: new Date().toISOString() })
    .eq("id", data.tripId)
    .select("participants_count")
    .single();
  if (updated.error) throw updated.error;
  return { participantsCount: updated.data.participants_count };
}

export const updateTripParticipantsCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string; participantsCount: number }) =>
    tripParticipantsCountInputSchema.parse(data),
  )
  .handler(async ({ data, context }) => {
    return updateTripParticipantsCountForUser(context.supabase, context.userId, data);
  });

export async function createTripHelper(
  supabase: any,
  userId: string,
  email: string,
  data: z.infer<typeof tripInputSchema>,
) {
  const wantsStar =
    Boolean(data.celebratedPerson) ||
    ["evg", "evjf", "anniversaire", "retraite"].includes(String(data.eventType));

  // Payloads progressifs : on élargit le fallback si le schéma Lovable est incomplet
  const fullPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    celebrated_person: data.celebratedPerson ?? null,
    start_date: data.startDate ?? null,
    end_date: data.endDate ?? null,
    participants_count: data.participants,
    budget_per_person: data.budgetPerPerson ?? 400,
    departure_city: data.departureCity ?? null,
    group_age_range: data.groupAgeRange,
    status: "en_preparation",
    has_star: wantsStar,
    duration_nights: data.durationNights ?? 2,
  };
  const midPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    celebrated_person: data.celebratedPerson ?? null,
    participants_count: data.participants,
    budget_per_person: data.budgetPerPerson ?? 400,
    departure_city: data.departureCity ?? null,
    group_age_range: data.groupAgeRange,
    status: "en_preparation",
    duration_nights: data.durationNights ?? 2,
  };
  const minimalPayload: Record<string, unknown> = {
    owner_id: userId,
    name: data.name,
    event_type: data.eventType,
    participants_count: data.participants ?? 2,
    duration_nights: data.durationNights ?? 2,
  };

  let trip;
  if (wantsStar) {
    // Pour les voyages nécessitant une Star (EVG, EVJF, Anniversaire, Retraite) :
    // On s'assure que celebrated_person et has_star sont TOUJOURS présents dans les fallbacks
    // et qu'on ne masque pas les erreurs en tombant sur un payload sans Star.
    const starMidPayload: Record<string, unknown> = {
      ...midPayload,
      has_star: true,
      duration_nights: data.durationNights ?? 2,
      group_age_range: data.groupAgeRange,
    };
    const starMinimalPayload: Record<string, unknown> = {
      owner_id: userId,
      name: data.name,
      event_type: data.eventType,
      celebrated_person: data.celebratedPerson ?? null,
      participants_count: data.participants ?? 2,
      has_star: true,
      duration_nights: data.durationNights ?? 2,
    };

    trip = await supabase
      .from("trips")
      .insert(fullPayload as any)
      .select("*")
      .single();
    if (trip.error) {
      console.error("createTrip [Star Type] fullPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(starMidPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip [Star Type] starMidPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(starMinimalPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip [Star Type] starMinimalPayload failed:", trip.error);
      throw new Error(
        `Création voyage impossible (type Star): ${trip.error.message || JSON.stringify(trip.error)}. ` +
          "Vérifie le SQL trips (RLS insert + colonnes) dans Supabase.",
      );
    }
  } else {
    // Comportement hérité pour les voyages sans Star (Défaut / Weekend / etc.)
    trip = await supabase
      .from("trips")
      .insert(fullPayload as any)
      .select("*")
      .single();
    if (trip.error) {
      console.warn("createTrip fullPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(midPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.warn("createTrip midPayload failed:", trip.error);
      trip = await supabase
        .from("trips")
        .insert(minimalPayload as any)
        .select("*")
        .single();
    }
    if (trip.error) {
      console.error("createTrip minimalPayload failed:", trip.error);
      throw new Error(
        `Création voyage impossible: ${trip.error.message || JSON.stringify(trip.error)}. ` +
          "Vérifie le SQL trips (RLS insert + colonnes) dans Supabase.",
      );
    }
  }
  if (!trip.data?.id) {
    throw new Error("Création voyage impossible: aucune donnée retournée");
  }

  const prefs = await supabase.from("trip_preferences").insert({
    trip_id: trip.data.id,
    average_age: data.averageAge ?? null,
    relation: data.relation ?? null,
    ambiances: data.ambiances ?? [],
    activity_categories: data.activityCategories ?? [],
    desired_destination: data.desiredDestination ?? null,
    let_krew_decide: data.letKrewDecide ?? true,
    max_distance_km: data.maxDistanceKm ?? null,
    excluded_countries: data.excludedCountries ?? [],
    duration_nights: data.durationNights ?? 2,
    max_budget: data.maxBudget ?? null,
    needs_city_center: data.needsCityCenter ?? false,
    mobility_notes: data.mobilityNotes ?? null,
    dietary_constraints: data.dietaryConstraints ?? [],
    availability_notes: data.availabilityNotes ?? null,
  });
  // Ne pas annuler le voyage si la table prefs est absente / partielle
  if (prefs.error) {
    console.error("trip_preferences insert skipped", prefs.error.message);
  }

  const organizerName = data.organizerFirstName ? String(data.organizerFirstName).trim() : null;

  const partInsert = await supabase.from("trip_participants").insert({
    trip_id: trip.data.id,
    user_id: userId,
    email: email,
    display_name: organizerName,
    role: "organisateur",
    status: "accepte",
  });
  if (partInsert.error) {
    // Fallback sans rôle custom si contrainte DB
    const retry = await supabase.from("trip_participants").insert({
      trip_id: trip.data.id,
      user_id: userId,
      email: email,
      display_name: organizerName,
      status: "accepte",
    });
    if (retry.error) {
      console.error("trip_participants insert failed", retry.error);
      // Le voyage existe déjà : on ne bloque pas, l'owner reste identifiable via owner_id
    }
  }

  // Optionnel : synchronise le prénom sur le profil
  if (organizerName) {
    try {
      await supabase
        .from("profiles")
        .upsert(
          { id: userId, full_name: organizerName, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
    } catch {
      /* ignore */
    }
  }

  return { tripId: trip.data.id as string };
}

export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tripInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims.email as string | undefined) ?? "";
    return createTripHelper(supabase, userId, email, data);
  });
