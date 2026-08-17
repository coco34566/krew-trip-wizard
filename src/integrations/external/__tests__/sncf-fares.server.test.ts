import { afterEach, expect, it, vi } from "vitest";
import { searchSncfRoundTripFares } from "../sncf-fares.server";
afterEach(() => {
  vi.unstubAllGlobals();
});
it("cible les deux relations et additionne prix_minimum/prix_maximum", async () => {
  const fetchMock = vi.fn().mockImplementation(async (url: URL) => ({
    ok: true,
    json: async () => ({
      results: String(url).includes("search%28gare_origine%2C+%22Paris%22")
        ? [
            {
              transporteur: "TGV INOUI",
              gare_origine: "Paris Gare de Lyon",
              gare_destination: "Lyon Part Dieu",
              classe: 2,
              profil_tarifaire: "Tarif Normal",
              prix_minimum: 40,
              prix_maximum: 80,
            },
          ]
        : [
            {
              transporteur: "OUIGO",
              gare_origine: "Lyon Part Dieu",
              gare_destination: "Paris Gare de Lyon",
              classe: 2,
              profil_tarifaire: "Tarif Normal",
              prix_minimum: 30,
              prix_maximum: 70,
            },
          ],
    }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await searchSncfRoundTripFares("Paris", "Lyon");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(
    fetchMock.mock.calls.every(([url]) =>
      new URL(url).searchParams.get("where")?.includes("gare_origine"),
    ),
  ).toBe(true);
  expect(result?.roundTripFareRange).toEqual({ min: 70, max: 150 });
});
it("retourne null si un sens manque", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              transporteur: "TGV INOUI",
              gare_origine: "Paris",
              gare_destination: "Lyon",
              classe: 2,
              profil_tarifaire: "Tarif Normal",
              prix_minimum: 40,
              prix_maximum: 80,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) }),
  );
  expect(await searchSncfRoundTripFares("Paris", "Lyon")).toBeNull();
});
