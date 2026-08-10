import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_trip",
  title: "Détail d'un voyage",
  description: "Get one trip with its participants and preferences, if the signed-in user can access it.",
  inputSchema: { trip_id: z.string().describe("The trip id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ trip_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: trip, error } = await supabase.from("trips").select("*").eq("id", trip_id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!trip) throw new ToolError(`No accessible trip with id ${trip_id}`);
    const { data: participants } = await supabase
      .from("trip_participants")
      .select("*")
      .eq("trip_id", trip_id);
    const payload = { trip, participants: participants ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
