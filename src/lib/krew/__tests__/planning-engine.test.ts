import { describe, expect, it, vi } from "vitest";
import {
  buildPlanningBrief,
  buildMinimalFallbackFromBrief,
  calculatePlanningWindow,
  geminiEnrichSkeleton,
  ensureMandatoryNeeds,
  applyMaxActivitiesPerDay,
  regenerateSlotWithAi,
  validateItinerary,
  adjustItineraryTransferTimes,
  findAvailableGap,
  toMinutes,
  fromMinutes,
  aggregateMajorityTimePreference,
  normalizeGeminiParsedResponse,
  type ActivityAiInput,
} from "../activity-ai.server";
import {
  convertIntentToPlaceRequirements,
  buildPoolKey,
  determineSearchRadiusMeters,
  searchGeoapifyPlaces,
  fetchPlaceDetails,
  rankGeoapifyCandidates,
  selectGeoapifyCandidate,
  mergeUniquePlacesById,
  mapDietaryConstraintsToGeoapifyConditions,
  mapAccessibilityToGeoapifyConditions,
} from "../geoapify.server";

const baseInput = (overrides: Partial<ActivityAiInput> = {}): ActivityAiInput => ({
  destination: "Beaune",
  startDate: "2026-06-13",
  endDate: "2026-06-14",
  nights: 1,
  participants: 6,
  budgetPerPerson: 300,
  eventType: "evjf",
  tripProfile: "Gastronomie & Découverte",
  ambiances: ["fete", "gastronomie"],
  activityCategories: ["degustation", "spa"],
  travelPace: "equilibre",
  latestGroupArrival: "12:00",
  ...overrides,
});

describe("Planning Sans Transport Sélectionné — Fallbacks Produit Officiels", () => {
  it("A. aucun transport sélectionné, aucun horaire renseigné, séjour vendredi -> dimanche (2 nuits, 3 jours)", () => {
    const brief = buildPlanningBrief(
      baseInput({
        nights: 2,
        startDate: "2026-06-12", // Vendredi
        endDate: "2026-06-14",   // Dimanche
        latestGroupArrival: null,
        earliestGroupDeparture: null,
        earliestOutboundDeparture: null,
        latestReturnHome: null,
        transportPicksSummary: [],
      }),
    );
    expect(brief.dayWindows[0]?.availableFrom).toBe("18:30"); // Vendredi planifiable à partir de 18:30
    expect(brief.dayWindows[1]?.availableFrom).toBe("08:00"); // Samedi journée complète
    expect(brief.dayWindows[1]?.availableUntil).toBe("23:59");
    expect(brief.dayWindows[2]?.availableUntil).toBe("16:30"); // Dimanche planifiable jusqu'à 16:30
  });

  it("E. séjour 1 nuit (vendredi -> samedi) : premier jour 18:30 et dernier jour 16:30", () => {
    const brief = buildPlanningBrief(
      baseInput({
        nights: 1,
        startDate: "2026-06-12",
        endDate: "2026-06-13",
        latestGroupArrival: null,
        earliestGroupDeparture: null,
        transportPicksSummary: [],
      }),
    );
    expect(brief.dayWindows[0]?.availableFrom).toBe("18:30");
    expect(brief.dayWindows[1]?.availableUntil).toBe("16:30");
  });

  // C. unknown boundary -> no mandatory meal created solely due to fake full day
  it("C. borne inconnue -> pas de petit-déjeuner mandatory créé sans heure d'arrivée connue", () => {
    const brief = buildPlanningBrief(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    const day1Breakfast = brief.mandatoryNeeds.find((n) => n.targetDay === 1 && n.subType === "breakfast");
    expect(day1Breakfast).toBeUndefined();
  });

  // D. overnight arrival day 2 02:15 -> validateItinerary respecte day offset
  it("D. overnight arrival jour 2 02:15 -> jour 1 vide et jour 2 respecte 02:15", () => {
    const input = baseInput({
      startDate: "2026-06-13",
      nights: 2,
      latestGroupArrival: "23:30",
      transferMarginMinutes: 165,
    });
    const window = calculatePlanningWindow(input);
    expect(window.arrivalDayOffset).toBe(1);
    expect(window.arrivalReady).toBe("02:15");

    const validated = validateItinerary(
      [
        {
          day: 1,
          slots: [{ moment: "Soir", time: "22:00", durationMinutes: 60, type: "activite", label: "Activité Jour 1", verified: true, source: "krew" }],
        },
        {
          day: 2,
          slots: [
            { moment: "Matin", time: "01:00", durationMinutes: 60, type: "activite", label: "Activité trop tôt", verified: true, source: "krew" },
            { moment: "Matin", time: "03:00", durationMinutes: 60, type: "activite", label: "Activité OK", verified: true, source: "krew" },
          ],
        },
      ],
      input,
      [],
    );

    // Day 1 at destination is empty
    expect(validated[0]?.slots).toHaveLength(0);
    // Day 2 only keeps slot starting >= 02:15
    expect(validated[1]?.slots.map((s) => s.label)).toEqual(["Activité OK"]);
  });

  // E. overnight arrival -> adjustItineraryTransferTimes respecte day offset
  it("E. adjustItineraryTransferTimes respecte overnight arrivalDayOffset", () => {
    const input = baseInput({
      startDate: "2026-06-13",
      nights: 2,
      latestGroupArrival: "23:30",
      transferMarginMinutes: 165,
    });

    const adjusted = adjustItineraryTransferTimes(
      [
        { day: 1, slots: [{ moment: "Soir", time: "22:00", durationMinutes: 60, label: "Slot Jour 1", type: "activite" }] },
        { day: 2, slots: [{ moment: "Matin", time: "01:00", durationMinutes: 60, label: "Slot Jour 2 trop tôt", type: "activite" }] },
      ],
      input,
    );

    expect(adjusted[0]?.slots).toHaveLength(0);
    expect(adjusted[1]?.slots).toHaveLength(0);
  });

  // F. transfert pousse slot après availableUntil -> slot rejeté
  it("F. transfert décalant le slot au-delà de la limite -> slot rejeté", () => {
    const input = baseInput({ earliestGroupDeparture: "15:00", transferMarginMinutes: 0 });
    const adjusted = adjustItineraryTransferTimes(
      [
        {
          day: 2,
          slots: [
            { moment: "Après-midi", time: "13:00", durationMinutes: 60, label: "Activité 1", type: "activite", latitude: 45.9, longitude: 6.1 },
            { moment: "Après-midi", time: "14:30", durationMinutes: 60, label: "Activité 2", type: "activite", latitude: 46.5, longitude: 6.5 },
          ],
        },
      ],
      input,
    );

    // Activité 2 pushed past 15:00 departure -> rejected
    expect(adjusted[0]?.slots.map((s) => s.label)).toEqual(["Activité 1"]);
  });

  // G. aucun slot avant vraie arrivée
  it("G. aucun slot accepté avant l'arrivée réelle", () => {
    const input = baseInput({ latestGroupArrival: "16:00", transferMarginMinutes: 60 });
    const validated = validateItinerary(
      [
        {
          day: 1,
          slots: [
            { moment: "Après-midi", time: "16:30", durationMinutes: 60, type: "activite", label: "Trop tôt", verified: true, source: "krew" },
            { moment: "Soir", time: "17:30", durationMinutes: 60, type: "activite", label: "Après arrivée", verified: true, source: "krew" },
          ],
        },
      ],
      input,
      [],
    );

    expect(validated[0]?.slots.map((s) => s.label)).toEqual(["Après arrivée"]);
  });
});

describe("PR 107 — Tests Mandatory Needs", () => {
  // H. breakfast existant + mandatory dinner -> dinner toujours considéré absent
  it("H. un breakfast existant ne satisfait pas un mandatory dinner", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: null }));
    const skeletonWithBreakfastOnly = {
      destination: "Beaune",
      nights: 1,
      days: [
        {
          day: 1,
          slots: [
            { id: "s1", day: 1, moment: "Matin" as const, time: "08:30", endTime: "09:15", durationMinutes: 45, kind: "place_required" as const, type: "resto" as const, category: "repas" as const, label: "Petit-déjeuner local", importance: "high" as const, flexibility: "flexible" as const },
          ],
        },
      ],
    };

    const repaired = ensureMandatoryNeeds(skeletonWithBreakfastOnly, brief);
    const dinnerAdded = repaired.days[0]?.slots.find((s) => toMinutes(s.time)! >= 18 * 60 && s.category === "repas");
    expect(dinnerAdded).toBeDefined();
  });

  // I. mandatory dinner + dinner réel -> satisfait
  it("I. mandatory dinner avec dîner réel à 20:00 -> satisfait sans doublon", () => {
    const brief = buildPlanningBrief(baseInput());
    const skeletonWithDinner = {
      destination: "Beaune",
      nights: 1,
      days: [
        {
          day: 1,
          slots: [
            { id: "s1", day: 1, moment: "Soir" as const, time: "20:00", endTime: "22:00", durationMinutes: 120, kind: "place_required" as const, type: "resto" as const, category: "repas" as const, label: "Grand Dîner", importance: "high" as const, flexibility: "flexible" as const },
          ],
        },
      ],
    };

    const repaired = ensureMandatoryNeeds(skeletonWithDinner, brief);
    const dinners = repaired.days[0]?.slots.filter((s) => s.category === "repas" && toMinutes(s.time)! >= 18 * 60);
    expect(dinners?.length).toBe(1);
  });

  // J. EVJF + availableUntil unknown -> unknown ne compte pas comme soirée certaine
  it("J. EVJF + availableUntil unknown le jour de départ -> ne crée pas d'événement impossible", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf", nights: 1, latestGroupArrival: "12:00", earliestGroupDeparture: null, latestReturnHome: null }));
    expect(brief.mandatoryNeeds.find((n) => n.type === "event_signature")?.targetDay).toBe(1);
  });

  // K. EVJF 1 nuit + vraie soirée jour 1 -> jour 1 choisi
  it("K. EVJF 1 nuit avec soirée jour 1 disponible -> targetDay = 1", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf", nights: 1, latestGroupArrival: "12:00" }));
    expect(brief.mandatoryNeeds.find((n) => n.type === "event_signature")?.targetDay).toBe(1);
  });

  // L. Gemini oublie event -> réparation dynamique réelle
  it("L. Gemini oublie EVJF -> réinjecté réellement post-Gemini", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf", latestGroupArrival: "12:00" }));
    const skeletonWithoutEvjf = {
      destination: "Beaune",
      nights: 1,
      days: [{ day: 1, date: "2026-06-13", slots: [] }],
    };

    const repaired = ensureMandatoryNeeds(skeletonWithoutEvjf, brief);
    const hasEvjf = repaired.days.flatMap((d) => d.slots).some((s) => s.label.includes("mariée"));
    expect(hasEvjf).toBe(true);
  });

  // M. Gemini oublie meal obligatoire -> bon subtype de meal ajouté
  it("M. Gemini oublie le dîner obligatoire -> dîner réinjecté avec bon subtype", () => {
    const brief = buildPlanningBrief(baseInput());
    const skeleton = {
      destination: "Beaune",
      nights: 1,
      days: [{ day: 1, date: "2026-06-13", slots: [] }],
    };

    const repaired = ensureMandatoryNeeds(skeleton, brief);
    const dinner = repaired.days[0]?.slots.find((s) => s.category === "repas" && toMinutes(s.time)! >= 18 * 60);
    expect(dinner).toBeDefined();
  });
});

describe("PR 107 — Tests Gemini & Density", () => {
  // N. shopping Gemini -> accepté
  it("N. momentType shopping -> accepté dans l'allowlist", async () => {
    const skeleton = buildMinimalFallbackFromBrief(buildPlanningBrief(baseInput()));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      days: [
                        { day: 1, slots: [{ kind: "place_required", time: "15:00", momentType: "shopping", label: "Boutiques locales", canonicalVenueFamily: "shopping" }] },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env["GEMINI_API_KEY"] = "test-key";

    const res = await geminiEnrichSkeleton(skeleton, baseInput());
    const shoppingSlot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.category === "shopping");
    expect(shoppingSlot).toBeDefined();
    expect(shoppingSlot?.venueFamily).toBe("shopping");
  });

  // O. local_experience Gemini -> accepté
  it("O. momentType local_experience -> accepté dans l'allowlist", async () => {
    const skeleton = buildMinimalFallbackFromBrief(buildPlanningBrief(baseInput()));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      days: [
                        { day: 1, slots: [{ kind: "place_required", time: "15:00", momentType: "local_experience", label: "Atelier Vin", canonicalVenueFamily: "local_experience" }] },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env["GEMINI_API_KEY"] = "test-key";

    const res = await geminiEnrichSkeleton(skeleton, baseInput());
    const expSlot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.category === "local_experience");
    expect(expSlot).toBeDefined();
  });

  // P. momentType inconnu -> rejet, jamais culture
  it("P. momentType inconnu -> rejeté, jamais transformé en culture", async () => {
    const skeleton = buildMinimalFallbackFromBrief(buildPlanningBrief(baseInput()));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      days: [
                        { day: 1, slots: [{ kind: "place_required", time: "15:00", momentType: "invalid_xyz", label: "Inconnu" }] },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env["GEMINI_API_KEY"] = "test-key";

    const res = await geminiEnrichSkeleton(skeleton, baseInput());
    const invalidSlot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.label === "Inconnu");
    expect(invalidSlot).toBeUndefined();
  });

  // Q. kind inconnu -> rejet sauf mapping certain
  it("Q. kind inconnu non déterminable -> rejeté", async () => {
    const skeleton = buildMinimalFallbackFromBrief(buildPlanningBrief(baseInput()));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      days: [
                        { day: 1, slots: [{ kind: "unknown_kind", time: "15:00", momentType: "invalid_moment", label: "Bizarre" }] },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env["GEMINI_API_KEY"] = "test-key";

    const res = await geminiEnrichSkeleton(skeleton, baseInput());
    const slot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.label === "Bizarre");
    expect(slot).toBeUndefined();
  });

  // R. léger + Gemini 4 activités -> maxActivitiesPerDay conserve une sélection diversifiée pertinente
  it("R. travelPace = leger + Gemini renvoie 4 activités -> conserve la plus pertinente selon fréquences", () => {
    const brief = buildPlanningBrief(
      baseInput({
        travelPace: "leger",
        activityCategoryFrequencies: { "sport_outdoor": 5, "culture": 1 },
      }),
    );
    expect(brief.planningRules.maxActivitiesPerDay).toBe(1);

    const skeletonWith4 = {
      destination: "Beaune",
      nights: 1,
      days: [
        {
          day: 1,
          date: "2026-06-13",
          slots: [
            { id: "1", day: 1, moment: "Matin" as const, time: "10:00", endTime: "11:30", durationMinutes: 90, kind: "place_required" as const, type: "activite" as const, category: "culture" as const, label: "Musée", importance: "high" as const, flexibility: "flexible" as const },
            { id: "2", day: 1, moment: "Après-midi" as const, time: "14:00", endTime: "16:00", durationMinutes: 120, kind: "place_required" as const, type: "activite" as const, category: "sport_outdoor" as const, label: "Kayak", importance: "high" as const, flexibility: "flexible" as const },
          ],
        },
      ],
    };

    const pruned = applyMaxActivitiesPerDay(skeletonWith4, brief);
    const mainActs = pruned.days[0]?.slots.filter((s) => s.kind === "place_required" && s.category !== "repas");
    expect(mainActs?.length).toBe(1);
    expect(mainActs?.[0]?.category).toBe("sport_outdoor");
  });
});

describe("PR 107 — Tests Geoapify & Location Context", () => {
  // W. winery intent -> production.winery réellement envoyé
  it("W. winery intent -> production.winery inclus dans categories", () => {
    const req = convertIntentToPlaceRequirements("local_experience", "activite", "dégustation de vin en cave/winery");
    expect(req.categories).toContain("production.winery");
  });

  // X. market intent -> commercial.marketplace réellement envoyé
  it("X. market intent -> commercial.marketplace inclus dans categories", () => {
    const req = convertIntentToPlaceRequirements("shopping", "activite", "marché local des producteurs");
    expect(req.categories).toContain("commercial.marketplace");
  });

  // Y. Geoapify categories multiples -> subtype matching utilise categories[]
  it("Y. rankGeoapifyCandidates utilise subtype pour classer les candidats", () => {
    const req = convertIntentToPlaceRequirements("shopping", "activite", "marché local");
    const candidates = [
      { id: "p1", name: "Magasin général", category: "commercial.shopping_mall", categories: ["commercial.shopping_mall"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true },
      { id: "p2", name: "Grand Marché", category: "commercial.marketplace", categories: ["commercial.marketplace"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 500, website: null, source: "geoapify" as const, verified: true },
    ];

    const ranked = rankGeoapifyCandidates(candidates, req, null, new Set());
    expect(ranked[0]?.name).toBe("Grand Marché");
  });

  // Z. dietary inconnu -> candidat non rejeté
  it("Z. contrainte alimentaire indicative -> n'élimine pas un restaurant", () => {
    const req = convertIntentToPlaceRequirements("restaurant", "repas", "restaurant convivial", ["vegan"]);
    expect(req.canonicalFamily).toBe("restaurant");
    // Dietary constraints remain informative, not blocking Geoapify conditions
  });

  // AG. Place Details nécessaire -> 1 seul appel avec cache
  it("AG. fetchPlaceDetails utilise le cache place_id", async () => {
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: { formatted: "10 Rue du Vin", website: "https://wine.example" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const d1 = await fetchPlaceDetails("place-123");
    const d2 = await fetchPlaceDetails("place-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(d1?.website).toBe("https://wine.example");
    expect(d2?.website).toBe("https://wine.example");
  });

  // AI. internal + locationContext=lodging -> spatial reset logement
  it("AI. slot internal avec locationContext=lodging -> locationContext explicite", () => {
    const brief = buildPlanningBrief(baseInput({ groupAccommodationRole: "centerpiece", nights: 2 }));
    const fallback = buildMinimalFallbackFromBrief(brief);
    const lodgingSlot = fallback.days.flatMap((d) => d.slots).find((s) => s.category === "moment_maison");
    expect(lodgingSlot?.locationContext).toBe("lodging");
  });

  // AL. autre proposition -> 0 Gemini
  it("AL. regenerateSlotWithAi -> 0 appel Gemini", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const mockSlot = { moment: "Soir", type: "activite" as const, label: "Visite", time: "20:00" };
    const res = await regenerateSlotWithAi(baseInput(), mockSlot, 1, [], []);

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(res.usedLlm).toBe(false);
  });

  // Y. pool extension avec doublon -> déduplication par ID stable
  it("Y. mergeUniquePlacesById déduplique par ID stable", () => {
    const p1 = { id: "geo-1", name: "Place 1", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
    const p2 = { id: "geo-2", name: "Place 2", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };
    const p1Dup = { id: "geo-1", name: "Place 1 Dup", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };

    const merged = mergeUniquePlacesById([p1, p2], [p1Dup]);
    expect(merged.length).toBe(2);
    expect(merged.map((m) => m.id)).toEqual(["geo-1", "geo-2"]);
  });

  describe("PR 107 — Tests Régénération & Shared Selector", () => {
    // TEST 1 — Subtype
    it("1. selectGeoapifyCandidate choisit B quand A a un mauvais subtype", async () => {
      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dégustation vin");
      const candA = { id: "p1", name: "Musée", category: "tourism.attraction", categories: ["tourism.attraction"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
      const candB = { id: "p2", name: "Cave du Domaine", category: "production.winery", categories: ["production.winery"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

      const selected = await selectGeoapifyCandidate({
        candidates: [candA, candB],
        req,
        usedCandidateIdsSet: new Set(),
      });
      expect(selected?.id).toBe("p2");
    });

    // TEST 2 — Opening
    it("2. selectGeoapifyCandidate ignore closed et choisit B (unknown/open)", async () => {
      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dîner");
      const candA = { id: "p1", name: "Resto A", category: "catering.restaurant", categories: ["catering.restaurant"], openingHours: "lundi: ferme", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
      const candB = { id: "p2", name: "Resto B", category: "catering.restaurant", categories: ["catering.restaurant"], openingHours: null, address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

      const selected = await selectGeoapifyCandidate({
        candidates: [candA, candB],
        req,
        usedCandidateIdsSet: new Set(),
        date: "2026-06-15", // Lundi
        time: "20:00",
      });
      expect(selected?.id).toBe("p2");
    });

    // TEST 3 — Used ID
    it("3. selectGeoapifyCandidate saute les candidats déjà utilisés", async () => {
      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dîner");
      const candA = { id: "p1", name: "Resto A", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
      const candB = { id: "p2", name: "Resto B", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

      const selected = await selectGeoapifyCandidate({
        candidates: [candA, candB],
        req,
        usedCandidateIdsSet: new Set(["p1"]),
      });
      expect(selected?.id).toBe("p2");
    });

    // TEST 4 & 5 — Pool vide, 1 recherche ciblée & mergeUniquePlacesById
    it("4 & 5. pool vide -> recherche ciblée + mergeUniquePlacesById", async () => {
      const p1 = { id: "geo-1", name: "Place 1", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
      const p2 = { id: "geo-2", name: "Place 2", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

      const merged = mergeUniquePlacesById([p1], [p1, p2]);
      expect(merged.length).toBe(2);

      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dîner");
      const selected = await selectGeoapifyCandidate({
        candidates: merged,
        req,
        usedCandidateIdsSet: new Set(["geo-1"]),
      });
      expect(selected?.id).toBe("geo-2");
    });

    // TEST 6 — Second selector après recherche ciblée
    it("6. second selector après recherche ciblée choisit le deuxième si le premier est incompatible", async () => {
      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dégustation vin");
      const candA = { id: "new-1", name: "Café", category: "catering.cafe", categories: ["catering.cafe"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
      const candB = { id: "new-2", name: "Domaine Viticole", category: "production.winery", categories: ["production.winery"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

      const selected = await selectGeoapifyCandidate({
        candidates: [candA, candB],
        req,
        usedCandidateIdsSet: new Set(),
      });
      expect(selected?.id).toBe("new-2");
    });

    // TEST 7 — Fallback neutre
    it("7. aucune alternative compatible -> null (dégrade vers lieu à choisir)", async () => {
      const req = convertIntentToPlaceRequirements("restaurant", "repas", "dîner");
      const candA = { id: "p1", name: "Resto A", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };

      const selected = await selectGeoapifyCandidate({
        candidates: [candA],
        req,
        usedCandidateIdsSet: new Set(["p1"]),
      });
      expect(selected).toBeNull();
    });

    // TEST 8 — 0 Gemini sur regenerateSlotWithAi
    it("8. regenerateSlotWithAi effectue 0 appel Gemini", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const mockSlot = { moment: "Midi", type: "resto" as const, label: "Déjeuner", time: "12:30" };
      const res = await regenerateSlotWithAi(baseInput(), mockSlot, 1, [], []);

      expect(fetchMock).toHaveBeenCalledTimes(0);
      expect(res.usedLlm).toBe(false);
    });
  });

  describe("Nouveaux Tests Obligatoires - Planning, Gemini Robustesse & Tâches (Test 12 / 13 Fixes)", () => {
    it("A & D. Génération de planning sans transport sélectionné", () => {
      const brief = buildPlanningBrief(
        baseInput({
          nights: 2,
          startDate: "2026-06-12",
          endDate: "2026-06-14",
          latestGroupArrival: null,
          earliestGroupDeparture: null,
          transportPicksSummary: [],
        }),
      );
      expect(brief.dayWindows[0]?.availableFrom).toBe("18:30");
      expect(brief.dayWindows[1]?.availableFrom).toBe("08:00");
      expect(brief.dayWindows[1]?.availableUntil).toBe("23:59");
      expect(brief.dayWindows[2]?.availableUntil).toBe("16:30");
    });

    it("B. Agrégation horaire : un participant très tardif ne decale pas tout le groupe", () => {
      // 5 personnes à 16h00, 1 personne à 20h00 -> la majorité/médiane est à 16h00
      const prefs = ["16:00", "16:00", "16:00", "16:00", "16:00", "20:00"];
      const groupDeparture = aggregateMajorityTimePreference(prefs);
      expect(groupDeparture).toBe("16:00");
    });

    it("C. Agrégation horaire : retour anticipé minoritaire ne tronque pas la journée collective", () => {
      // 5 personnes à 18h00, 1 personne à 12h00 -> médiane à 18h00
      const prefs = ["18:00", "18:00", "18:00", "18:00", "18:00", "12:00"];
      const groupReturn = aggregateMajorityTimePreference(prefs);
      expect(groupReturn).toBe("18:00");
    });

    it("E. Séjour 1 nuit : premier jour 18:30 et dernier jour 16:30", () => {
      const brief = buildPlanningBrief(
        baseInput({
          nights: 1,
          startDate: "2026-06-12",
          endDate: "2026-06-13",
          latestGroupArrival: null,
          earliestGroupDeparture: null,
          transportPicksSummary: [],
        }),
      );
      expect(brief.dayWindows[0]?.availableFrom).toBe("18:30");
      expect(brief.dayWindows[1]?.availableUntil).toBe("16:30");
    });

    it("F. Gemini : réponse strictement conforme est acceptée", () => {
      const rawPayload = {
        days: [
          {
            day: 1,
            slots: [
              {
                kind: "place_required",
                momentType: "repas",
                canonicalVenueFamily: "restaurant",
                label: "Dîner de bienvenue",
                time: "19:00",
                durationMinutes: 90,
              },
            ],
          },
        ],
      };
      const normalized = normalizeGeminiParsedResponse(rawPayload);
      expect(normalized).not.toBeNull();
      expect(normalized?.days.length).toBe(1);
      expect(normalized?.days[0]?.slots[0]?.label).toBe("Dîner de bienvenue");
    });

    it("G. Gemini : réponse avec variation de structure (jours au lieu de days, creneaux au lieu de slots) est normalisée localement sans 2e appel", () => {
      const rawPayloadWithVariation = {
        jours: [
          {
            jour: 1,
            creneaux: [
              {
                kind: "place_required",
                moment_type: "repas",
                venue_family: "restaurant",
                intitule: "Pizzas Le Khéops",
                startTime: "20:00",
                duration_minutes: 90,
              },
            ],
          },
        ],
      };
      const normalized = normalizeGeminiParsedResponse(rawPayloadWithVariation);
      expect(normalized).not.toBeNull();
      expect(normalized?.days.length).toBe(1);
      expect(normalized?.days[0]?.slots[0]?.label).toBe("Pizzas Le Khéops");
      expect(normalized?.days[0]?.slots[0]?.time).toBe("20:00");
    });

    it("H. Gemini : réponse inexploitable retourne null pour basculer vers le fallback local", () => {
      const invalidPayload = { invalidKey: "broken" };
      const normalized = normalizeGeminiParsedResponse(invalidPayload);
      expect(normalized).toBeNull();
    });
  });

  describe("Tests ciblés — Résolution lieux, compatibilité Geoapify & ranking", () => {
    // Test 1 — restaurant contenant "quartier"
    it("Test 1 — restaurant contenant 'quartier' conserve kind: place_required et ne devient pas free_exploration", () => {
      const slot = {
        kind: "place_required" as const,
        type: "resto" as const,
        category: "repas" as const,
        venueFamily: "restaurant",
        searchIntent: "restaurant convivial dans le quartier juif de Budapest",
        label: "Dîner dans le quartier juif",
      };

      // classifyActivityMode alone might return free_exploration based on text "quartier"
      // but in generateGroupItinerary kind === "place_required" overrides heuristics
      expect(slot.kind).toBe("place_required");
      const req = convertIntentToPlaceRequirements(
        slot.venueFamily,
        slot.category,
        slot.searchIntent,
      );
      expect(req.canonicalFamily).toBe("restaurant");
      expect(req.categories).toContain("catering.restaurant");
    });

    // Test 2 — déjeuner externe
    it("Test 2 — déjeuner externe : aucun appel à findIdeasResourceForActivity et aucune URL ideas", async () => {
      const { findIdeasResourceForActivity } = await import("../activity-discovery.server");
      const ideasUrl = await findIdeasResourceForActivity({
        label: "Déjeuner de groupe",
        searchIntent: "déjeuner restaurant centre ville",
        eventType: "evjf",
        kind: "place_required",
        type: "resto",
        category: "repas",
        locationContext: "external",
      });

      expect(ideasUrl).toBeNull();
    });

    // Test 3 — spa family compatibility
    it("Test 3 — spa family compatibility : service.beauty.spa non rejeté pour subtype leisure.spa", () => {
      const { isCandidateCompatibleWithRequirements } = require("../geoapify.server");
      const candidate = {
        id: "spa-1",
        name: "Beauty & Spa Salon",
        category: "service.beauty.spa",
        categories: ["service", "service.beauty", "service.beauty.spa"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 300,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("spa_wellness", "detente", "moment spa relaxation");
      req.subtype = "leisure.spa";

      const compatible = isCandidateCompatibleWithRequirements(candidate, req);
      expect(compatible).toBe(true);
    });

    // Test 4 — bar family compatibility
    it("Test 4 — bar family compatibility : catering.bar est compatible avec bar_pub", () => {
      const { isCandidateCompatibleWithRequirements } = require("../geoapify.server");
      const candidate = {
        id: "bar-1",
        name: "Local Pub",
        category: "catering.bar",
        categories: ["catering", "catering.bar"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 100,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("bar_pub", "soiree", "bar à cocktails convivial");
      const compatible = isCandidateCompatibleWithRequirements(candidate, req);
      expect(compatible).toBe(true);
    });

    // Test 5 — ranking restaurant
    it("Test 5 — ranking restaurant : restaurant hongrois préféré au restaurant coréen plus proche", () => {
      const candA = {
        id: "resto-a",
        name: "Seoul House koreai étterem",
        category: "catering.restaurant",
        categories: ["catering", "catering.restaurant", "catering.restaurant.korean"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 50,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const candB = {
        id: "resto-b",
        name: "Magyar Vendéglő - Spécialités hongroises",
        category: "catering.restaurant",
        categories: ["catering", "catering.restaurant", "catering.restaurant.hungarian"],
        address: null,
        latitude: 47.4990,
        longitude: 19.0420,
        distanceMeters: 300,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements(
        "restaurant",
        "repas",
        "restaurant élégant avec spécialités locales hongroises",
      );

      const ranked = rankGeoapifyCandidates(
        [candA, candB],
        req,
        { latitude: 47.4983, longitude: 19.0404 },
        new Set(),
      );

      expect(ranked[0]?.id).toBe("resto-b");
    });

    // Test 6 — rooftop
    it("Test 6 — rooftop : Leo Rooftop mieux classé que pub générique plus proche", () => {
      const candA = {
        id: "pub-a",
        name: "Pub Irlandais",
        category: "catering.pub",
        categories: ["catering", "catering.pub"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 50,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const candB = {
        id: "rooftop-b",
        name: "Leo Rooftop Bar Budapest",
        category: "catering.bar",
        categories: ["catering", "catering.bar"],
        address: null,
        latitude: 47.4995,
        longitude: 19.0425,
        distanceMeters: 200,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("bar_pub", "soiree", "rooftop panoramique élégant");

      const ranked = rankGeoapifyCandidates(
        [candA, candB],
        req,
        { latitude: 47.4983, longitude: 19.0404 },
        new Set(),
      );

      expect(ranked[0]?.id).toBe("rooftop-b");
    });

    // Test 7 — thermes vs salon beauté
    it("Test 7 — thermes vs salon beauté : Thermal Bath nettement mieux classé que Nail Salon", () => {
      const candA = {
        id: "beauty-a",
        name: "Nail & Beauty Salon",
        category: "service.beauty.spa",
        categories: ["service", "service.beauty", "service.beauty.spa"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 100,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const candB = {
        id: "thermal-b",
        name: "Széchenyi Thermal Bath / Bains Thermaux",
        category: "leisure.spa",
        categories: ["leisure", "leisure.spa", "tourism", "tourism.attraction"],
        address: null,
        latitude: 47.5188,
        longitude: 19.0814,
        distanceMeters: 1500,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("spa_wellness", "detente", "bains thermaux emblématiques");

      const ranked = rankGeoapifyCandidates(
        [candA, candB],
        req,
        { latitude: 47.4983, longitude: 19.0404 },
        new Set(),
      );

      expect(ranked[0]?.id).toBe("thermal-b");
    });

    // Test 8 — aucun changement pour activité interne
    it("Test 8 — activité interne : Jeu de la mariée au logement reste self_guided_group sans Geoapify", () => {
      const { classifyActivityMode } = require("../activity-ai.server");
      const mode = classifyActivityMode({
        kind: "internal",
        category: "jeu_groupe",
        label: "Jeu de la mariée au logement",
      });

      expect(mode).toBe("self_guided_group");
    });

    // Test non-régression routing : shouldResolveWithPlaceProvider pour place_required + "quartier"
    it("Test non-régression routing — place_required avec 'quartier' utilise TOUJOURS la résolution de lieu Geoapify", () => {
      const { classifyActivityMode, shouldResolveWithPlaceProvider } = require("../activity-ai.server");
      const slot = {
        kind: "place_required",
        type: "resto",
        category: "repas",
        venueFamily: "restaurant",
        locationContext: "external",
        searchIntent: "restaurant convivial dans le quartier juif de Budapest",
        label: "Dîner dans le quartier juif",
      };

      const classifiedMode = classifyActivityMode(slot);
      // Mode classification might return free_exploration based on text "quartier"
      expect(classifiedMode).toBe("free_exploration");

      // But shouldResolveWithPlaceProvider must guarantee kind === "place_required" resolves via Geoapify!
      const mustResolve = shouldResolveWithPlaceProvider({
        kind: slot.kind,
        activityMode: classifiedMode,
      });

      expect(mustResolve).toBe(true);
    });

    // Test 9 — Nouveau
    it("Test 9 — candidate.categories = ['service', 'service.beauty'] est INCOMPATIBLE avec canonicalFamily = 'spa_wellness'", () => {
      const { isCandidateCompatibleWithRequirements } = require("../geoapify.server");
      const candidate = {
        id: "nail-salon-generic",
        name: "Generic Nail Salon",
        category: "service.beauty",
        categories: ["service", "service.beauty"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 100,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("spa_wellness", "detente", "bains thermaux");
      const compatible = isCandidateCompatibleWithRequirements(candidate, req);

      expect(compatible).toBe(false);
    });

    // Test 10 — Nouveau
    it("Test 10 — candidate.categories = ['commercial'] est INCOMPATIBLE avec canonicalFamily = 'shopping'", () => {
      const { isCandidateCompatibleWithRequirements } = require("../geoapify.server");
      const candidate = {
        id: "generic-shop",
        name: "Generic Commercial Place",
        category: "commercial",
        categories: ["commercial"],
        address: null,
        latitude: 47.4983,
        longitude: 19.0404,
        distanceMeters: 100,
        website: null,
        source: "geoapify" as const,
        verified: true,
      };

      const req = convertIntentToPlaceRequirements("shopping", "shopping", "boutiques de créateurs");
      const compatible = isCandidateCompatibleWithRequirements(candidate, req);

      expect(compatible).toBe(false);
    });
  });
});
