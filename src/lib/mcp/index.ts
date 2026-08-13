import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTripsTool from "./tools/list-trips";
import getTripTool from "./tools/get-trip";
import listRecommendationsTool from "./tools/list-recommendations";
import createTripTool from "./tools/create-trip";

const supabaseUrl =
  import.meta.env.NEXT_PUBLIC_krewproject_SUPABASE_URL ??
  import.meta.env.krewproject_SUPABASE_URL ??
  "";

const projectRef = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "project-ref-unset";

export default defineMcp({
  name: "krew-your-group-trip-planner",
  title: "Krew: Your Group Trip Planner",
  version: "0.1.0",
  instructions:
    "Tools for Krew, a group trip planner (EVG/EVJF and friends trips). Use `list_trips` to find the signed-in user's trips, `get_trip` for details and participants, `list_trip_recommendations` for scored destination proposals, and `create_trip` to start a new trip.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTripsTool, getTripTool, listRecommendationsTool, createTripTool] as any,
});
