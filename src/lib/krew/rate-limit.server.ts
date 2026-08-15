import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitOptions = {
  tripId: string;
  userId: string;
  kind: "recommendations" | "itinerary" | "logistics";
  windowSeconds: number;
  maxCalls: number;
  isUserCheck?: boolean;
};

function formatRemainingTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs === 0 ? `${mins} min` : `${mins} min ${secs} sec`;
}

/**
 * Atomically checks the rate limit.
 * User-level checks are read-only; trip-level checks consume the slot.
 * Fails closed if the database cannot evaluate the limit.
 */
export async function assertNotRateLimited(
  supabase: SupabaseClient,
  options: RateLimitOptions,
): Promise<void> {
  const { tripId, userId, kind, windowSeconds, maxCalls, isUserCheck = false } = options;

  const { data, error } = await supabase.rpc("consume_generation_rate_limit", {
    p_trip_id: tripId,
    p_user_id: userId,
    p_kind: kind,
    p_window_seconds: windowSeconds,
    p_max_calls: maxCalls,
    p_is_user_check: isUserCheck,
  });

  if (error) {
    console.error("[RateLimit] Impossible de vérifier le rate limit", error);
    throw new Error("RATE_LIMIT_UNAVAILABLE: impossible de vérifier la limite d'appels. Réessaie plus tard.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    const remainingSeconds = Math.max(1, Number(result?.retry_after_seconds ?? 1));
    const message = isUserCheck
      ? `Limite d'appels par utilisateur atteinte pour '${kind}'. Réessaie dans ${formatRemainingTime(remainingSeconds)}.`
      : `Une génération est déjà en cours, réessaie dans ${formatRemainingTime(remainingSeconds)}.`;
    throw new Error(`RATE_LIMITED: ${message}`);
  }
}

/**
 * Releases the latest trip-level reservation when a generation fails before
 * producing a usable result. The database function re-checks the caller identity.
 */
export async function releaseRateLimit(
  supabase: SupabaseClient,
  options: Pick<RateLimitOptions, "tripId" | "userId" | "kind">,
): Promise<void> {
  const { error } = await supabase.rpc("release_generation_rate_limit", {
    p_trip_id: options.tripId,
    p_user_id: options.userId,
    p_kind: options.kind,
  });

  if (error) {
    console.error("[RateLimit] Impossible de libérer la réservation", error);
  }
}
