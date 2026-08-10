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

const url = process.env["SUPABASE_URL"]!;
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
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
  const [feedbackRes, reactionsRes] = await Promise.all([
    supabase.from("scoring_feedback").select("*"),
    supabase.from("destination_feedback").select("recommendation_id, reaction")
  ]);

  if (feedbackRes.error) throw feedbackRes.error;
  const rows = feedbackRes.data;
  if (!rows?.length) {
    console.log("Aucun feedback — rien à recalibrer");
    return;
  }

  const reactionsMap = new Map<string, { likes: number; dislikes: number }>();
  if (reactionsRes.data) {
    for (const r of reactionsRes.data) {
      if (!r.recommendation_id) continue;
      if (!reactionsMap.has(r.recommendation_id)) {
        reactionsMap.set(r.recommendation_id, { likes: 0, dislikes: 0 });
      }
      const counts = reactionsMap.get(r.recommendation_id)!;
      if (r.reaction === "like") counts.likes++;
      if (r.reaction === "dislike") counts.dislikes++;
    }
  }

  const byEvent = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = (r.event_type as string) || "default";
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k)!.push(r);
  }

  for (const [eventType, list] of byEvent) {
    // Une destination est considérée comme sélectionnée s'il y a was_selected ou des likes majoritaires (mini-signal)
    const positiveCount = list.filter((r) => {
      if (r.was_selected) return true;
      const counts = r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null;
      return counts ? (counts.likes > counts.dislikes) : false;
    }).length;

    // Seuil de 3 signaux positifs pour recalibrer
    if (positiveCount < 3) {
      console.log(`${eventType}: pas assez de signaux positifs (${positiveCount})`);
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
      const getWeightedAvg = (type: "positive" | "negative") => {
        let sumSub = 0;
        let sumWeight = 0;
        for (const r of list) {
          const counts = r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null;
          const likes = counts?.likes ?? 0;
          const dislikes = counts?.dislikes ?? 0;
          const net = likes - dislikes;

          let rType: "positive" | "negative";
          let rWeight = 1.0;

          if (r.was_selected) {
            rType = "positive";
            rWeight = 1.0;
          } else if (net > 0) {
            rType = "positive";
            rWeight = 0.3; // Un like pèse comme un mini-signal positif de poids 0.3
          } else {
            rType = "negative";
            rWeight = 1.0;
          }

          if (rType === type) {
            const val = Number(r[sub]);
            if (Number.isFinite(val)) {
              sumSub += val * rWeight;
              sumWeight += rWeight;
            }
          }
        }
        return sumWeight > 0 ? sumSub / sumWeight : 0;
      };

      const diff = getWeightedAvg("positive") - getWeightedAvg("negative");
      const col = WEIGHT_COL[sub];
      const curVal = col ? next[col] : undefined;
      if (col && curVal !== undefined) {
        if (diff > 0.08) next[col] = Math.min(35, curVal + 1);
        else if (diff < -0.08) next[col] = Math.max(3, curVal - 1);
      }
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
