import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { searchNavitiaRoundTrip } from "../navitia-sncf.server";

beforeEach(() => {
  vi.stubEnv("SNCF_KEY_API", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("résout les gares puis respecte les fenêtres horaires aller/retour", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        places: [
          {
            embedded_type: "stop_area",
            id: "stop_area:paris",
            name: "Paris Gare de Lyon",
            stop_area: { id: "stop_area:paris", name: "Paris Gare de Lyon" },
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        places: [
          {
            embedded_type: "stop_area",
            id: "stop_area:lyon",
            name: "Lyon Part Dieu",
            stop_area: { id: "stop_area:lyon", name: "Lyon Part Dieu" },
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        journeys: [
          {
            duration: 7200,
            nb_transfers: 0,
            departure_date_time: "20261010T080000",
            arrival_date_time: "20261010T100000",
            sections: [
              {
                type: "public_transport",
                display_informations: { commercial_mode: "TGV INOUI", network: "SNCF" },
                from: { stop_area: { name: "Paris Gare de Lyon" } },
                to: { stop_area: { name: "Lyon Part Dieu" } },
              },
            ],
          },
        ],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        journeys: [
          {
            duration: 7500,
            nb_transfers: 1,
            departure_date_time: "20261012T180000",
            arrival_date_time: "20261012T201500",
            sections: [
              {
                type: "public_transport",
                display_informations: { physical_mode: "Train", network: "SNCF" },
                from: { stop_area: { name: "Lyon Part Dieu" } },
                to: { stop_area: { name: "Paris Gare de Lyon" } },
              },
            ],
          },
        ],
      }),
    });

  vi.stubGlobal("fetch", fetchMock);

  const result = await searchNavitiaRoundTrip({
    originCity: "Paris",
    destinationCity: "Lyon",
    departDate: "2026-10-10",
    returnDate: "2026-10-12",
    earliestDepartureTime: "07:30",
    latestArrivalTime: "11:00",
    earliestReturnDepartureTime: "17:00",
    latestReturnTime: "22:00",
    maxTravelDurationHours: 3,
  });

  expect(result?.outboundTime).toBe("08:00");
  expect(result?.outboundArrivalTime).toBe("10:00");
  expect(result?.returnDepartureTime).toBe("18:00");
  expect(result?.returnTime).toBe("20:15");
  expect(result?.stops).toBe(1);

  const calls = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
  expect(calls[2]?.searchParams.get("datetime")).toBe("20261010T073000");
  expect(calls[2]?.searchParams.get("datetime_represents")).toBe("departure");
  expect(calls[3]?.searchParams.get("datetime")).toBe("20261012T170000");
});

it("retourne null si aucun vrai trajet ferroviaire ne respecte la fenêtre", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        places: [{ embedded_type: "stop_area", id: "a", name: "Paris", stop_area: { id: "a", name: "Paris" } }],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        places: [{ embedded_type: "stop_area", id: "b", name: "Lyon", stop_area: { id: "b", name: "Lyon" } }],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        journeys: [
          {
            duration: 7200,
            nb_transfers: 0,
            departure_date_time: "20261010T060000",
            arrival_date_time: "20261010T080000",
            sections: [{ type: "public_transport", display_informations: { commercial_mode: "TGV" } }],
          },
        ],
      }),
    });

  vi.stubGlobal("fetch", fetchMock);

  expect(
    await searchNavitiaRoundTrip({
      originCity: "Paris",
      destinationCity: "Lyon",
      departDate: "2026-10-10",
      returnDate: "2026-10-12",
      earliestDepartureTime: "07:30",
    }),
  ).toBeNull();
});

it("ne fait aucun appel sans SNCF_KEY_API", async () => {
  vi.stubEnv("SNCF_KEY_API", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  expect(
    await searchNavitiaRoundTrip({
      originCity: "Paris",
      destinationCity: "Lyon",
      departDate: "2026-10-10",
      returnDate: "2026-10-12",
    }),
  ).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
