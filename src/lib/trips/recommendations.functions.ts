import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aggregateParticipantPreferences, generateRecommendationsForTrip } from "@/lib/krew/trip-service";
import { PROFILE_LABELS, STAY_PROFILE_IDS, type StayConcept, type StayProfileId } from "@/lib/krew/stay-profiles";
import { assertNotRateLimited } from "@/lib/krew/rate-limit.server";
import { isTripAdmin } from "@/lib/krew/engine";
import { normalizeStayConcepts } from "./shared";

export const stayProfileValidationSchema = z.object({
  tripId: z.string().uuid(),
  selectedConceptIds: z.array(z.string()).min(1).max(3),
});

export function selectValidatedStayConcepts(
  calculated: StayConcept[],
  selectedConceptIds: string[],
): StayConcept[] {
  if (!selectedConceptIds.length) throw new Error("Sélectionnez au moins un profil de voyage");
  if (selectedConceptIds.length > 3) throw new Error("Sélectionnez au maximum 3 profils de voyage");

  const normalizedCalculated = normalizeStayConcepts(calculated);
  const allowedIds = new Set(normalizedCalculated.map((c) => c.id));

  const validIds = selectedConceptIds.filter((id): id is StayProfileId =>
    (STAY_PROFILE_IDS as readonly string[]).includes(id),
  );
  if (validIds.length !== selectedConceptIds.length) {
    throw new Error("Profil de voyage invalide");
  }

  const uniqueIds = [...new Set(validIds)];

  for (const profileId of uniqueIds) {
    if (!allowedIds.has(profileId)) {
      throw new Error("Profil de voyage non proposé pour ce séjour");
    }
  }

  return uniqueIds.map((profileId) => {
    const matched = normalizedCalculated.find((c) => c.id === profileId);
    return {
      id: profileId,
      profiles: [profileId],
      title: PROFILE_LABELS[profileId],
      score: matched?.score ?? 50,
      rationale: matched?.rationale ?? PROFILE_LABELS[profileId],
    };
  });
}

export const validateStayProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => stayProfileValidationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("*")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data || !isTripAdmin(trip.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l’organisateur ou co-organisateur peut valider le profil",
      );
    }
    const storedCalculated = normalizeStayConcepts(((trip.data as any).stay_concepts_calculated ?? []));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const aggregated = await aggregateParticipantPreferences(supabaseAdmin, data.tripId);
    const calculated = storedCalculated.length ? storedCalculated : normalizeStayConcepts((aggregated.stayConcepts ?? []).slice(0, 3));
    const selected = selectValidatedStayConcepts(calculated, data.selectedConceptIds);
    const { error } = await supabase
      .from("trips")
      .update({
        stay_concepts_calculated: calculated,
        stay_concepts_selected: selected,
        stay_profile_validated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.tripId);
    if (error) throw error;
    return { calculatedConcepts: calculated, selectedConcepts: selected, validated: true };
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await supabase
      .from("trips")
      .select("owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (trip.error) throw trip.error;
    if (!trip.data || !isTripAdmin(trip.data, userId))
      throw new Error("403 Forbidden: génération réservée aux organisateurs");

    const { canServeFromCandidatePool } = await import("@/lib/krew/trip-service");
    const canServeFromPool = await canServeFromCandidatePool(supabase, data.tripId);

    if (!canServeFromPool) {
      // Check user-level rate limit first (across all trips)
      const userWindow = Number(process.env["RATE_LIMIT_USER_RECOMMENDATIONS_WINDOW_SEC"]) || 300;
      const userMax = Number(process.env["RATE_LIMIT_USER_RECOMMENDATIONS_MAX"]) || 3;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "recommendations",
        windowSeconds: userWindow,
        maxCalls: userMax,
        isUserCheck: true,
      });

      // Check trip-level rate limit (inserts rate limit entry if allowed)
      const tripWindow = Number(process.env["RATE_LIMIT_RECOMMENDATIONS_WINDOW_SEC"]) || 300;
      const tripMax = Number(process.env["RATE_LIMIT_RECOMMENDATIONS_MAX"]) || 1;
      await assertNotRateLimited(supabase, {
        tripId: data.tripId,
        userId,
        kind: "recommendations",
        windowSeconds: tripWindow,
        maxCalls: tripMax,
      });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return generateRecommendationsForTrip(supabaseAdmin, data.tripId, {
      // `force` n'est accepté qu'en usage test explicite (ALLOW_FORCE_GENERATION),
      // jamais comme comportement par défaut en production.
      force: data.force === true && process.env["ALLOW_FORCE_GENERATION"] === "true",
    });
  });

export const getGenerationReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tripId: string }) => z.object({ tripId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const access = await context.supabase
      .from("trips")
      .select("id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (access.error) throw access.error;
    if (!access.data) throw new Error("403 Forbidden");

    const [{ assessGenerationReadiness }, { supabaseAdmin }] = await Promise.all([
      import("@/lib/krew/trip-service"),
      import("@/integrations/supabase/client.server"),
    ]);
    return assessGenerationReadiness(supabaseAdmin, data.tripId);
  });

export const toggleVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), recommendationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const recommendation = await supabase
      .from("recommendations")
      .select("id")
      .eq("id", data.recommendationId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (recommendation.error) throw recommendation.error;
    if (!recommendation.data) {
      throw new Error("Cette recommandation n'appartient pas à ce voyage");
    }
    const existing = await supabase
      .from("recommendation_votes")
      .select("id")
      .eq("recommendation_id", data.recommendationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing.data) {
      const { error } = await supabase
        .from("recommendation_votes")
        .delete()
        .eq("id", existing.data.id);
      if (error) throw error;
      return { voted: false };
    }
    const { error } = await supabase.from("recommendation_votes").insert({
      recommendation_id: data.recommendationId,
      trip_id: data.tripId,
      user_id: userId,
      value: 1,
    });
    if (error) throw error;
    return { voted: true };
  });

export const selectRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tripId: z.string().uuid(), recommendationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const tripAccess = await supabase
      .from("trips")
      .select("id, owner_id, co_organizer_id")
      .eq("id", data.tripId)
      .maybeSingle();
    if (tripAccess.error) throw tripAccess.error;
    if (!tripAccess.data) throw new Error("Voyage introuvable");
    if (!isTripAdmin(tripAccess.data, userId)) {
      throw new Error(
        "403 Forbidden: seul l'organisateur ou co-organisateur peut choisir la destination",
      );
    }

    const authorizedReco = await supabase
      .from("recommendations")
      .select("id")
      .eq("id", data.recommendationId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (authorizedReco.error) throw authorizedReco.error;
    if (!authorizedReco.data) {
      throw new Error("Cette recommandation n'appartient pas à ce voyage");
    }

    // 1. Récupère le brief_fingerprint AVANT toute modification des préférences
    const { getCurrentBriefFingerprint } = await import("@/lib/krew/trip-service");
    let activeFingerprint: string | null = null;
    try {
      activeFingerprint = await getCurrentBriefFingerprint(supabase, data.tripId);
    } catch (err) {
      console.warn("Could not fetch brief Fingerprint before selection:", err);
    }

    // Désélectionne les autres propositions
    await supabase
      .from("recommendations")
      .update({ is_selected: false })
      .eq("trip_id", data.tripId);

    // Sélectionne la reco choisie + récupère le nom de destination
    const { data: reco, error: recoError } = await supabase
      .from("recommendations")
      .update({ is_selected: true })
      .eq("id", data.recommendationId)
      .eq("trip_id", data.tripId)
      .select("id, destinations(name)")
      .single();
    if (recoError) throw recoError;

    // Synchronise desired_destination pour que « Rechercher hébergements & activités » fonctionne
    const destName = (reco as any)?.destinations?.name;
    if (typeof destName === "string" && destName.trim()) {
      const cleanName = destName.trim();
      await supabase.from("trip_preferences").upsert(
        {
          trip_id: data.tripId,
          desired_destination: cleanName,
          let_krew_decide: false,
        },
        { onConflict: "trip_id" },
      );

      // Update destination_candidate_pool status to selected using activeFingerprint captured BEFORE preference modification
      if (activeFingerprint) {
        try {
          const normKey = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
          await supabase
            .from("destination_candidate_pool")
            .update({
              status: "selected",
              selected_at: new Date().toISOString(),
            } as any)
            .eq("trip_id", data.tripId)
            .eq("brief_fingerprint", activeFingerprint)
            .eq("destination_key", normKey);
        } catch (poolErr) {
          console.warn("destination_candidate_pool selected update skipped:", poolErr);
        }
      }
    }

    await supabase.from("trips").update({ status: "valide" }).eq("id", data.tripId);

    // Auto-apprentissage : une destination estimée par l'IA et réellement
    // choisie par un groupe entre définitivement au catalogue.
    try {
      const chosen = await supabase
        .from("recommendations")
        .select("destination_id")
        .eq("id", data.recommendationId)
        .eq("trip_id", data.tripId)
        .maybeSingle();
      const chosenDestId = (chosen.data as any)?.destination_id as string | undefined;
      if (chosenDestId) {
        await supabase
          .from("destinations")
          .update({ source: "krew_catalog" })
          .eq("id", chosenDestId)
          .eq("source", "ai_estimate");
      }
    } catch {
      /* non bloquant */
    }

    // Marque le feedback de scoring pour apprentissage
    try {
      const full = await supabase
        .from("recommendations")
        .select("id, destination_id, score, budget")
        .eq("id", data.recommendationId)
        .eq("trip_id", data.tripId)
        .maybeSingle();
      const tripRow = await supabase
        .from("trips")
        .select("event_type")
        .eq("id", data.tripId)
        .maybeSingle();
      const eventType = ((tripRow.data as any)?.event_type as string) || "default";
      const destId = full.data?.destination_id;
      if (destId) {
        // marque l'entrée feedback la plus récente pour ce trip+dest
        const fb = await supabase
          .from("scoring_feedback")
          .select("id")
          .eq("trip_id", data.tripId)
          .eq("destination_id", destId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fb.data?.id) {
          await supabase
            .from("scoring_feedback")
            .update({ was_selected: true, recommendation_id: data.recommendationId })
            .eq("id", fb.data.id);
        } else {
          const budget = (full.data as any)?.budget ?? {};
          const ss = budget.subScores ?? {};
          await supabase.from("scoring_feedback").insert({
            trip_id: data.tripId,
            destination_id: destId,
            recommendation_id: data.recommendationId,
            event_type: eventType,
            was_selected: true,
            final_score: full.data?.score ?? null,
            s_ambiance: ss.sAmbiance ?? null,
            s_activities: ss.sActivities ?? null,
            s_budget: ss.sBudget ?? null,
            s_distance: ss.sDistance ?? null,
            s_season: ss.sSeason ?? null,
            s_quality: ss.sQuality ?? null,
            s_consensus: ss.sConsensus ?? null,
            s_min_satisfaction: ss.sMinSatisfaction ?? null,
          });
        }
      }
    } catch (e) {
      console.warn("scoring_feedback update skipped", e);
    }

    return { ok: true };
  });

export const reactToRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        tripId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        reaction: z.enum(["like", "dislike"]).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const email = (context.claims?.email as string | undefined)?.toLowerCase();

    const recommendation = await supabase
      .from("recommendations")
      .select("id")
      .eq("id", data.recommendationId)
      .eq("trip_id", data.tripId)
      .maybeSingle();
    if (recommendation.error) throw recommendation.error;
    if (!recommendation.data) {
      throw new Error("Cette recommandation n'appartient pas à ce voyage");
    }

    // Trouve le participant rattaché à cet utilisateur dans le voyage
    const { data: participant, error: partErr } = await supabase
      .from("trip_participants")
      .select("id")
      .eq("trip_id", data.tripId)
      .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
      .maybeSingle();

    if (partErr || !participant) {
      throw new Error("Participant non trouvé pour cet utilisateur");
    }

    if (data.reaction === null) {
      const { error } = await supabase
        .from("destination_feedback")
        .delete()
        .eq("trip_id", data.tripId)
        .eq("recommendation_id", data.recommendationId)
        .eq("participant_id", participant.id);
      if (error) throw error;
      return { ok: true, reaction: null };
    } else {
      const { error } = await supabase.from("destination_feedback").upsert(
        {
          trip_id: data.tripId,
          recommendation_id: data.recommendationId,
          participant_id: participant.id,
          reaction: data.reaction,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "trip_id,recommendation_id,participant_id",
        },
      );
      if (error) throw error;
      return { ok: true, reaction: data.reaction };
    }
  });
