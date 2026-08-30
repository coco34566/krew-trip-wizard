import { describe, expect, it } from "vitest";
import { dominantWeatherState, weatherCodeToState } from "@/lib/krew/weather";

describe("KREW weather mapping", () => {
  it("mappe les principaux weather_code Open-Meteo", () => {
    expect(weatherCodeToState(0)).toBe("clear");
    expect(weatherCodeToState(3)).toBe("cloudy");
    expect(weatherCodeToState(61)).toBe("rain");
    expect(weatherCodeToState(95)).toBe("storm");
    expect(weatherCodeToState(71)).toBe("snow");
    expect(weatherCodeToState(null)).toBeNull();
  });

  it("retient l'état dominant d'un séjour et départage par pertinence", () => {
    expect(
      dominantWeatherState([
        { weatherCode: 0 },
        { weatherCode: 61 },
        { weatherCode: 61 },
      ]),
    ).toBe("rain");

    expect(
      dominantWeatherState([
        { weatherCode: 0 },
        { weatherCode: 95 },
      ]),
    ).toBe("storm");
  });

  it("reste neutre sans donnée météo exploitable", () => {
    expect(dominantWeatherState([])).toBeNull();
    expect(dominantWeatherState([{ weatherCode: null }])).toBeNull();
  });
});
