import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function isAuthorizedCronRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-krew-cron-secret");
  if (!provided) return false;

  const { data: expected, error } = await supabaseAdmin.rpc(
    "get_recalibrate_cron_secret",
  );
  if (error || typeof expected !== "string" || expected.length === 0) {
    console.error("Recalibration auth configuration error", error);
    return false;
  }

  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (providedBytes.length !== expectedBytes.length) return false;

  return timingSafeEqual(providedBytes, expectedBytes);
}

export const Route = createFileRoute("/api/recalibrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAuthorizedCronRequest(request))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const [feedbackRes, reactionsRes] = await Promise.all([
            supabaseAdmin.from("scoring_feedback").select("*"),
            supabaseAdmin.from("destination_feedback").select("recommendation_id, reaction")
          ]);

          if (feedbackRes.error) {
            console.error("Recalibration fetch error:", feedbackRes.error);
            return new Response(JSON.stringify({ error: feedbackRes.error.message }), { status: 500 });
          }
          const rows = feedbackRes.data;
          if (!rows?.length) {
            return new Response(JSON.stringify({ message: "Aucun feedback — rien à recalibrer" }), { status: 200 });
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

          const updatedEvents: string[] = [];

          for (const [eventType, list] of byEvent) {
            const positiveCount = list.filter((r) => {
              if (r.was_selected) return true;
              const counts = r.recommendation_id ? reactionsMap.get(r.recommendation_id) : null;
              return counts ? (counts.likes > counts.dislikes) : false;
            }).length;

            if (positiveCount < 3) continue;

            const { data: current } = await supabaseAdmin
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
                    rWeight = 0.3;
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

            const { error: upErr } = await supabaseAdmin.from("scoring_weights").upsert({
              event_type: eventType,
              ...next,
              updated_at: new Date().toISOString(),
            });
            if (upErr) {
              console.error(`Error updating weights for ${eventType}:`, upErr);
            } else {
              updatedEvents.push(eventType);
            }
          }

          return new Response(JSON.stringify({ success: true, updatedEvents }), { status: 200 });
        } catch (e: any) {
          console.error("Recalibration API error:", e);
          return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
      },
    },
  },
});
