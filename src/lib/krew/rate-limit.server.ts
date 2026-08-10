import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitOptions = {
  tripId: string;
  userId: string;
  kind: "recommendations" | "itinerary" | "logistics";
  windowSeconds: number;
  maxCalls: number;
  isUserCheck?: boolean; // Indicateur si on vérifie la limite par utilisateur globale
};

/**
 * Formate le temps d'attente de manière lisible en français.
 */
function formatRemainingTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins} min`;
  }
  return `${mins} min ${secs} sec`;
}

/**
 * Vérifie le rate limiting pour une opération donnée.
 * Si la limite est dépassée, lève une erreur explicite avec le temps d'attente restant.
 */
export async function assertNotRateLimited(
  supabase: SupabaseClient,
  options: RateLimitOptions
): Promise<void> {
  const { tripId, userId, kind, windowSeconds, maxCalls, isUserCheck = false } = options;

  const thresholdTime = new Date(Date.now() - windowSeconds * 1000).toISOString();

  let query = supabase
    .from("generation_rate_limits")
    .select("created_at")
    .eq("kind", kind)
    .gt("created_at", thresholdTime);

  if (isUserCheck) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("trip_id", tripId);
  }

  const { data: entries, error } = await query.order("created_at", { ascending: true });

  if (error) {
    console.error("[RateLimit] Impossible de vérifier le rate limit", error);
    return;
  }

  const count = entries?.length ?? 0;

  if (count >= maxCalls && entries && entries.length > 0) {
    const oldestEntry = entries[0];
    if (!oldestEntry) return;
    const oldestTime = new Date(oldestEntry.created_at).getTime();
    const elapsedSeconds = (Date.now() - oldestTime) / 1000;
    const remainingSeconds = Math.max(1, Math.ceil(windowSeconds - elapsedSeconds));
    const formattedTime = formatRemainingTime(remainingSeconds);

    const message = isUserCheck
      ? `Limite d'appels par utilisateur atteinte pour '${kind}'. Réessaie dans ${formattedTime}.`
      : `Une génération est déjà en cours, réessaie dans ${formattedTime}.`;

    throw new Error(`RATE_LIMITED: ${message}`);
  }

  if (!isUserCheck) {
    const { error: insertError } = await supabase
      .from("generation_rate_limits")
      .insert({
        trip_id: tripId,
        user_id: userId,
        kind,
      });

    if (insertError) {
      console.error("[RateLimit] Impossible d'enregistrer l'appel de rate limit", insertError);
    }
  }
}
