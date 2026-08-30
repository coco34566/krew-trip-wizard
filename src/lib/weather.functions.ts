import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchClimate, geocodeDestination } from "@/integrations/external/geo-weather.server";
import { dominantWeatherState, type KrewTripWeather } from "@/lib/krew/weather";

const inputSchema = z.object({
  destination: z.string().trim().min(1).max(160),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  datesLocked: z.boolean(),
});

export const getDashboardWeather = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<KrewTripWeather | null> => {
    try {
      const place = await geocodeDestination(data.destination);
      if (!place || !data.startDate) return null;

      const climate = await fetchClimate(place.latitude, place.longitude, {
        startDate: data.datesLocked ? data.startDate : null,
        endDate: data.datesLocked ? data.endDate : null,
      });

      if (data.datesLocked && climate.forecast?.length) {
        const validDays = climate.forecast.filter(
          (day) => Number.isFinite(day.tempMin) && Number.isFinite(day.tempMax),
        );
        if (validDays.length) {
          const minTemp = Math.round(Math.min(...validDays.map((day) => day.tempMin)));
          const maxTemp = Math.round(Math.max(...validDays.map((day) => day.tempMax)));
          const rainDays = validDays.filter((day) => day.precipitationMm >= 1).length;
          const totalRain = validDays.reduce((sum, day) => sum + Math.max(0, day.precipitationMm), 0);

          return {
            mode: "forecast",
            state: dominantWeatherState(validDays),
            minTemp,
            maxTemp,
            rainRelevant: rainDays >= Math.max(1, Math.ceil(validDays.length / 3)) || totalRain >= 5,
            label: "Prévisions du séjour",
          };
        }
      }

      const month = Number(data.startDate.slice(5, 7));
      const seasonal = climate.months.find((item) => item.month === month);
      if (!seasonal || !Number.isFinite(seasonal.tempMaxAvg)) return null;

      return {
        mode: "seasonal",
        state: null,
        minTemp:
          typeof seasonal.tempMinAvg === "number" && Number.isFinite(seasonal.tempMinAvg)
            ? Math.round(seasonal.tempMinAvg)
            : null,
        maxTemp: Math.round(seasonal.tempMaxAvg),
        rainRelevant: false,
        label: "En général à cette période",
      };
    } catch (error) {
      console.warn("Dashboard weather unavailable", error);
      return null;
    }
  });
