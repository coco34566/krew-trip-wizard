import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  query: z.string().trim().min(2).max(160),
  destinationHint: z.string().trim().max(240).nullable().optional(),
});

export const searchAccommodationPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const text = data.destinationHint ? `${data.query}, ${data.destinationHint}` : data.query;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", text);
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("limit", "8");
    url.searchParams.set("accept-language", "fr");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "KrewGroupTripPlanner/1.0 (https://krew-trip-wizard.vercel.app)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Recherche d’hébergement indisponible (${response.status})`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  });
