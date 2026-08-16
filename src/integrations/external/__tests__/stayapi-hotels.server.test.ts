import { afterEach, describe, expect, it, vi } from "vitest";
import { searchHotelsStayApi } from "../stayapi-hotels.server";

const params = {
  destination: "Paris",
  latitude: 48.8566,
  longitude: 2.3522,
  checkin: "2026-09-10",
  checkout: "2026-09-14",
  adults: 2,
  rooms: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["STAYAPI_API_KEY"];
});

describe("searchHotelsStayApi", () => {
  it("uses the looked-up city and keeps a valid hotel without a provider deeplink", async () => {
    process.env["STAYAPI_API_KEY"] = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { dest_id: "region-id", dest_type: "REGION", name: "Île-de-France" },
              { dest_id: "-1456928", dest_type: "CITY", name: "Paris" },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              hotels: [
                {
                  hotel_id: 42,
                  hotel_name: "Hôtel Test",
                  min_total_price: 180,
                  currency_code: "EUR",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const hotels = await searchHotelsStayApi(params);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("dest_id=-1456928");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("dest_type=CITY");
    expect(hotels).toHaveLength(1);
    expect(hotels[0]).toMatchObject({
      externalId: "stayapi/booking:42",
      name: "Hôtel Test",
      offers: [{ provider: "stayapi/booking", pricePerNight: 180, url: null }],
    });
  });

  it("rejects an HTTP 200 response with no valid hotels", async () => {
    process.env["STAYAPI_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ data: { hotels: [] } }), { status: 200 })),
    );

    await expect(
      searchHotelsStayApi({ ...params, destId: "-1456928", destType: "CITY" }),
    ).rejects.toThrow("aucun hôtel trouvé");
  });

  it("does not turn a StayAPI HTTP error into an empty successful result", async () => {
    process.env["STAYAPI_API_KEY"] = "test-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: "upstream unavailable" }), { status: 503 }),
        ),
    );

    await expect(
      searchHotelsStayApi({ ...params, destId: "-1456928", destType: "CITY" }),
    ).rejects.toThrow("503");
  });
});
