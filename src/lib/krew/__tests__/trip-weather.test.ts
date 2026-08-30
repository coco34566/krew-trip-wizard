import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTripWeatherSummary, weatherKindFromCode } from "@/lib/krew/trip-weather";
import type { ClimateSummary } from "@/integrations/external/geo-weather.server";

const base: ClimateSummary = { months: [], bestMonths: [], summary: "" };

describe("trip weather", () => {
  it.each([
    [0, "clear"],
    [3, "cloudy"],
    [61, "rain"],
    [95, "storm"],
    [75, "snow"],
  ])("mappe le weather code %s vers %s", (code, expected) => {
    expect(weatherKindFromCode(code)).toBe(expected);
  });

  it("synthétise une vraie prévision multi-jours", () => {
    const summary = buildTripWeatherSummary(
      {
        ...base,
        forecast: [
          { date: "2026-09-05", tempMin: 15, tempMax: 24, precipitationMm: 0, weatherCode: 0 },
          { date: "2026-09-06", tempMin: 14, tempMax: 21, precipitationMm: 7, weatherCode: 61 },
          { date: "2026-09-07", tempMin: 16, tempMax: 23, precipitationMm: 4, weatherCode: 61 },
        ],
      },
      "2026-09-05",
      "2026-09-07",
      true,
    );

    expect(summary).toMatchObject({
      mode: "forecast",
      kind: "rain",
      tempMin: 14,
      tempMax: 24,
      rainRelevant: true,
      rainyDays: 2,
    });
  });

  it("utilise la tendance saisonnière quand la forecast n'est pas disponible", () => {
    const summary = buildTripWeatherSummary(
      {
        ...base,
        months: [{ month: 10, tempMaxAvg: 22.6, tempMinAvg: 14.3, precipitationMm: 72 }],
      },
      "2026-10-10",
      "2026-10-12",
      false,
    );

    expect(summary).toMatchObject({ mode: "seasonal", kind: "unknown", tempMin: 14, tempMax: 23 });
  });

  it("ne plante pas avec une forecast vide ou des normales absentes", () => {
    expect(buildTripWeatherSummary(base, "2026-10-10", "2026-10-12", true)).toBeNull();
  });
});

describe("weather dashboard guards", () => {
  it("ne charge rien sans destination, amortit les appels et garde les erreurs météo non bloquantes", () => {
    const dashboard = readFileSync("src/components/krew/TripHubDashboard.tsx", "utf8");
    const server = readFileSync("src/lib/trip-weather.functions.ts", "utf8");
    const integration = readFileSync("src/integrations/external/geo-weather.server.ts", "utf8");

    expect(dashboard).toContain("destinationSelected && destinationName && weatherStartDate");
    expect(dashboard).toContain("staleTime: 6 * 60 * 60 * 1000");
    expect(dashboard).toContain("refetchOnWindowFocus: false");
    expect(server).toContain("catch (error)");
    expect(server).toContain("return null");
    expect(integration).toContain("weather_code");
    expect(integration).toContain("endDiffDays <= 15");
  });
});
