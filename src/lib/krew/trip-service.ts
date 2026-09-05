export * from "./trip-service-legacy";

import {
  aggregateParticipantPreferences as aggregateLegacyParticipantPreferences,
  assessGenerationReadiness as assessLegacyGenerationReadiness,
  generateRecommendationsForTrip as generateLegacyRecommendationsForTrip,
  getDestinationBriefContext as getLegacyDestinationBriefContext,
} from "./trip-service-legacy";
import {
  distanceFromParisKm,
  fetchClimate,
  geocodeDestination,
} from "@/integrations/external/geo-weather.server";

function softenDiscoveryBudget<T extends Record<string, any>>(aggregated: T): T {
  return {
    ...aggregated,
    // External discovery/provider queries must not treat one participant's
    // personal ceiling as a group-level hard filter.
    hasBudgetVeto: false,
    minGroupBudget: null,
  };
}

function slugifyDestination(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildGroundingQueries(row: {
  name?: string | null;
  country?: string | null;
  anchor_places?: unknown;
}): string[] {
  const name = String(row.name ?? "").trim();
  const country = String(row.country ?? "").trim();
  const anchors = Array.isArray(row.anchor_places)
    ? row.anchor_places.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const ordered = [...anchors, name].filter(Boolean);
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const place of ordered) {
    const key = place
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push(country ? `${place}, ${country}` : place);
  }

  return queries;
}

function candidateSemanticScore(row: any) {
  const activities = Array.isArray(row.activity_fit) ? row.activity_fit.length : 0;
  const environments = Array.isArray(row.environment_fit) ? row.environment_fit.length : 0;
  const budget = row.budget_fit === "likely_compatible" ? 3 : row.budget_fit === "uncertain" ? 1 : -2;
  const season = row.season_fit === "good" ? 2 : row.season_fit === "mixed" ? 0 : -2;
  return activities * 2 + environments * 2 + budget + season;
}

function estimatedDailyCost(row: any, budgetPerPerson: number, nights: number) {
  const dailyTripBudget = Math.max(60, budgetPerPerson / Math.max(1, nights));
  const factor =
    row.budget_fit === "likely_compatible"
      ? 0.45
      : row.budget_fit === "likely_expensive"
        ? 0.8
        : 0.6;
  return Math.round(Math.max(55, Math.min(180, dailyTripBudget * factor)));
}

function estimatedAmbianceScores(row: any) {
  const signals = [
    ...(Array.isArray(row.activity_fit) ? row.activity_fit : []),
    ...(Array.isArray(row.environment_fit) ? row.environment_fit : []),
    row.why ?? "",
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const has = (pattern: RegExp) => pattern.test(signals);
  return {
    score_fete: has(/soire|bars?|clubs?|nightlife|festif/) ? 0.9 : 0.5,
    score_aventure: has(/bateau|nautique|randon|nature|karting|surf|sport|aventure/) ? 0.85 : 0.5,
    score_detente: has(/spa|detente|plage|thermal|bien.?etre/) ? 0.85 : 0.5,
    score_luxe: has(/spa|chic|luxe|premium|haut de gamme/) ? 0.75 : 0.5,
    score_insolite: has(/insolite|unique|spectaculaire|sauvage/) ? 0.7 : 0.5,
    score_sportif: has(/sport|surf|randon|karting|nautique|velo/) ? 0.8 : 0.5,
    score_culturel: has(/culture|patrimoine|gastronom|village|histor/) ? 0.75 : 0.5,
  };
}

/**
 * Gemini already produces a rich candidate pool, but legacy scoring only sees rows
 * present in `destinations`. Promote a small, best-fit subset after deterministic
 * geocoding/climate enrichment so those candidates can actually compete.
 *
 * These rows stay explicitly estimated: no provider price, availability or exact
 * budget is presented as verified fact.
 */
async function materializeGroundedCandidatePool(
  supabase: Parameters<typeof generateLegacyRecommendationsForTrip>[0],
  tripId: string,
): Promise<number> {
  try {
    const context = await getLegacyDestinationBriefContext(supabase, tripId);
    const poolRes = await supabase
      .from("destination_candidate_pool")
      .select("*")
      .eq("trip_id", tripId)
      .eq("brief_fingerprint", context.briefFingerprint)
      .eq("status", "available");

    if (poolRes.error || !poolRes.data?.length) return 0;

    const candidates = (poolRes.data as any[])
      .filter(
        (row) =>
          (row.source === "gemini" || row.source === "merged") &&
          (Array.isArray(row.activity_fit) || Array.isArray(row.environment_fit)),
      )
      .sort((a, b) => candidateSemanticScore(b) - candidateSemanticScore(a))
      .slice(0, 12);

    if (!candidates.length) return 0;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const names = candidates.map((row) => String(row.name)).filter(Boolean);
    const existingRes = await supabaseAdmin.from("destinations").select("name").in("name", names);
    const existing = new Set((existingRes.data ?? []).map((row: any) => String(row.name).toLowerCase()));

    const budgetPerPerson = Number(context.scoringContext.budgetPerPerson) || 400;
    const nights = Number(context.scoringContext.nights) || 2;
    let created = 0;

    for (const row of candidates) {
      const name = String(row.name ?? "").trim();
      if (!name || existing.has(name.toLowerCase())) continue;

      try {
        let place: Awaited<ReturnType<typeof geocodeDestination>> = null;
        for (const query of buildGroundingQueries(row)) {
          place = await geocodeDestination(query);
          if (place) break;
        }
        if (!place) continue;

        const climate = await fetchClimate(place.latitude, place.longitude).catch(() => null);
        const slug = slugifyDestination(name);
        if (!slug) continue;

        const upsert = await supabaseAdmin.from("destinations").upsert(
          {
            slug,
            name,
            country: String(row.country || "Europe"),
            description: row.why ? String(row.why) : null,
            avg_daily_cost: estimatedDailyCost(row, budgetPerPerson, nights),
            distance_from_paris_km: distanceFromParisKm(place.latitude, place.longitude),
            popularity: 0.5,
            rating: 4,
            best_months: climate?.bestMonths ?? [],
            ...estimatedAmbianceScores(row),
            source: "ai_grounded_estimate",
            external_id: `ai-grounded:${String(row.destination_key || slug)}`,
            latitude: place.latitude,
            longitude: place.longitude,
            climate: climate ?? {},
            env_tags: Array.isArray(row.environment_fit) ? row.environment_fit : [],
            destination_type: row.destination_type || "city",
            region_name: row.region || null,
            anchor_places:
              Array.isArray(row.anchor_places) && row.anchor_places.length ? row.anchor_places : [name],
            verification_state: "estimated",
          } as any,
          { onConflict: "slug" },
        );

        if (upsert.error) {
          console.error("materializeGroundedCandidatePool upsert", name, upsert.error.message);
          continue;
        }

        created += 1;
        existing.add(name.toLowerCase());
      } catch (error) {
        console.error("materializeGroundedCandidatePool candidate", name, error);
      }
    }

    return created;
  } catch (error) {
    console.error("materializeGroundedCandidatePool", error);
    return 0;
  }
}

export async function aggregateParticipantPreferences(
  ...args: Parameters<typeof aggregateLegacyParticipantPreferences>
): Promise<Awaited<ReturnType<typeof aggregateLegacyParticipantPreferences>>> {
  const aggregated = await aggregateLegacyParticipantPreferences(...args);
  return softenDiscoveryBudget(aggregated);
}

/**
 * Once dates are locked and the trip profile has already been validated, the
 * response phase is closed. A participant joining later must not make an
 * already-approved trip become non-generatable because the denominator grew.
 */
export async function assessGenerationReadiness(
  ...args: Parameters<typeof assessLegacyGenerationReadiness>
): Promise<Awaited<ReturnType<typeof assessLegacyGenerationReadiness>>> {
  const readiness = await assessLegacyGenerationReadiness(...args);
  const responsePhaseClosed = Boolean(
    readiness.quality?.datesLocked && readiness.profile?.validated,
  );

  if (!responsePhaseClosed) return readiness;

  return {
    ...readiness,
    canGenerate: true,
    message: undefined,
    checklist: {
      ...readiness.checklist,
      prefsOk: true,
    },
    profile: {
      ...readiness.profile,
      questionnairesReady: true,
    },
  };
}

/**
 * Make the current Gemini candidate pool scoreable before the legacy engine runs.
 * On a first-ever generation the pool does not exist yet, so run discovery once,
 * materialize the newly-created pool, then rescore from that pool without a second
 * Gemini call.
 */
export async function generateRecommendationsForTrip(
  supabase: Parameters<typeof generateLegacyRecommendationsForTrip>[0],
  tripId: Parameters<typeof generateLegacyRecommendationsForTrip>[1],
  options?: Parameters<typeof generateLegacyRecommendationsForTrip>[2],
): Promise<Awaited<ReturnType<typeof generateLegacyRecommendationsForTrip>>> {
  const readiness = await assessGenerationReadiness(supabase, tripId);
  const closedValidatedTrip = Boolean(
    readiness.quality?.datesLocked && readiness.profile?.validated,
  );
  const force = options?.force === true || closedValidatedTrip;

  const materializedBefore = await materializeGroundedCandidatePool(supabase, tripId);
  const first = await generateLegacyRecommendationsForTrip(supabase, tripId, {
    ...options,
    force,
  });

  if (materializedBefore > 0) return first;

  const materializedAfter = await materializeGroundedCandidatePool(supabase, tripId);
  if (materializedAfter <= 0) return first;

  return generateLegacyRecommendationsForTrip(supabase, tripId, {
    ...options,
    force: true,
  });
}

export async function getDestinationBriefContext(
  ...args: Parameters<typeof getLegacyDestinationBriefContext>[0][],
): Promise<Awaited<ReturnType<typeof getLegacyDestinationBriefContext>>> {
  const context = await getLegacyDestinationBriefContext(...(args as Parameters<typeof getLegacyDestinationBriefContext>));

  return {
    ...context,
    // Preserve the original aggregated/scoring budget signal so the final
    // recommender can apply the strong penalty and explicit warning.
    aggregated: context.aggregated,
    scoringContext: context.scoringContext,
    // Only discovery constraints are softened: a provider/LLM must not discard
    // a destination before KREW has a chance to score and explain it.
    discoveryInput: {
      ...context.discoveryInput,
      scoringSignals: {
        ...context.discoveryInput.scoringSignals,
        hardConstraints: {
          ...context.discoveryInput.scoringSignals.hardConstraints,
          hasBudgetVeto: false,
          vetoBudgetMax: null,
          minGroupBudget: null,
        },
      },
    },
  } as Awaited<ReturnType<typeof getLegacyDestinationBriefContext>>;
}
