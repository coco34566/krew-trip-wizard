import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDestinationAiCacheForTests,
  buildKrewDiscoveryBrief,
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

  it("uses the native Gemini interactions endpoint and configured model", async () => {
    process.env["GEMINI_API_KEY"] = "server-secret";
    process.env["GEMINI_MODEL"] = "gemini-test-model";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          '{"destinations":[{"name":"Luberon","country":"France","destinationType":"region_territory","anchorPlaces":["Gordes"]}]}',
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverDestinationsWithAi(input);

    expect(result.provider).toBe("gemini");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-goog-api-key": "server-secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body).model).toBe("gemini-test-model");
    const requestInput = JSON.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body).input);
    expect(requestInput).toHaveProperty("hardConstraints");
    expect(requestInput).toHaveProperty("collectiveProfiles");
    expect(requestInput).not.toHaveProperty("rawQuestionnaireRows");
  });

  it("returns no AI candidates so the caller can use local KREW fallback when Gemini fails", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("failure", false, 503)));

    const result = await discoverDestinationsWithAi(input);

    expect(result.candidates).toEqual([]);
    expect(result.usedLlm).toBe(false);
    expect(result.provider).toBe("gemini");
    expect(result.error).toContain("gemini_http_503");
  });

  it("uses a 60 second request timeout", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(60_000);
  });

  it("deduplicates simultaneous identical Gemini generations", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    let resolveFetch!: (value: ReturnType<typeof response>) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = discoverDestinationsWithAi(input);
    const second = discoverDestinationsWithAi(input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(
      response(
        '{"destinations":[{"name":"Luberon","destinationType":"region_territory","anchorPlaces":["Gordes"]}]}',
      ),
    );

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves region and outdoor candidate types", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            '{"destinations":[{"name":"Luberon","destinationType":"region_territory","anchorPlaces":["Gordes"]},{"name":"Vercors","destinationType":"outdoor_area","anchorPlaces":["Autrans"]}]}',
          ),
        ),
    );
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates.map((candidate) => candidate.destinationType)).toEqual([
      "region_territory",
      "outdoor_area",
    ]);
  });

  it("keeps Gemini estimates non-verified at the scoring boundary", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            '{"destinations":[{"name":"Dolomites","cost":99,"km":1200,"destinationType":"outdoor_area","anchorPlaces":["Cortina"]}]}',
          ),
        ),
    );
    const result = await discoverDestinationsWithAi(input);
    const merged = mergeCandidates([], result.candidates)[0]!;
    const row = aiCandidateToDestinationRow(merged);
    expect(merged.verificationState).toBe("estimated");
    expect(row.avg_daily_cost).toBe(99);
    expect(row.distance_from_paris_km).toBe(1200);
  });

  it("parses exploration classes and their explanation signals", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            '{"destinations":[{"name":"Annecy","candidateClass":"strong_match","matchedSignals":["lac"],"compromiseFor":[],"confidence":0.9},{"name":"Grenoble","candidateClass":"smart_compromise","matchedSignals":["culture","outdoor"],"compromiseFor":["urbain","nature"]},{"name":"Die","candidateClass":"gem","matchedSignals":["nature"]}]}',
          ),
        ),
    );
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates.map((candidate) => candidate.candidateClass)).toEqual([
      "strong_match",
      "smart_compromise",
      "gem",
    ]);
    expect(result.candidates[1]?.compromiseFor).toEqual(["urbain", "nature"]);
    expect(result.candidates[0]?.confidence).toBe(0.9);
  });

  it("builds hard/soft sections without turning soft preferences into constraints", () => {
    const brief = buildKrewDiscoveryBrief({
      ...input,
      startDate: "2026-06-12",
      endDate: "2026-06-15",
      departureOrigins: [
        { city: "Lyon", count: 5 },
        { city: "Genève", count: 3 },
      ],
      transportModes: ["train", "car"],
      refusedTransportModes: ["flight"],
      budgetMedian: 550,
      budgetMinimum: 420,
      budgetVeto: 400,
      groupAgeRange: "25-35",
      rhythm: { pace: "equilibre", preferredTimeSlots: ["soir"] },
      accommodationSignals: { type: "house", role: "centerpiece", pool: true },
      historySignals: [{ country: "Italie", dominantAmbiance: "culture" }],
      stayProfiles: [{ id: "city_discovery", score: 78, evidence: ["culture"] }],
      selectedConcepts: [
        {
          id: "city+nature",
          title: "Ville et nature",
          profiles: ["city_discovery", "nature_disconnect"],
          score: 75,
          rationale: "compromis",
        },
      ],
      relevantIndividualPreferences: [
        { ambiances: ["fete"], activities: ["culture"], environment: "urbain" },
        { ambiances: ["detente"], activities: ["randonnee"], environment: "nature" },
        { ambiances: ["fete"], activities: ["culture"], environment: "urbain" },
      ],
      scoringSignals: {
        starWeight: 1.8,
        scoringWeights: { ambiance: 20, activities: 18 },
        hardConstraints: { planeRefused: true, budgetVeto: 500 },
        softPreferences: { travelPace: "equilibre" },
      },
    });
    expect(brief.hardConstraints).toMatchObject({ planeRefused: true, budgetVeto: 500 });
    expect(brief.hardConstraints).not.toHaveProperty("travelPace");
    expect(brief.context).toMatchObject({
      startDate: "2026-06-12",
      endDate: "2026-06-15",
      ageRange: "25-35",
      departureOrigins: [
        { city: "Lyon", count: 5 },
        { city: "Genève", count: 3 },
      ],
    });
    expect(brief.hardConstraints).toMatchObject({
      acceptedTransportModes: ["train", "car"],
      refusedTransportModes: ["flight"],
    });
    expect(brief.priorities).toMatchObject({
      travelPace: "equilibre",
      scoringWeights: { ambiance: 20, activities: 18 },
      medianBudgetPerPerson: 550,
      mostConstrainedBudget: 420,
      budgetVeto: 400,
      accommodation: { type: "house", role: "centerpiece", pool: true },
    });
    expect(brief.collectiveProfiles[0]?.evidence).toEqual(["culture"]);
    expect(brief.validatedConcepts[0]?.title).toBe("Ville et nature");
    expect(brief.star["weight"]).toBe(1.8);
    expect(brief.groupDynamics.divergences).toEqual(
      expect.arrayContaining([expect.stringContaining("environment")]),
    );
    expect(brief.groupDynamics.importantMinorities.length).toBeGreaterThan(0);
  });

  it("does not call an external LLM when Gemini is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverDestinationsWithAi(input);

    expect(result).toMatchObject({ candidates: [], usedLlm: false, error: "no_gemini_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
