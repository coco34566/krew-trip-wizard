import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_trip",
  title: "Créer un voyage",
  description: "Create a new group trip owned by the signed-in user.",
  inputSchema: {
    name: z.string().describe("Trip name, e.g. 'EVG de Paul'."),
    departure_city: z.string().describe("Main departure city of the group."),
    participants_count: z.number().int().optional().describe("Number of participants (default 6)."),
    budget_per_person: z.number().optional().describe("Budget per person in euros."),
    duration_nights: z.number().int().optional().describe("Number of nights (default 2)."),
    start_date: z.string().optional().describe("Start date as YYYY-MM-DD."),
    end_date: z.string().optional().describe("End date as YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const userId = ctx.getUserId();
    if (!userId) return { content: [{ type: "text", text: "Missing user identity" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("trips")
      .insert({
        owner_id: userId,
        name: input.name,
        departure_city: input.departure_city,
        ...(input.participants_count ? { participants_count: input.participants_count } : {}),
        ...(input.budget_per_person ? { budget_per_person: input.budget_per_person } : {}),
        ...(input.duration_nights ? { duration_nights: input.duration_nights } : {}),
        ...(input.start_date ? { start_date: input.start_date } : {}),
        ...(input.end_date ? { end_date: input.end_date } : {}),
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { trip: data } };
  },
});
