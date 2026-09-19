import { afterEach, describe, expect, it, vi } from "vitest";

import { searchNavitiaTrainRoundTrip } from "../navitia-trains.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function journey(params: {
  departure: string;
  arrival: string;
  duration: number;
  fromStation: string;
  toStation: string;
  mode?: string;
  physicalMode?: string;
}) {
  return {
    duration: params.duration,
    nb_transfers: 0,
    departure_date_time: params.departure,
    arrival_date_time: params.arrival,
    sections: [
      {
        type: "public_transport",
        departure_date_time: params.departure,
        arrival_date_time: params.arrival,
        from: { name: params.fromStation },
        to: { name: params.toStation },
        display_informations: {
          commercial_mode: params.mode ?? "TGV INOUI",
          network: "SNCF",
        },
        links: [{ type: "physical_mode", id: params.physicalMode ?? "physical_mode:LongDistanceTrain" }],
      },
    ],
  };
}

describe("searchNavitiaTrainRoundTrip", () => {
  it("uses KREW time constraints and returns real stations/times from Navitia", async () => {
    vi.stubEnv("SNCF_KEY_API", "test-token");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/places")) {
        const q = url.searchParams.get("q");
        if (q === "Paris") {
          return jsonResponse({
            places: [
              {
                embedded_type: "administrative_region",
                name: "Paris",
                administrative_region: {
                  name: "Paris",
                  coord: { lon: "2.3522", lat: "48.8566" },
                },
              },
            ],
          });
        }
        return jsonResponse({
          places: [
            {
              embedded_type: "administrative_region",
              name: "Lyon",
              administrative_region: {
                name: "Lyon",
                coord: { lon: "4.8357", lat: "45.7640" },
              },
            },
          ],
        });
      }

      const from = url.searchParams.get("from");
      if (from === "2.3522;48.8566") {
        expect(url.searchParams.get("datetime")).toBe("20261010T090000");
        expect(url.searchParams.get("datetime_represents")).toBe("departure");
        return jsonResponse({
          journeys: [
            journey({
              departure: "20261010T083000",
              arrival: "20261010T103000",
              duration: 7200,
              fromStation: "Paris Gare de Lyon",
              toStation: "Lyon Part Dieu",
            }),
            journey({
              departure: "20261010T091500",
              arrival: "20261010T111000",
              duration: 6900,
              fromStation: "Paris Gare de Lyon",
              toStation: "Lyon Part Dieu",
            }),
          ],
        });
      }

      expect(url.searchParams.get("datetime")).toBe("20261012T200000");
      expect(url.searchParams.get("datetime_represents")).toBe("arrival");
      return jsonResponse({
        journeys: [
          journey({
            departure: "20261012T181000",
            arrival: "20261012T200500",
            duration: 6900,
            fromStation: "Lyon Part Dieu",
            toStation: "Paris Gare de Lyon",
          }),
          journey({
            departure: "20261012T180000",
            arrival: "20261012T195000",
            duration: 6600,
            fromStation: "Lyon Part Dieu",
            toStation: "Paris Gare de Lyon",
          }),
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchNavitiaTrainRoundTrip({
      originCity: "Paris",
      destinationCity: "Lyon",
      departDate: "2026-10-10",
      returnDate: "2026-10-12",
      earliestDepartureTime: "09:00",
      latestArrivalTime: "12:00",
      earliestReturnDepartureTime: "17:30",
      latestReturnTime: "20:00",
      maxTravelDurationHours: 3,
    });

    expect(result).toMatchObject({
      source: "navitia",
      outbound: {
        departureTime: "09:15",
        arrivalTime: "11:10",
        departureStation: "Paris Gare de Lyon",
        arrivalStation: "Lyon Part Dieu",
        durationMinutes: 115,
      },
      return: {
        departureTime: "18:00",
        arrivalTime: "19:50",
        departureStation: "Lyon Part Dieu",
        arrivalStation: "Paris Gare de Lyon",
        durationMinutes: 110,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns null when Navitia has no rail journey compatible with the route", async () => {
    vi.stubEnv("SNCF_KEY_API", "test-token");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/places")) {
        const q = url.searchParams.get("q");
        return jsonResponse({
          places: [
            {
              embedded_type: "administrative_region",
              name: q,
              administrative_region: {
                name: q,
                coord:
                  q === "Paris"
                    ? { lon: "2.3522", lat: "48.8566" }
                    : { lon: "19.0402", lat: "47.4979" },
              },
            },
          ],
        });
      }
      return jsonResponse({
        journeys: [
          journey({
            departure: "20261010T090000",
            arrival: "20261010T110000",
            duration: 7200,
            fromStation: "A",
            toStation: "B",
            mode: "Bus",
            physicalMode: "physical_mode:Bus",
          }),
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchNavitiaTrainRoundTrip({
        originCity: "Paris",
        destinationCity: "Budapest",
        departDate: "2026-10-10",
        returnDate: "2026-10-12",
      }),
    ).resolves.toBeNull();
  });

  it("does not call Navitia when the server key is not configured", async () => {
    vi.stubEnv("SNCF_KEY_API", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      searchNavitiaTrainRoundTrip({
        originCity: "Paris",
        destinationCity: "Lyon",
        departDate: "2026-10-10",
        returnDate: "2026-10-12",
      }),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
