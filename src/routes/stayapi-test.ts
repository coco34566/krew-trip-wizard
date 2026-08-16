import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stayapi-test")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.STAYAPI_API_KEY;

        if (!apiKey) {
          return Response.json(
            { success: false, error: "STAYAPI_API_KEY is not configured" },
            { status: 500 },
          );
        }

        const params = new URLSearchParams({
          dest_id: "-3233180",
          dest_type: "CITY",
          checkin: "2026-09-10",
          checkout: "2026-09-14",
          adults: "2",
          rooms: "1",
          children: "0",
          rows_per_page: "10",
          offset: "0",
          language: "en-us",
          currency: "EUR",
        });

        try {
          const response = await fetch(
            `https://api.stayapi.com/v1/booking/search?${params.toString()}`,
            {
              method: "GET",
              headers: {
                "x-api-key": apiKey,
                Accept: "application/json",
              },
            },
          );

          const text = await response.text();
          let data: unknown;

          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }

          return Response.json(
            {
              stayapi_status: response.status,
              stayapi_ok: response.ok,
              request: {
                endpoint: "https://api.stayapi.com/v1/booking/search",
                dest_id: "-3233180",
                checkin: "2026-09-10",
                checkout: "2026-09-14",
                adults: 2,
                rooms: 1,
                currency: "EUR",
                rows_per_page: 10,
              },
              data,
            },
            { status: response.ok ? 200 : response.status },
          );
        } catch (error) {
          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});
