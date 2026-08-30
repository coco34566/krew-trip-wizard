import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchClimate, geocodeDestination } from "@/integrations/external/geo-weather.server";
import { buildTripWeatherSummary } from "@/lib/krew/trip-weather";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const getTripWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        destinationName: z.string().trim().min(1).max(160),
        startDate: dateString,
        endDate: dateString,
        datesLocked: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const startDate = data.startDate?.slice(0, 10) ?? null;
    const endDate = data.endDate?.slice(0, 10) ?? startDate;
    if (!startDate) return null;

    const today = new Date().toISOString().slice(0, 10);
    if (endDate && endDate < today) return null;

    try {
      const place = await geocodeDestination(data.destinationName);
      if (!place) return null;

      const climate = await fetchClimate(place.latitude, place.longitude, {
        startDate: data.datesLocked ? startDate : null,
        endDate: data.datesLocked ? endDate : null,
      });

      return buildTripWeatherSummary(climate, startDate, endDate, data.datesLocked);
    } catch (error) {
      console.warn("[trip-weather] météo indisponible", error);
      return null;
    }
  });
