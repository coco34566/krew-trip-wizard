import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDestinationAiCacheForTests,
  discoverDestinationsWithAi,
  type AiDiscoveryInput,
} from "../krew/destination-ai.server";
import { aiCandidateToDestinationRow, mergeCandidates } from "../krew/candidate-merge";

const input: AiDiscoveryInput = {
  ambiances: ["detente"],
  activityCategories: ["sport"],
  budgetPerPerson: 600,
  maxDistanceKm: 1600,
  nights: 3,
  startMonth: 6,
  departureCity: "Paris",
  departureOrigins: [
    { origin: "Paris", participants: 5 },
    { origin: "Lyon", participants: 3 },
  ],
  acceptedTransportModes: ["train", "flight"],
  participants: 8,
  excludedCountries: [],
  selectedConcepts: [],
  discoveryBranches: ["regional", "outdoor"],
  localMobility: "car_if_worth_it",
  accommodationRole: "part_of_stay",
  relevantIndividualPreferences: [{ activities: ["sport"] }],
};
const response = (content: string, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => ({
    steps: [{ type: "model_output", content: [{ type: "text", text: content }] }],
  }),
  text: async () => content,
});

describe("Gemini destination discovery unique provider", () => {
  beforeEach(() => {
    clearDestinationAiCacheForTests();
    delete process.env["GEMINI_API_KEY"];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("effectue un seul Gemini et transmet origines et modes", async () => {
    process.env["GEMINI_API_KEY"] = "server-secret";
    process.env["GEMINI_MODEL"] = "gemini-test-model";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          '{"destinations":[{"name":"Luberon","destinationType":"region_territory","anchorPlaces":["Gordes"]}]}',
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.model).toBe("gemini-test-model");
    const compact = JSON.parse(body.input);
    expect(compact.departureOrigins).toEqual(input.departureOrigins);
    expect(compact.acceptedTransportModes).toEqual(input.acceptedTransportModes);
  });
  it("ne cascade vers aucun autre LLM après erreur", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    const fetchMock = vi.fn().mockResolvedValue(response("failure", false, 503));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.usedLlm).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("préserve types et estimations structurées", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            '{"destinations":[{"name":"Vercors","destinationType":"outdoor_area","anchorPlaces":["Autrans"],"transportEstimate":{"byOrigin":[{"origin":"Paris","realisticModes":["train"],"roundTripLow":80,"roundTripCentral":120,"roundTripHigh":180,"approximateDurationHours":4,"confidence":"medium"}]},"lodgingEstimate":{"perPersonPerNightLow":40,"perPersonPerNightCentral":60,"perPersonPerNightHigh":90,"confidence":"medium"},"localCostEstimate":{"foodPerPersonPerDay":30,"activitiesPerPersonPerDay":20,"confidence":"medium"},"activityFit":[{"category":"sport","availability":"strong","examples":[],"seasonal":true,"weatherDependent":true,"confidence":"high"}]}]}',
          ),
        ),
    );
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates[0]).toMatchObject({
      destinationType: "outdoor_area",
      lodgingEstimate: { perPersonPerNightCentral: 60 },
      localCostEstimate: { foodPerPersonPerDay: 30 },
    });
    const merged = mergeCandidates([], result.candidates)[0]!;
    expect(merged.transportEstimate?.byOrigin[0]?.roundTripCentral).toBe(120);
    expect(merged.activityFit?.[0]?.availability).toBe("strong");
    expect(aiCandidateToDestinationRow(merged).avg_daily_cost).toBeNull();
  });
  it("sans Gemini retourne le fallback local sans appel externe", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.usedLlm).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
