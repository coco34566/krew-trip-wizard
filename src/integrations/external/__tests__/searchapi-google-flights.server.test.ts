import { afterEach, describe, expect, it, vi } from "vitest";

import {
  normalizeGoogleFlightOffer,
  resolveGoogleFlightsLocations,
  searchGoogleFlightsRoundTrip,
} from "../searchapi-google-flights.server";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["SEARCHAPI_API"];
});

describe("SearchAPI / Google Flights", () => {
  it("résout une ville en plusieurs IDs fournisseur", async () => {
    process.env["SEARCHAPI_API"] = "server-test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            airports: [
              { id: "CDG", name: "Charles de Gaulle" },
              { id: "ORY", name: "Orly" },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect((await resolveGoogleFlightsLocations("Paris")).map((location) => location.id)).toEqual([
      "CDG",
      "ORY",
    ]);
    const requested = new URL(fetchMock.mock.calls[0]![0]);
    expect(requested.searchParams.get("engine")).toBe("google_flights_location_search");
    expect(requested.searchParams.get("q")).toBe("Paris");
  });

  it("normalise une offre réelle dans le modèle KREW", () => {
    const quote = normalizeGoogleFlightOffer(
      {
        price: 219,
        currency: "EUR",
        booking_token: "book-me",
        total_duration: 255,
        flights: [
          {
            airline: "Air France",
            departure_airport: { id: "CDG", name: "Paris", time: "2026-09-01 19:15" },
            arrival_airport: { id: "LIS", name: "Lisbonne", time: "2026-09-01 21:00" },
          },
        ],
        return_flights: [
          {
            airline: "Air France",
            departure_airport: { id: "LIS", time: "2026-09-04 18:30" },
            arrival_airport: { id: "CDG", time: "2026-09-04 22:00" },
          },
        ],
      },
      3,
    );

    expect(quote).toMatchObject({
      provider: "searchapi/google_flights",
      dataKind: "provider_offer",
      pricePerPerson: 219,
      airline: "Air France",
      departureAirport: "CDG",
      arrivalAirport: "LIS",
      outboundTime: "19:15",
      returnTime: "22:00",
      adults: 3,
      bookingToken: "book-me",
    });
  });

  it("Paris Lisbonne utilise les IATA locaux et un seul appel flight", async () => {
    process.env["SEARCHAPI_API"] = "server-test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ best_flights: [offer(180, "PAR", "19:00")] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const quote = await searchGoogleFlightsRoundTrip({
      originCity: "Paris",
      destinationCity: "Lisbonne",
      departDate: "2026-09-01",
      returnDate: "2026-09-04",
      adults: 2,
      earliestDepartureTime: "18:00",
    });
    expect(quote.pricePerPerson).toBe(180);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const flightUrl = new URL(fetchMock.mock.calls[0]![0]);
    expect(flightUrl.searchParams.get("engine")).toBe("google_flights");
    expect(flightUrl.searchParams.get("departure_id")).toBe("PAR");
    expect(flightUrl.searchParams.get("arrival_id")).toBe("LIS");
  });
});

function offer(price: number, airport: string, departureTime: string) {
  return {
    price,
    flights: [
      {
        departure_airport: { id: airport, time: `2026-09-01 ${departureTime}` },
        arrival_airport: { id: "LIS", time: "2026-09-01 21:00" },
      },
    ],
    return_flights: [
      {
        departure_airport: { id: "LIS", time: "2026-09-04 18:00" },
        arrival_airport: { id: airport, time: "2026-09-04 20:00" },
      },
    ],
  };
}
