import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchAccommodationsWithGemini, type AccommodationSearchSpecification } from "../accommodation-ai.server";
import { discoverActivities } from "../activity-discovery.server";
import { discoverDestinationsWithAi } from "../destination-ai.server";
import { regenerateSlotWithAi } from "../activity-ai.server";

const spec: AccommodationSearchSpecification = {
  destination: { name: "Lisbonne", country: "Portugal" },
  dates: { checkIn: "2026-09-01", checkOut: "2026-09-04", nights: 3 },
  group: { size: 8, targetBedrooms: 5, singleRooms: 2, sharedRoomsOrEquivalent: 3 },
  budget: { targetPerPersonStay: 210, hardMaxPerPersonStay: 250 },
  searchStrategies: [
    {
      concept: "aparthotel",
      score: 80,
      priority: 1,
      resultsWanted: 5,
      propertyTypes: ["aparthotel"],
      mustHave: ["wifi"],
      preferred: [],
    },
  ],
  locationIntent: { mode: "central", priority: "preferred", carAccepted: false },
  minimumRating: 4,
  requiredAmenities: ["wifi"],
  accessibilityRequired: false,
};

describe("Modèles Gemini - Grounded vs Standard GEMINI_MODEL", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env["GEMINI_API_KEY"] = "test-key";
    process.env["TAVILY_API_KEY"] = "test-tavily-key";
    delete process.env["GEMINI_GROUNDED_MODEL"];
    delete process.env["GEMINI_MODEL"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("searchAccommodationsWithGemini utilise gemini-2.5-flash par défaut ou GEMINI_MODEL si configuré", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ searchQuery: "aparthotel Lisbonne" }) }] } }], results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await searchAccommodationsWithGemini(spec);

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("generativelanguage.googleapis.com");

    process.env["GEMINI_MODEL"] = "custom-model";
    await searchAccommodationsWithGemini(spec);
    const geminiCalls = fetchMock.mock.calls.filter((c) => typeof c[0] === "string" && c[0].includes("generativelanguage.googleapis.com"));
    expect(geminiCalls[1][0]).toContain("/models/custom-model:generateContent");
  });

  it("discoverActivities utilise gemini-3.6-flash par défaut ou GEMINI_MODEL si configuré", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ searchQuery: "activites Paris" }) }] } }], results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await discoverActivities({
      destination: "Paris",
      ambiances: ["fete"],
      activityCategories: ["bar"],
      budgetPerPerson: 100,
      forceRefresh: true,
    });

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/models/gemini-3.6-flash:generateContent");

    process.env["GEMINI_MODEL"] = "custom-model";
    await discoverActivities({
      destination: "Paris",
      ambiances: ["fete"],
      activityCategories: ["bar"],
      budgetPerPerson: 100,
      forceRefresh: true,
    });
    const geminiCalls = fetchMock.mock.calls.filter((c) => typeof c[0] === "string" && c[0].includes("generativelanguage.googleapis.com"));
    expect(geminiCalls[1][0]).toContain("/models/custom-model:generateContent");
  });

  it("discoverDestinationsWithAi continue d'utiliser GEMINI_MODEL / gemini-3.6-flash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ steps: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await discoverDestinationsWithAi({
      ambiances: ["soleil"],
      activityCategories: ["plage"],
      budgetPerPerson: 500,
      maxDistanceKm: 1000,
      nights: 3,
      startMonth: 6,
      departureCity: "Paris",
      participants: 4,
      excludedCountries: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("gemini-3.6-flash");
  });

  it("regenerateSlotWithAi effectue 0 appel Gemini et réutilise les candidats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const mockSlot = {
      moment: "Soir",
      type: "activite" as const,
      label: "Visite",
      time: "20:00",
    };
    const mockCandidate = {
      id: "c1",
      name: "Bar Test",
      type: "external" as const,
      category: "bar",
      description: null,
      destination: "Paris",
      address: null,
      latitude: null,
      longitude: null,
      sourceUrl: "https://example.com",
      mapsUrl: null,
      source: "example.com",
      priceHint: null,
      priceRange: null,
      durationMinutes: 60,
      openingHours: [],
      rating: null,
      reviewCount: null,
      environment: null,
      tags: [],
      profileFit: 80,
      eventFit: 80,
      seasonality: null,
      verified: true,
      verifiedAt: "2026-01-01",
      groundingSources: [],
    };

    const res = await regenerateSlotWithAi(
      {
        destination: "Paris",
        nights: 2,
        participants: 4,
        budgetPerPerson: 100,
        ambiances: [],
        activityCategories: [],
      },
      mockSlot,
      1,
      [],
      [mockCandidate],
    );

    expect(res.usedLlm).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
