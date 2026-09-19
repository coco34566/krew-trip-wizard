import { afterEach, describe, expect, it, vi } from "vitest";

import { searchNavitiaTrainRoundTrip } from "../navitia-trains.server";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["SNCF_KEY_API"];
});

describe("searchNavitiaTrainRoundTrip", () => {
  it("keeps real rail journeys that respect the participant time windows", async () => {
    process.env["SNCF_KEY_API"] = "test-token";

    const responses = [
      { results: [{ name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 }] },
      { results: [{ name: "Lyon", country: "France", latitude: 45.764, longitude: 4.8357 }] },
      {
        journeys: [
          {
            duration: 7200,
            nb_transfers: 0,
            departure_date_time: "20261010T083000",
            arrival_date_time: "20261010T103000",
            sections: [
              {
                type: "public_transport",
                from: { name: "Paris Gare de Lyon" },
                to: { name: "Lyon Part Dieu" },
                display_informations: { commercial_mode: "TGV INOUI", network: "SNCF" },
              },
            ],
          },
        ],
      },
      {
        journeys: [
          {
            duration: 7500,
            nb_transfers: 0,
            departure_date_time: "20261012T180000",
            arrival_date_time: "20261012T200500",
            sections: [
              {
                type: "public_transport",
                from: { name: "Lyon Part Dieu" },
                to: { name: "Paris Gare de Lyon" },
                display_informations: { commercial_mode: "TGV INOUI", network: "SNCF" },
              },
            ],
          },
        ],
      },
    ];

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchNavitiaTrainRoundTrip({
      originCity: "Paris",
      destinationCity: "Lyon",
      departDate: "2026-10-10",
      returnDate: "2026-10-12",
      earliestDepartureTime: "08:00",
      latestArrivalTime: "11:00",
      earliestReturnDepartureTime: "17:00",
      latestReturnTime: "21:00",
      maxTravelDurationHours: 3,
    });

    expect(result?.outbound.departureStation).toBe("Paris Gare de Lyon");
    expect(result?.outbound.arrivalStation).toBe("Lyon Part Dieu");
    expect(result?.outbound.departureTime).toBe("08:30");
    expect(result?.return.arrivalTime).toBe("20:05");

    const calls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(calls.filter((url) => url.includes("api.navitia.io/v1/journeys"))).toHaveLength(2);
    expect(calls.some((url) => url.includes("datetime=20261010T080000"))).toBe(true);
    expect(calls.some((url) => url.includes("max_duration=10800"))).toBe(true);
  });

  it("rejects a public-transport route when it contains no rail section", async () => {
    process.env["SNCF_KEY_API"] = "test-token";
    const geocode = { results: [{ name: "City", country: "France", latitude: 48, longitude: 2 }] };
    const busJourney = {
      journeys: [
        {
          duration: 3600,
          nb_transfers: 0,
          departure_date_time: "20261010T090000",
          arrival_date_time: "20261010T100000",
          sections: [
            {
              type: "public_transport",
              from: { name: "A" },
              to: { name: "B" },
              display_informations: { commercial_mode: "Bus", network: "Bus" },
            },
          ],
        },
      ],
    };
    const responses = [geocode, geocode, busJourney, busJourney];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(responses.shift()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      searchNavitiaTrainRoundTrip({
        originCity: "A",
        destinationCity: "B",
        departDate: "2026-10-10",
        returnDate: "2026-10-12",
      }),
    ).resolves.toBeNull();
  });
});
