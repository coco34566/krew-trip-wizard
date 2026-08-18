import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDestinationAiCacheForTests,
  discoverDestinationsWithAi,
  REQUEST_TIMEOUT_MS,
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
  it("préserve types et estimations structurées compactes", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            '{"destinations":[{"name":"Vercors","country":"France","region":"Isère","destinationType":"outdoor_area","anchorPlaces":["Autrans"],"why":"Montagne et sport","km":600,"months":[5,6,9],"transport":{"Paris":{"modes":["train"],"approxHours":4}},"budgetLevel":"medium","activityFit":["sport","nature"],"environmentFit":["mountain","outdoor"],"accommodationFit":["house_together"],"seasonFit":"good"}]}',
          ),
        ),
    );
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates[0]).toMatchObject({
      destinationType: "outdoor_area",
      budgetLevel: "medium",
      seasonFit: "good",
    });
    const merged = mergeCandidates([], result.candidates)[0]!;
    expect(merged.transport?.["Paris"]?.approxHours).toBe(4);
    expect(merged.transport?.["Paris"]?.modes).toEqual(["train"]);
    expect(merged.activityFit).toEqual(["sport", "nature"]);
    expect(merged.environmentFit).toEqual(["mountain", "outdoor"]);
    expect(merged.accommodationFit).toEqual(["house_together"]);
    expect(aiCandidateToDestinationRow(merged).avg_daily_cost).toBeNull();
  });
  it("sans Gemini retourne le fallback local sans appel externe", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverDestinationsWithAi(input);
    expect(result.usedLlm).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("exporte REQUEST_TIMEOUT_MS égal à 60000ms", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(60_000);
  });
  it("conserve jusqu'à 50 candidats avant scoring dans mergeCandidates et parseur Gemini", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    const destinations = Array.from({ length: 60 }, (_, i) => ({
      name: `Ville ${i + 1}`,
      country: "France",
      why: "test",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(JSON.stringify({ destinations }))),
    );
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates.length).toBe(50);

    const extraRuleBased = Array.from({ length: 20 }, (_, i) => ({
      name: `Local ${i + 1}`,
      country: "France",
      affinity: 90 - i,
      reason: "règle locale",
      dailyCost: 70,
      distanceKm: 500,
      bestMonths: [5, 6],
      destinationType: "city" as const,
      anchorPlaces: [`Local ${i + 1}`],
    }));
    const merged = mergeCandidates(extraRuleBased, result.candidates);
    expect(merged.length).toBeGreaterThan(12);
    expect(merged.slice(0, 50).length).toBe(50);
  });
});
