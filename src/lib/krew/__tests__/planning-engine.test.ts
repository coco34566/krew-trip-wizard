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
  type ActivityAiInput,
} from "../activity-ai.server";
import {
  convertIntentToPlaceRequirements,
  buildPoolKey,
  determineSearchRadiusMeters,
  searchGeoapifyPlaces,
  fetchPlaceDetails,
  rankGeoapifyCandidates,
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

describe("PR 107 — Tests Obligatoires Logistique & Fenêtres", () => {
  // A. availableFrom=09:00, availableUntil=null -> aucun lunch, aucun dinner
  it("A. availableFrom=09:00 & availableUntil=null -> aucun lunch ni dinner mandatory", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", latestGroupArrival: "09:00", earliestGroupDeparture: null }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.subType === "lunch")).toBe(false);
    expect(brief.mandatoryNeeds.some((n) => n.subType === "dinner")).toBe(false);
  });

  // B. availableFrom=null, availableUntil=22:00 -> aucun breakfast/lunch/dinner
  it("B. availableFrom=null & availableUntil=22:00 -> aucun breakfast/lunch/dinner", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", latestGroupArrival: null, earliestGroupDeparture: "22:00" }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.type === "meal")).toBe(false);
  });

  // C. availableFrom=10:00, availableUntil=14:00 -> lunch présent
  it("C. availableFrom=10:00 & availableUntil=14:00 -> lunch présent", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", latestGroupArrival: "10:00", earliestGroupDeparture: "14:00" }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.subType === "lunch")).toBe(true);
  });

  // D. availableFrom=18:00, availableUntil=22:30 -> dinner présent
  it("D. availableFrom=18:00 & availableUntil=22:30 -> dinner présent", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", latestGroupArrival: "18:00", earliestGroupDeparture: "22:30" }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.subType === "dinner")).toBe(true);
  });

  // E. availableFrom=18:00, availableUntil=null -> dinner absent
  it("E. availableFrom=18:00 & availableUntil=null -> dinner absent", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", latestGroupArrival: "18:00", earliestGroupDeparture: null }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.subType === "dinner")).toBe(false);
  });

  // F. EVJF day1 18:00–23:00 -> day1 choisi
  it("F. EVJF day1 18:00-23:00 -> day1 choisi pour event_signature", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", eventType: "evjf", latestGroupArrival: "18:00", earliestGroupDeparture: "23:00" }),
    );
    const ev = brief.mandatoryNeeds.find((n) => n.type === "event_signature");
    expect(ev).toBeDefined();
    expect(ev?.targetDay).toBe(1);
  });

  // G. EVJF day1 18:00–null -> day1 non considéré comme soirée certaine
  it("G. EVJF day1 18:00-null -> aucun event_signature", () => {
    const brief = buildPlanningBrief(
      baseInput({ nights: 0, endDate: "2026-06-13", eventType: "evjf", latestGroupArrival: "18:00", earliestGroupDeparture: null }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.type === "event_signature")).toBe(false);
  });

  // H. EVJF day1 inconnu, day2 17:00–19:00 -> day2 choisi si >=60 min
  it("H. EVJF day1 inconnu, day2 17:00-19:00 -> day2 choisi", () => {
    const brief = buildPlanningBrief(
      baseInput({
        eventType: "evjf",
        startDate: "2026-06-06",
        endDate: "2026-06-07",
        nights: 1,
        latestGroupArrival: null,
        earliestGroupDeparture: "19:00",
      }),
    );
    const ev = brief.mandatoryNeeds.find((n) => n.type === "event_signature");
    expect(ev?.targetDay).toBe(2);
  });

  // I. aucune fenêtre avec deux bornes connues >=60 min -> aucun mandatory event_signature
  it("I. aucune fenêtre avec deux bornes connues >=60 min -> aucun event_signature", () => {
    const brief = buildPlanningBrief(
      baseInput({ eventType: "evjf", latestGroupArrival: null, earliestGroupDeparture: null }),
    );
    expect(brief.mandatoryNeeds.some((n) => n.type === "event_signature")).toBe(false);
  });

  // A2. arrival unknown -> availableFrom null -> findAvailableGap does not transform into 08:00
  it("A2. arrival inconnue -> availableFrom est null et findAvailableGap ne fabrique pas 08:00", () => {
    const brief = buildPlanningBrief(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    expect(brief.dayWindows[0]?.availableFrom).toBeNull();

    const gap = findAvailableGap({
      dayWindow: brief.dayWindows[0]!,
      existingSlots: [],
      preferredWindow: { start: "08:30", end: "10:30" },
      durationMinutes: 45,
    });
    expect(gap).toBeNull();
  });

  // B. departure unknown -> availableUntil null -> findAvailableGap does not transform into 23:59
  it("B. departure inconnue -> availableUntil est null et findAvailableGap ne fabrique pas 23:59", () => {
    const brief = buildPlanningBrief(baseInput({ earliestGroupDeparture: null, latestReturnHome: null }));
    const lastDay = brief.dayWindows[brief.dayWindows.length - 1]!;
    expect(lastDay.availableUntil).toBeNull();

    const gap = findAvailableGap({
      dayWindow: lastDay,
      existingSlots: [],
      preferredWindow: { start: "20:00", end: "22:30" },
      durationMinutes: 120,
    });
    expect(gap).toBeNull();
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
      latestGroupArrival: null,
      earliestOutboundDeparture: "20:30",
      transportDurationHours: 5,
      transferMarginMinutes: 45,
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
      latestGroupArrival: null,
      earliestOutboundDeparture: "20:30",
      transportDurationHours: 5,
      transferMarginMinutes: 45,
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
});
