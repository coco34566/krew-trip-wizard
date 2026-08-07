/**
 * Job manuel / cron : recalibre scoring_weights à partir de scoring_feedback.
 *
 * Usage (exemple) :
 *   npx tsx src/jobs/recalibrate-scoring-weights.ts
 *
 * Logique v1 (pas de ML) :
 * - Pour chaque event_type, compare les sous-scores moyens des propositions
 *   sélectionnées vs non sélectionnées.
 * - Si un sous-score est nettement plus fort chez les choisies, on augmente
 *   légèrement son poids (+1, max +5 cumul vs défaut).
 * - Si plus fort chez les ignorées, on diminue (-1, floor 3).
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis");
  process.exit(1);
}

const supabase = createClient(url, key);

const SUBS = [
  "s_ambiance",
  "s_activities",
  "s_budget",
  "s_distance",
  "s_season",
  "s_quality",
] as const;

const WEIGHT_COL: Record<(typeof SUBS)[number], string> = {
  s_ambiance: "ambiance_weight",
  s_activities: "activities_weight",
  s_budget: "budget_weight",
  s_distance: "distance_weight",
  s_season: "season_weight",
  s_quality: "quality_weight",
};

async function main() {
  const { data: rows, error } = await supabase.from("scoring_feedback").select("*");
  if (error) throw error;
  if (!rows?.length) {
    console.log("Aucun feedback — rien à recalibrer");
    return;
  }

  const byEvent = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = (r.event_type as string) || "default";
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k)!.push(r);
  }

  for (const [eventType, list] of byEvent) {
    const selected = list.filter((r) => r.was_selected);
    const ignored = list.filter((r) => !r.was_selected);
    if (selected.length < 3) {
      console.log(`${eventType}: pas assez de sélections (${selected.length})`);
      continue;
    }

    const { data: current } = await supabase
      .from("scoring_weights")
      .select("*")
      .eq("event_type", eventType)
      .maybeSingle();

    const next: Record<string, number> = {
      ambiance_weight: Number(current?.ambiance_weight ?? 18),
      activities_weight: Number(current?.activities_weight ?? 12),
      budget_weight: Number(current?.budget_weight ?? 16),
      distance_weight: Number(current?.distance_weight ?? 8),
      season_weight: Number(current?.season_weight ?? 8),
      quality_weight: Number(current?.quality_weight ?? 5),
      consensus_weight: Number(current?.consensus_weight ?? 18),
      min_satisfaction_weight: Number(current?.min_satisfaction_weight ?? 15),
    };

    for (const sub of SUBS) {
      const avg = (arr: typeof list) => {
        const vals = arr.map((r) => Number(r[sub])).filter((n) => Number.isFinite(n));
        if (!vals.length) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const diff = avg(selected) - avg(ignored);
      const col = WEIGHT_COL[sub];
      if (diff > 0.08) next[col] = Math.min(35, next[col] + 1);
      else if (diff < -0.08) next[col] = Math.max(3, next[col] - 1);
    }

    const { error: upErr } = await supabase.from("scoring_weights").upsert({
      event_type: eventType,
      ...next,
      updated_at: new Date().toISOString(),
    });
    if (upErr) console.error(eventType, upErr);
    else console.log(`${eventType}: poids mis à jour`, next);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
