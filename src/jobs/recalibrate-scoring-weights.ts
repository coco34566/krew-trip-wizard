import { createClient } from "@supabase/supabase-js";

const url = process.env["krewproject_SUPABASE_URL"] || process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_krewproject_SUPABASE_URL"];
const key = process.env["krewproject_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) {
  console.error("krewproject_SUPABASE_URL et krewproject_SUPABASE_SERVICE_ROLE_KEY requis");
  process.exit(1);
}

const supabase = createClient(url, key);

const SUBS = ["s_ambiance", "s_activities", "s_budget", "s_distance", "s_season", "s_quality"] as const;
const WEIGHT_COL: Record<(typeof SUBS)[number], string> = {
  s_ambiance: "ambiance_weight", s_activities: "activities_weight", s_budget: "budget_weight",
  s_distance: "distance_weight", s_season: "season_weight", s_quality: "quality_weight",
};

async function main() {
  const [feedbackRes, reactionsRes] = await Promise.all([
    supabase.from("scoring_feedback").select("*"),
    supabase.from("destination_feedback").select("recommendation_id, reaction")
  ]);
  if (feedbackRes.error) throw feedbackRes.error;
  const rows = feedbackRes.data;
  if (!rows?.length) return;

  const reactionsMap = new Map<string, { likes: number; dislikes: number }>();
  for (const r of reactionsRes.data || []) {
    if (!r.recommendation_id) continue;
    if (!reactionsMap.has(r.recommendation_id)) reactionsMap.set(r.recommendation_id, { likes: 0, dislikes: 0 });
    const counts = reactionsMap.get(r.recommendation_id)!;
    if (r.reaction === "like") counts.likes++;
    if (r.reaction === "dislike") counts.dislikes++;
  }

  const byEvent = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = (r.event_type as string) || "default";
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k)!.push(r);
  }

  for (const [eventType, list] of byEvent) {
    const positiveCount = list.filter((r) => r.was_selected || ((r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null)?.likes || 0) > ((r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null)?.dislikes || 0)).length;
    if (positiveCount < 3) continue;

    const { data: current } = await supabase.from("scoring_weights").select("*").eq("event_type", eventType).maybeSingle();
    const next: Record<string, number> = {
      ambiance_weight: Number(current?.ambiance_weight ?? 18), activities_weight: Number(current?.activities_weight ?? 12),
      budget_weight: Number(current?.budget_weight ?? 16), distance_weight: Number(current?.distance_weight ?? 8),
      season_weight: Number(current?.season_weight ?? 8), quality_weight: Number(current?.quality_weight ?? 5),
      consensus_weight: Number(current?.consensus_weight ?? 18), min_satisfaction_weight: Number(current?.min_satisfaction_weight ?? 15),
    };

    for (const sub of SUBS) {
      let positiveSum = 0, positiveWeight = 0, negativeSum = 0, negativeWeight = 0;
      for (const r of list) {
        const counts = r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null;
        const net = (counts?.likes ?? 0) - (counts?.dislikes ?? 0);
        const positive = r.was_selected || net > 0;
        const weight = r.was_selected ? 1 : positive ? 0.3 : 1;
        const val = Number(r[sub]);
        if (!Number.isFinite(val)) continue;
        if (positive) { positiveSum += val * weight; positiveWeight += weight; }
        else { negativeSum += val * weight; negativeWeight += weight; }
      }
      const diff = (positiveWeight ? positiveSum / positiveWeight : 0) - (negativeWeight ? negativeSum / negativeWeight : 0);
      const col = WEIGHT_COL[sub];
      if (diff > 0.08) next[col] = Math.min(35, next[col] + 1);
      else if (diff < -0.08) next[col] = Math.max(3, next[col] - 1);
    }

    const { error: upErr } = await supabase.from("scoring_weights").upsert({ event_type: eventType, ...next, updated_at: new Date().toISOString() });
    if (upErr) console.error(eventType, upErr);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
