import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDestinationAiCacheForTests,
  discoverDestinationsWithAi,
  fingerprint,
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
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("effectue un seul Gemini et transmet origines et modes sans scoringWeights dans le payload", async () => {
    process.env["GEMINI_API_KEY"] = "server-secret";
    process.env["GEMINI_MODEL"] = "gemini-test-model";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(
          '{"candidates":[{"name":"Luberon","country":"France","region":"Provence","destinationType":"region_territory","anchorPlaces":["Gordes"],"why":"Nature et villages","budgetFit":"likely_compatible","budgetReason":"Accessible","transport":{"Paris":{"plausibleModes":["train","car"],"plausibility":"likely"}},"activityFit":["nature"],"environmentFit":["village"],"accommodationFit":["house_together"],"seasonFit":"good"}]}',
        ),
      );
    global.fetch = fetchMock as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.model).toBe("gemini-test-model");
    const compact = JSON.parse(body.input);
    expect(compact.departureOrigins).toEqual(input.departureOrigins);
    expect(compact.acceptedTransportModes).toEqual(input.acceptedTransportModes);
    if (compact.scoringProfile) {
      expect(compact.scoringProfile.scoringWeights).toBeUndefined();
    }
  });

  it("ne cascade vers aucun autre LLM après erreur", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    const fetchMock = vi.fn().mockResolvedValue(response("failure", false, 503));
    global.fetch = fetchMock as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.usedLlm).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("préserve types et estimations qualitatives de la nouvelle structure JSON contractuelle", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          '{"candidates":[{"name":"Vercors","country":"France","region":"Isère","destinationType":"outdoor_area","anchorPlaces":["Autrans"],"why":"Montagne et sport","budgetFit":"likely_compatible","budgetReason":"Coût modéré pour séjour outdoor","transport":{"Paris":{"plausibleModes":["train"],"plausibility":"likely"}},"activityFit":["sport","nature"],"environmentFit":["mountain","outdoor"],"accommodationFit":["house_together"],"seasonFit":"good"}]}',
        ),
      ) as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates[0]).toMatchObject({
      destinationType: "outdoor_area",
      budgetFit: "likely_compatible",
      budgetReason: "Coût modéré pour séjour outdoor",
      seasonFit: "good",
    });
    const merged = mergeCandidates([], result.candidates)[0]!;
    expect(merged.source).toBe("gemini");
    expect(merged.transport?.["Paris"]?.plausibleModes).toEqual(["train"]);
    expect(merged.transport?.["Paris"]?.plausibility).toBe("likely");
    expect(merged.activityFit).toEqual(["sport", "nature"]);
    expect(merged.environmentFit).toEqual(["mountain", "outdoor"]);
    expect(merged.accommodationFit).toEqual(["house_together"]);
    expect(result.candidates[0]?.dailyCost).toBeUndefined();
    expect(aiCandidateToDestinationRow(merged).avg_daily_cost).toBeNull();
  });

  it("supporte seasonFit = mixed", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          '{"candidates":[{"name":"Luberon","country":"France","destinationType":"region_territory","anchorPlaces":["Gordes"],"why":"Provence","budgetFit":"uncertain","budgetReason":"Incertain en haute saison","seasonFit":"mixed"}]}',
        ),
      ) as any;
    const result = await discoverDestinationsWithAi(input);
    const candidate = result.candidates[0]!;
    expect(candidate.budgetFit).toBe("uncertain");
    expect(candidate.seasonFit).toBe("mixed");
    expect((candidate as any).dailyCost).toBeUndefined();
  });

  it("sans Gemini retourne le fallback local sans appel externe", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.usedLlm).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exporte REQUEST_TIMEOUT_MS égal à 120000ms", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(120_000);
  });

  it("conserve jusqu'à 50 candidats dans mergeCandidates et parseur Gemini", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    const candidates = Array.from({ length: 60 }, (_, i) => ({
      name: `Ville ${i + 1}`,
      country: "France",
      why: "test",
      budgetFit: "likely_compatible",
    }));
    global.fetch = vi.fn().mockResolvedValue(response(JSON.stringify({ candidates }))) as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates.length).toBe(50);

    const extraRuleBased = Array.from({ length: 20 }, (_, i) => ({
      name: `Local ${i + 1}`,
      country: "France",
      affinity: 90 - i,
      reason: "règle locale",
      distanceKm: 500,
      bestMonths: [5, 6],
      destinationType: "city" as const,
      anchorPlaces: [`Local ${i + 1}`],
    }));
    const merged = mergeCandidates(extraRuleBased, result.candidates);
    expect(merged.length).toBeGreaterThan(12);
    expect(merged.slice(0, 50).length).toBe(50);
  });

  describe("Sources dans mergeCandidates", () => {
    it("gemini uniquement → source = gemini", () => {
      const merged = mergeCandidates([], [
        {
          name: "Tokyo",
          country: "Japon",
          affinity: 80,
          why: "Asie",
          reason: "Japon",
          destinationType: "city",
          anchorPlaces: ["Tokyo"],
        },
      ]);
      expect(merged[0]?.source).toBe("gemini");
    });

    it("règle locale uniquement → source = local", () => {
      const merged = mergeCandidates(
        [
          {
            name: "Bordeaux",
            country: "France",
            distanceKm: 500,
            affinity: 85,
            reason: "règle locale",
            destinationType: "city",
            anchorPlaces: ["Bordeaux"],
          },
        ],
        [],
      );
      expect(merged[0]?.source).toBe("local");
    });

    it("même destination dans Gemini et local → source = merged et sans doublon", () => {
      const merged = mergeCandidates(
        [
          {
            name: "Bordeaux",
            country: "France",
            distanceKm: 500,
            affinity: 85,
            reason: "règle locale",
            destinationType: "city",
            anchorPlaces: ["Bordeaux"],
          },
        ],
        [
          {
            name: "Bordeaux",
            country: "France",
            affinity: 90,
            why: "Vin et culture",
            reason: "Gironde",
            destinationType: "city",
            anchorPlaces: ["Bordeaux"],
          },
        ],
      );
      expect(merged).toHaveLength(1);
      expect(merged[0]?.source).toBe("merged");
      expect(merged[0]?.affinity).toBe(90);
    });
  });

  it("mappe plausibilité inconnue/absente à 'uncertain'", async () => {
    process.env["GEMINI_API_KEY"] = "gemini";
    global.fetch = vi.fn().mockResolvedValue(
      response(
        '{"candidates":[{"name":"Annecy","country":"France","destinationType":"city","anchorPlaces":["Annecy"],"why":"Lac","transport":{"Paris":{"plausibleModes":["train"]}}}]}',
      ),
    ) as any;
    const result = await discoverDestinationsWithAi(input);
    expect(result.candidates[0]?.transport?.["Paris"]?.plausibility).toBe("uncertain");
  });

  describe("Enforcement du contrat Gemini strict (Section 3)", () => {
    it("refuse l'ancien payload avec clé 'destinations' ou 'cities'", async () => {
      process.env["GEMINI_API_KEY"] = "gemini";
      global.fetch = vi.fn().mockResolvedValue(
        response(
          '{"destinations":[{"name":"Nice","country":"France"}]}',
        ),
      ) as any;
      const result = await discoverDestinationsWithAi(input);
      expect(result.candidates).toEqual([]);
    });

    it("ignore les anciens champs quantitatifs (approxHours, cost, km, months)", async () => {
      process.env["GEMINI_API_KEY"] = "gemini";
      global.fetch = vi.fn().mockResolvedValue(
        response(
          '{"candidates":[{"name":"Chamonix","country":"France","destinationType":"outdoor_area","anchorPlaces":["Chamonix"],"why":"Montagne","cost":250,"km":600,"months":[6,7],"transport":{"Paris":{"plausibleModes":["train"],"approxHours":5.5,"plausibility":"likely"}}}]}',
        ),
      ) as any;
      const result = await discoverDestinationsWithAi(input);
      expect(result.candidates).toHaveLength(1);
      const cand = result.candidates[0]!;
      expect((cand as any).dailyCost).toBeUndefined();
      expect((cand as any).distanceKm).toBeUndefined();
      expect((cand as any).bestMonths).toBeUndefined();
      expect((cand.transport?.["Paris"] as any)?.approxHours).toBeUndefined();
      expect(cand.transport?.["Paris"]?.plausibleModes).toEqual(["train"]);
      expect(cand.transport?.["Paris"]?.plausibility).toBe("likely");
    });
  });

  describe("Candidate Pool & Batching Rules (PR #119)", () => {
    it("canServeFromCandidatePool retourne true si >= 4 candidats available dans le pool pour le fingerprint courant", async () => {
      const { canServeFromCandidatePool } = await import("../krew/trip-service");
      const mockSupabase = {
        from: (table: string) => {
          if (table === "trips") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "trip-1",
                      duration_nights: 3,
                      participants_count: 4,
                      departure_city: "Paris",
                      stay_profile_validated_at: "2026-01-01",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "trip_preferences") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { max_distance_km: 1500 }, error: null }),
                }),
              }),
            };
          }
          if (table === "trip_participants") {
            return {
              select: () => ({
                eq: () => ({
                  data: [{ id: "p1", user_id: "u1", status: "accepte" }],
                  error: null,
                }),
              }),
            };
          }
          if (table === "trip_participant_preferences") {
            return {
              select: () => ({
                eq: async () => ({
                  data: [
                    {
                      user_id: "u1",
                      ambiances: ["detente"],
                      budget_max: 500,
                      budget_priority: "nice_to_have",
                      departure_city: "Paris",
                      transport_mode_accepted: ["train"],
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === "destination_candidate_pool") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: async () => ({ count: 6, error: null }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
        },
      };

      const serveable = await canServeFromCandidatePool(mockSupabase as any, "trip-1");
      expect(serveable).toBe(true);
    });

    it("canServeFromCandidatePool retourne false si < 4 candidats available", async () => {
      const { canServeFromCandidatePool } = await import("../krew/trip-service");
      const mockSupabase = {
        from: (table: string) => {
          if (table === "trips") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "trip-1",
                      duration_nights: 3,
                      participants_count: 4,
                      departure_city: "Paris",
                      stay_profile_validated_at: "2026-01-01",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "trip_preferences") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { max_distance_km: 1500 }, error: null }),
                }),
              }),
            };
          }
          if (table === "trip_participants") {
            return {
              select: () => ({
                eq: () => ({
                  data: [{ id: "p1", user_id: "u1", status: "accepte" }],
                  error: null,
                }),
              }),
            };
          }
          if (table === "trip_participant_preferences") {
            return {
              select: () => ({
                eq: async () => ({
                  data: [
                    {
                      user_id: "u1",
                      ambiances: ["detente"],
                      budget_max: 500,
                      departure_city: "Paris",
                    },
                  ],
                  error: null,
                }),
              }),
            };
          }
          if (table === "destination_candidate_pool") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: async () => ({ count: 2, error: null }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
        },
      };

      const serveable = await canServeFromCandidatePool(mockSupabase as any, "trip-1");
      expect(serveable).toBe(false);
    });
  });

  describe("Brief Fingerprint déterministe", () => {
    it("produit le même hash peu importe l'ordre des tableaux non ordonnés", () => {
      const fp1 = fingerprint({
        ...input,
        ambiances: ["fete", "detente"],
        activityCategories: ["sport", "culture"],
      });
      const fp2 = fingerprint({
        ...input,
        ambiances: ["detente", "fete"],
        activityCategories: ["culture", "sport"],
      });
      expect(fp1).toBe(fp2);
    });

    it("modifie le fingerprint si un paramètre structurant change", () => {
      const fp1 = fingerprint(input);
      const fp2 = fingerprint({ ...input, budgetPerPerson: 1200 });
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("Hard veto budget et reliability des sources (property_web vs provider)", () => {
    it("ne prouve jamais un veto budget si l'hébergement est property_web, estimated ou unknown", async () => {
      const { buildProposals } = await import("../krew/engine");
      const catalog = {
        destinations: [
          {
            id: "d1",
            slug: "nice",
            name: "Nice",
            country: "France",
            description: null,
            image_url: null,
            avg_daily_cost: 100,
            distance_from_paris_km: 700,
            popularity: 0.8,
            rating: 4.5,
            best_months: [6, 7],
            score_fete: 0.8,
            score_aventure: 0.5,
            score_detente: 0.8,
            score_luxe: 0.7,
            score_insolite: 0.5,
            score_sportif: 0.5,
            score_culturel: 0.8,
          },
        ],
        activities: [],
        accommodations: [
          {
            id: "acc-1",
            destination_id: "d1",
            name: "Hôtel Nice Web",
            type: "hotel",
            description: null,
            price_per_night_per_person: 300,
            capacity: 4,
            rating: 4.2,
            distance_center_km: 2,
            image_url: null,
            source: "property_web:booking",
            price_verified: true,
            availability_verified: true,
            verification_state: "confirmed" as const,
          },
        ],
      };

      const context = {
        participants: 2,
        budgetPerPerson: 200,
        nights: 2,
        ambiances: ["detente"],
        activityCategories: [],
        maxDistanceKm: 1000,
        excludedCountries: [],
        letKrewDecide: true,
        needsCityCenter: true,
        startMonth: 6,
        hasBudgetVeto: true,
        vetoBudgetMax: 200,
        transportPriceSourceByDestinationId: { d1: "provider" as const },
        transportByDestinationId: { d1: 100 },
      };

      const proposals = buildProposals(catalog, context, 5);
      expect(proposals.length).toBeGreaterThan(0);
      expect(proposals[0]?.destination.name).toBe("Nice");
    });

    it("élimine la destination si logement = provider et transport = provider et total > vetoBudgetMax", async () => {
      const { buildProposals } = await import("../krew/engine");
      const catalog = {
        destinations: [
          {
            id: "d1",
            slug: "nice",
            name: "Nice",
            country: "France",
            description: null,
            image_url: null,
            avg_daily_cost: 100,
            distance_from_paris_km: 700,
            popularity: 0.8,
            rating: 4.5,
            best_months: [6, 7],
            score_fete: 0.8,
            score_aventure: 0.5,
            score_detente: 0.8,
            score_luxe: 0.7,
            score_insolite: 0.5,
            score_sportif: 0.5,
            score_culturel: 0.8,
          },
        ],
        activities: [],
        accommodations: [
          {
            id: "acc-1",
            destination_id: "d1",
            name: "Hôtel Nice Live",
            type: "hotel",
            description: null,
            price_per_night_per_person: 300,
            capacity: 4,
            rating: 4.2,
            distance_center_km: 2,
            image_url: null,
            source: "rapidapi",
          },
        ],
      };

      const context = {
        participants: 2,
        budgetPerPerson: 200,
        nights: 2,
        ambiances: ["detente"],
        activityCategories: [],
        maxDistanceKm: 1000,
        excludedCountries: [],
        letKrewDecide: true,
        needsCityCenter: true,
        startMonth: 6,
        hasBudgetVeto: true,
        vetoBudgetMax: 200,
        transportPriceSourceByDestinationId: { d1: "provider" as const },
        transportByDestinationId: { d1: 100 },
      };

      const proposals = buildProposals(catalog, context, 5);
      expect(proposals.length).toBe(0);
    });
  });

  describe("Test End-To-End de la persistance du pool et rotation des batchs", () => {
    it("déroule Batch 1 (Gemini appelé) -> Batch 2 (Pool utilisé sans Gemini) -> Sélection -> Changement de brief", async () => {
      process.env["GEMINI_API_KEY"] = "gemini-secret";
      process.env["SUPABASE_URL"] = "https://mock.supabase.co";
      process.env["SUPABASE_SERVICE_ROLE_KEY"] = "mock-service-role-key";
      const { generateRecommendationsForTrip } = await import("../krew/trip-service");

      let geminiCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url: any) => {
        const urlStr = String(url || "");
        if (urlStr.includes("generativelanguage.googleapis.com")) {
          geminiCallCount++;
          const cities = [
            "Nice", "Bordeaux", "Lyon", "Marseille", "Toulouse", "Nantes", "Lille", "Strasbourg",
            "Montpellier", "Rennes", "Dijon", "Angers", "Aix-en-Provence", "Brest", "Limoges", "Tours",
            "Amiens", "Metz", "Besançon", "Perpignan", "Orléans", "Rouen", "Mulhouse", "Caen",
            "Nancy", "Avignon", "Poitiers", "Cannes", "Dunkerque", "Saint-Nazaire"
          ];
          const candidateList = cities.map((name, i) => ({
            name,
            country: "France",
            destinationType: "city",
            anchorPlaces: [name],
            why: `Raison ${i + 1}`,
            budgetFit: "likely_compatible",
          }));
          return response(JSON.stringify({ candidates: candidateList }));
        }
        return response(JSON.stringify({}));
      }) as any;

      const mockPoolRows: any[] = [];
      let currentTripBudget = 500;

      const createMockSupabase = () => ({
        from: (table: string) => {
          if (table === "trips") {
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              neq: () => queryChain,
              single: async () => ({
                data: {
                  id: "trip-e2e",
                  owner_id: "user-orga",
                  duration_nights: 2,
                  participants_count: 2,
                  budget_per_person: currentTripBudget,
                  departure_city: "Paris",
                  stay_profile_validated_at: "2026-01-01",
                  stay_concepts_selected: [{ id: "city_lively", profiles: ["city_lively"] }],
                },
                error: null,
              }),
              update: () => queryChain,
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
            return queryChain;
          }
          if (table === "trip_preferences") {
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              maybeSingle: async () => ({
                data: { max_distance_km: 1500, let_krew_decide: true, max_budget: currentTripBudget },
                error: null,
              }),
              then: (resolve: any) =>
                resolve({
                  data: { max_distance_km: 1500, let_krew_decide: true, max_budget: currentTripBudget },
                  error: null,
                }),
            };
            return queryChain;
          }
          if (table === "trip_participants") {
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              then: (resolve: any) =>
                resolve({
                  data: [{ id: "p1", user_id: "u1", status: "accepte" }],
                  error: null,
                }),
            };
            return queryChain;
          }
          if (table === "trip_participant_preferences") {
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              then: (resolve: any) =>
                resolve({
                  data: [
                    {
                      user_id: "u1",
                      ambiances: ["fete"],
                      budget_max: currentTripBudget,
                      departure_city: "Paris",
                    },
                  ],
                  error: null,
                }),
            };
            return queryChain;
          }
          if (table === "destination_candidate_pool") {
            return {
              select: (cols?: string) => ({
                eq: (f1: string, v1: any) => ({
                  eq: (f2: string, v2: any) => {
                    const filtered = mockPoolRows.filter(
                      (r) => r.trip_id === v1 && r.brief_fingerprint === v2,
                    );
                    return {
                      eq: (f3: string, v3: any) => {
                        const finalFiltered = filtered.filter((r) => r.status === v3);
                        return Promise.resolve({
                          data: finalFiltered,
                          count: finalFiltered.length,
                          error: null,
                        });
                      },
                      order: () => ({
                        limit: async () => ({
                          data: filtered.sort((a, b) => (b.shown_batch || 0) - (a.shown_batch || 0)),
                          error: null,
                        }),
                      }),
                      data: filtered,
                      count: filtered.length,
                      error: null,
                    };
                  },
                }),
              }),
              upsert: async (rows: any[]) => {
                for (const row of rows) {
                  const idx = mockPoolRows.findIndex(
                    (r) =>
                      r.trip_id === row.trip_id &&
                      r.brief_fingerprint === row.brief_fingerprint &&
                      r.destination_key === row.destination_key,
                  );
                  if (idx >= 0) {
                    mockPoolRows[idx] = { ...mockPoolRows[idx], ...row };
                  } else {
                    mockPoolRows.push(row);
                  }
                }
                return { data: rows, error: null };
              },
              update: (updateData: any) => ({
                eq: (f1: string, v1: any) => ({
                  eq: (f2: string, v2: any) => ({
                    eq: async (f3: string, v3: any) => {
                      const idx = mockPoolRows.findIndex(
                        (r) =>
                          r.trip_id === v1 &&
                          r.brief_fingerprint === v2 &&
                          r.destination_key === v3,
                      );
                      if (idx >= 0) {
                        mockPoolRows[idx] = { ...mockPoolRows[idx], ...updateData };
                      }
                      return { data: null, error: null };
                    },
                  }),
                }),
              }),
            };
          }
          if (table === "destinations") {
            const mockDests = [
              "Nice", "Bordeaux", "Lyon", "Marseille", "Toulouse", "Nantes", "Lille", "Strasbourg",
              "Montpellier", "Rennes", "Dijon", "Angers", "Aix-en-Provence", "Brest", "Limoges", "Tours",
              "Amiens", "Metz", "Besançon", "Perpignan", "Orléans", "Rouen", "Mulhouse", "Caen",
              "Nancy", "Avignon", "Poitiers", "Cannes", "Dunkerque", "Saint-Nazaire"
            ].map((name, i) => ({
              id: `dest-${i + 1}`,
              slug: name.toLowerCase(),
              name,
              country: "France",
              avg_daily_cost: 100,
              distance_from_paris_km: 500,
              popularity: 0.8,
              rating: 4.5,
              best_months: [5, 6, 7],
              score_fete: 0.8,
              score_detente: 0.8,
              score_culturel: 0.8,
              score_aventure: 0.5,
              score_luxe: 0.5,
              score_insolite: 0.5,
              score_sportif: 0.5,
              source: "krew_discovery",
            }));
            let searchedName: string | null = null;
            let filterNames: string[] | null = null;
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              ilike: (_col: string, val: string) => {
                searchedName = val;
                return queryChain;
              },
              lte: () => queryChain,
              gte: () => queryChain,
              in: (_col: string, vals: string[]) => {
                filterNames = vals;
                return queryChain;
              },
              order: () => queryChain,
              limit: () => queryChain,
              maybeSingle: async () => {
                const match = searchedName
                  ? mockDests.find((d) => d.name.toLowerCase() === searchedName?.toLowerCase())
                  : null;
                return { data: match || null, error: null };
              },
              single: async () => {
                const match = searchedName
                  ? mockDests.find((d) => d.name.toLowerCase() === searchedName?.toLowerCase())
                  : mockDests[0];
                return { data: match || null, error: null };
              },
              then: (resolve: any) => {
                const resData = filterNames
                  ? mockDests.filter((d) => filterNames?.includes(d.id) || filterNames?.includes(d.name))
                  : mockDests;
                return resolve({ data: resData, error: null });
              },
              data: mockDests,
              error: null,
            };
            return queryChain;
          }
          if (table === "recommendations") {
            const queryChain: any = {
              select: () => queryChain,
              eq: () => queryChain,
              maybeSingle: async () => ({ data: null, error: null }),
              insert: () => ({
                select: async () => ({ data: [{ id: "reco-1" }], error: null }),
              }),
              delete: () => ({
                in: async () => ({ data: null, error: null }),
              }),
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
            return queryChain;
          }
          const queryChain: any = {
            select: () => queryChain,
            eq: () => queryChain,
            ilike: () => queryChain,
            lte: () => queryChain,
            gte: () => queryChain,
            in: () => queryChain,
            order: () => queryChain,
            limit: () => queryChain,
            maybeSingle: async () => ({ data: null, error: null }),
            single: async () => ({ data: null, error: null }),
            then: (resolve: any) => resolve({ data: [], error: null }),
            data: [],
            error: null,
          };
          return queryChain;
        },
      });

      // ÉTAPE 1: Premier Batch
      const supabase1 = createMockSupabase();
      const res1 = await generateRecommendationsForTrip(supabase1 as any, "trip-e2e");
      expect(geminiCallCount).toBe(1);
      expect(res1.count).toBe(4);
      const shownBatch1 = mockPoolRows.filter((r) => r.status === "shown");
      expect(shownBatch1).toHaveLength(4);
      expect(shownBatch1.every((r) => r.shown_batch === 1)).toBe(true);

      const batch1Names = shownBatch1.map((r) => r.name);

      // ÉTAPE 2: Deuxième Batch ("Voir d'autres propositions")
      const supabase2 = createMockSupabase();
      const res2 = await generateRecommendationsForTrip(supabase2 as any, "trip-e2e");
      expect(geminiCallCount).toBe(1); // Gemini non rappelé !
      expect(res2.count).toBe(4);
      const shownBatch2 = mockPoolRows.filter((r) => r.status === "shown" && r.shown_batch === 2);
      expect(shownBatch2).toHaveLength(4);

      const batch2Names = shownBatch2.map((r) => r.name);
      // batch 1 ∩ batch 2 = ∅
      const intersection = batch1Names.filter((name) => batch2Names.includes(name));
      expect(intersection).toHaveLength(0);

      // ÉTAPE 3: Changement de brief (ex: budget passe à 1200)
      currentTripBudget = 1200;
      const supabase3 = createMockSupabase();
      const res3 = await generateRecommendationsForTrip(supabase3 as any, "trip-e2e");
      expect(geminiCallCount).toBe(2); // Nouvel appel Gemini car nouveau fingerprint
      expect(res3.count).toBe(4);
    });
  });
});
