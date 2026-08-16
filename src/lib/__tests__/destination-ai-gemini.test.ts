import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDestinationAiCacheForTests,
  discoverDestinationsWithAi,
  type AiDiscoveryInput,
} from "../krew/destination-ai.server";
import { aiCandidateToDestinationRow, mergeCandidates } from "../krew/candidate-merge";

const input: AiDiscoveryInput = {
  ambiances: ["detente"], activityCategories: ["sport"], budgetPerPerson: 600,
  maxDistanceKm: 1600, nights: 3, startMonth: 6, departureCity: "Paris",
  participants: 8, excludedCountries: [], selectedConcepts: [],
  discoveryBranches: ["regional", "outdoor"], localMobility: "car_if_worth_it",
  accommodationRole: "part_of_stay", relevantIndividualPreferences: [{ activities: ["sport"] }],
};

const response = (content: string, ok = true, status = 200) => ({
  ok, status,
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => content,
});

describe("Gemini destination discovery provider order", () => {
  beforeEach(() => {
    clearDestinationAiCacheForTests();
    delete process.env["GEMINI_API_KEY"];
    delete process.env["AIMLAPI_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["LLM_API_KEY"];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses configured Gemini first with the configured model", async () => {
    process.env["GEMINI_API_KEY"] = "server-secret";
    process.env["GEMINI_MODEL"] = "gemini-test-model";
    const fetchMock = vi.fn().mockResolvedValue(response('{"destinations":[{"name":"Luberon","country":"France","destinationType":"region_territory","anchorPlaces":["Gordes"]}]}'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("gemini");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body).model).toBe("gemini-test-model");
  });

  it("falls back from Gemini to AIMLAPI", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    process.env["AIMLAPI_API_KEY"] = "aiml";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("failure", false, 503))
      .mockResolvedValueOnce(response('{"destinations":[{"name":"Lisbonne","destinationType":"city"}]}'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("aimlapi");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back after invalid Gemini JSON without corrupting candidates", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    process.env["OPENAI_API_KEY"] = "openai";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response("not-json"))
      .mockResolvedValueOnce(response('{"destinations":[{"name":"Vercors","destinationType":"outdoor_area","anchorPlaces":["Villard-de-Lans"]}]}'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("openai");
    expect(result.candidates).toHaveLength(1);
  });

  it("preserves region and outdoor candidate types", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('{"destinations":[{"name":"Luberon","destinationType":"region_territory","anchorPlaces":["Gordes"]},{"name":"Vercors","destinationType":"outdoor_area","anchorPlaces":["Autrans"]}]}')));
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates.map((candidate) => candidate.destinationType)).toEqual(["region_territory", "outdoor_area"]);
  });

  it("keeps Gemini estimates non-verified at the scoring boundary", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response('{"destinations":[{"name":"Dolomites","cost":99,"km":1200,"destinationType":"outdoor_area","anchorPlaces":["Cortina"]}]}')));
    const result = await discoverDestinationsWithAi(input);
    const merged = mergeCandidates([], result.candidates)[0]!;
    const row = aiCandidateToDestinationRow(merged);
    expect(merged.verificationState).toBe("estimated");
    expect(row.avg_daily_cost).toBeNull();
    expect(row.distance_from_paris_km).toBeNull();
  });

  it("continues with existing providers when Gemini is not configured", async () => {
    process.env["AIMLAPI_API_KEY"] = "aiml";
    const fetchMock = vi.fn().mockResolvedValue(response('{"destinations":[{"name":"Lyon","destinationType":"city"}]}'));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("aimlapi");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.aimlapi.com");
  });
});
