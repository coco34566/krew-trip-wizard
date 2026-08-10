import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_trip_recommendations",
  title: "Propositions de destination",
  description: "List the scored destination proposals generated for a trip.",
  inputSchema: { trip_id: z.string().describe("The trip id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ trip_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("recommendations")
      .select("*, destination:destinations(name, country, latitude, longitude)")
      .eq("trip_id", trip_id)
      .order("score", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { recommendations: data ?? [] },
    };
  },
});
