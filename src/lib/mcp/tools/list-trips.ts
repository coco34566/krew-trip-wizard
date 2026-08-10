import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_trips",
  title: "Lister mes voyages",
  description: "List the group trips the signed-in user owns or participates in.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max number of trips to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trips")
      .select("id, name, status, event_type, departure_city, participants_count, budget_per_person, start_date, end_date, duration_nights, updated_at")
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 50));
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { trips: data ?? [] },
    };
  },
});
