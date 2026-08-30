import { describe, expect, it } from "vitest";
import { buildTravelModeModel, isTripInProgress } from "@/lib/krew/trip-travel-mode";
import type { TripWeatherSummary } from "@/lib/krew/trip-weather";

const parisWeather = (hours: TripWeatherSummary["hours"] = [], kind: "clear" | "rain" = "clear"): TripWeatherSummary => ({
  mode: "forecast",
  kind,
  label: kind === "rain" ? "Pluie" : "Ciel dégagé",
  tempMin: 16,
  tempMax: 24,
  rainRelevant: kind === "rain",
  rainyDays: kind === "rain" ? 1 : 0,
  microcopy: null,
  timezone: "Europe/Paris",
  days: [{
    date: "2026-08-30",
    kind,
    label: kind === "rain" ? "Pluie" : "Ciel dégagé",
    tempMin: 16,
    tempMax: 24,
    precipitationMm: kind === "rain" ? 6 : 0,
  }],
  hours,
});

function trip(overrides: Record<string, any> = {}) {
  return {
    dates_locked: true,
    start_date: "2026-08-29",
    end_date: "2026-08-31",
    group_itinerary: {
      days: [
        { day: 1, date: "2026-08-29", slots: [] },
        {
          day: 2,
          date: "2026-08-30",
          slots: [
            { time: "10:00", endTime: "11:00", type: "resto", label: "Brunch" },
            { time: "14:00", endTime: "15:30", type: "activite", category: "culture", label: "Musée" },
            { time: "20:00", endTime: "22:00", type: "resto", label: "Dîner" },
          ],
        },
        { day: 3, date: "2026-08-31", slots: [] },
      ],
    },
    group_logistics: {},
    ...overrides,
  };
}

describe("travel mode trigger", () => {
  it("reste désactivé avant le voyage, sans dates verrouillées et après le voyage", () => {
    expect(isTripInProgress({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01", timezone: "Europe/Paris", now: new Date("2026-08-29T12:00:00Z") })).toBe(false);
    expect(isTripInProgress({ datesLocked: false, startDate: "2026-08-30", endDate: "2026-09-01", timezone: "Europe/Paris", now: new Date("2026-08-30T12:00:00Z") })).toBe(false);
    expect(isTripInProgress({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01", timezone: "Europe/Paris", now: new Date("2026-09-02T12:00:00Z") })).toBe(false);
  });

  it("est actif du premier au dernier jour inclus dans le fuseau de destination", () => {
    expect(isTripInProgress({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01", timezone: "Europe/Paris", now: new Date("2026-08-30T00:30:00Z") })).toBe(true);
    expect(isTripInProgress({ datesLocked: true, startDate: "2026-08-30", endDate: "2026-09-01", timezone: "Europe/Paris", now: new Date("2026-09-01T20:00:00Z") })).toBe(true);
  });

  it("ne se déclenche pas si la fin réelle du séjour manque", () => {
    expect(isTripInProgress({ datesLocked: true, startDate: "2026-08-30", endDate: null, now: new Date("2026-08-30T12:00:00Z") })).toBe(false);
  });
});

describe("travel mode today", () => {
  it("classe les activités passées, en cours et à venir", () => {
    const model = buildTravelModeModel({
      trip: trip(),
      weather: parisWeather(),
      now: new Date("2026-08-30T12:30:00Z"), // 14:30 à Paris
    });

    expect(model.active).toBe(true);
    expect(model.dayNumber).toBe(2);
    expect(model.slots.map((slot) => [slot.label, slot.status])).toEqual([
      ["Brunch", "past"],
      ["Musée", "current"],
      ["Dîner", "next"],
    ]);
    expect(model.current?.label).toBe("Musée");
    expect(model.next?.label).toBe("Musée");
  });

  it("gère une journée vide sans inventer d'événement", () => {
    const model = buildTravelModeModel({
      trip: trip({ start_date: "2026-08-30", end_date: "2026-08-30", group_itinerary: { days: [{ day: 1, date: "2026-08-30", slots: [] }] } }),
      weather: parisWeather(),
      now: new Date("2026-08-30T10:00:00Z"),
    });
    expect(model.active).toBe(true);
    expect(model.slots).toEqual([]);
    expect(model.next).toBeNull();
  });

  it("n'affiche le logement que lorsqu'un hébergement final est sélectionné", () => {
    const without = buildTravelModeModel({ trip: trip(), weather: parisWeather(), now: new Date("2026-08-30T10:00:00Z") });
    expect(without.lodging).toBeNull();

    const withLodging = buildTravelModeModel({
      trip: trip({
        group_logistics: {
          selectedHotelId: "hotel-1",
          hotels: [{ id: "hotel-1", name: "Maison Krew", address: "10 rue du Lac, Annecy" }],
        },
      }),
      destinationName: "Annecy",
      weather: parisWeather(),
      now: new Date("2026-08-30T10:00:00Z"),
    });
    expect(withLodging.lodging).toMatchObject({ name: "Maison Krew", address: "10 rue du Lac, Annecy" });
    expect(withLodging.lodging?.mapsUrl).toContain("google.com/maps/search");
  });
});

describe("travel mode weather and Plan B", () => {
  function outdoorTrip(withBackup: boolean) {
    return trip({
      group_itinerary: {
        days: [
          { day: 1, date: "2026-08-29", slots: [] },
          {
            day: 2,
            date: "2026-08-30",
            slots: [{ time: "18:00", endTime: "20:00", durationMinutes: 120, type: "activite", category: "sport_outdoor", label: "Kayak sur le lac" }],
          },
          { day: 3, date: "2026-08-31", slots: [] },
        ],
        skeleton: {
          days: [
            { day: 1, slots: [] },
            { day: 2, slots: [{ id: "slot-kayak" }] },
            { day: 3, slots: [] },
          ],
          backups: withBackup
            ? [{ forSlot: "slot-kayak", label: "Atelier cuisine savoyarde", detail: "Un atelier en intérieur.", canonicalVenueFamily: "atelier indoor", time: "18:00", durationMinutes: 120 }]
            : [],
        },
      },
    });
  }

  it("ne déclenche rien pour une météo normale", () => {
    const model = buildTravelModeModel({ trip: outdoorTrip(true), weather: parisWeather(), now: new Date("2026-08-30T14:00:00Z") });
    expect(model.weatherImpact).toBeNull();
    expect(model.planB).toBeNull();
  });

  it("ne déclenche rien pour une activité intérieure même s'il pleut", () => {
    const rainy = parisWeather([
      { time: "2026-08-30T18:00", kind: "rain", temperature: 19, precipitationMm: 2 },
      { time: "2026-08-30T19:00", kind: "rain", temperature: 18, precipitationMm: 2 },
    ], "rain");
    const indoor = trip({
      group_itinerary: { days: [{ day: 1, date: "2026-08-29", slots: [] }, { day: 2, date: "2026-08-30", slots: [{ time: "18:00", endTime: "20:00", type: "activite", category: "culture", label: "Musée" }] }, { day: 3, date: "2026-08-31", slots: [] }] },
    });
    const model = buildTravelModeModel({ trip: indoor, weather: rainy, now: new Date("2026-08-30T14:00:00Z") });
    expect(model.weatherImpact).toBeNull();
    expect(model.planB).toBeNull();
  });

  it("détecte un vrai conflit horaire pluie + outdoor et réutilise un backup indoor existant", () => {
    const rainy = parisWeather([
      { time: "2026-08-30T18:00", kind: "rain", temperature: 19, precipitationMm: 1 },
      { time: "2026-08-30T19:00", kind: "rain", temperature: 18, precipitationMm: 1 },
    ], "rain");
    const model = buildTravelModeModel({ trip: outdoorTrip(true), weather: rainy, now: new Date("2026-08-30T14:00:00Z") });
    expect(model.weatherImpact).toContain("Kayak sur le lac");
    expect(model.planB?.label).toBe("Atelier cuisine savoyarde");
  });

  it("signale le conflit sans inventer de Plan B lorsqu'aucun backup pertinent n'existe", () => {
    const rainy = parisWeather([
      { time: "2026-08-30T18:00", kind: "rain", temperature: 19, precipitationMm: 2 },
    ], "rain");
    const model = buildTravelModeModel({ trip: outdoorTrip(false), weather: rainy, now: new Date("2026-08-30T14:00:00Z") });
    expect(model.weatherImpact).not.toBeNull();
    expect(model.planB).toBeNull();
  });

  it("ne considère pas une pluie journalière seule comme un conflit horaire", () => {
    const model = buildTravelModeModel({ trip: outdoorTrip(true), weather: parisWeather([], "rain"), now: new Date("2026-08-30T14:00:00Z") });
    expect(model.weatherImpact).toBeNull();
    expect(model.planB).toBeNull();
  });
});
