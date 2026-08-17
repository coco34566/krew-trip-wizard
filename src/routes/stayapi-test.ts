import { createFileRoute } from "@tanstack/react-router";
import { resolveStayApiDestination, searchHotelsStayApi } from "@/integrations/external/stayapi-hotels.server";

export const Route = createFileRoute("/stayapi-test")({
  server: {
    handlers: {
      GET: async () => {
        if (process.env["NODE_ENV"] === "production") {
          return new Response("Not found", { status: 404 });
        }
        const apiKey = process.env["STAYAPI_API_KEY"];
        if (!apiKey) {
          return Response.json({ success: false, error: "STAYAPI_API_KEY is not configured" }, { status: 500 });
        }

        const destinationQuery = "Paris";
        const checkin = "2026-09-10";
        const checkout = "2026-09-14";
        const adults = 2;
        const rooms = 1;

        try {
          const resolved = await resolveStayApiDestination(destinationQuery);
          const hotels = await searchHotelsStayApi({
            destination: destinationQuery,
            latitude: 48.8566,
            longitude: 2.3522,
            destId: resolved.id,
            destType: resolved.type,
            checkin,
            checkout,
            adults,
            rooms,
          });

          return Response.json({
            success: true,
            lookup: resolved,
            request: {
              destination: destinationQuery,
              dest_id: resolved.id,
              dest_type: resolved.type,
              checkin,
              checkout,
              adults,
              rooms,
              currency: "EUR",
              language: "fr-fr",
            },
            hotelsCount: hotels.length,
            hotels: hotels.slice(0, 5),
          });
        } catch (error) {
          return Response.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 502 },
          );
        }
      },
    },
  },
});
