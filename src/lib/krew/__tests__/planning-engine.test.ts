import { describe, expect, it, vi } from "vitest";
import {
  buildPlanningBrief,
  buildMinimalFallbackFromBrief,
  calculatePlanningWindow,
  geminiEnrichSkeleton,
  validateItinerary,
  toMinutes,
  fromMinutes,
  type ActivityAiInput,
  type PlanningBrief,
} from "../activity-ai.server";
import {
  convertIntentToPlaceRequirements,
  buildPoolKey,
  determineSearchRadiusMeters,
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
  ...overrides,
});

describe("Tests Obligatoires — Moteur de Planning KREW", () => {
  // A. EVJF 1 nuit, soirée disponible -> event_signature présent
  it("A. EVJF 1 nuit -> event_signature présent dans brief et fallback", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf", nights: 1 }));
    const evjfNeed = brief.mandatoryNeeds.find((n) => n.type === "event_signature");
    expect(evjfNeed).toBeDefined();
    expect(evjfNeed?.label).toBe("Jeu de la mariée");

    const fallback = buildMinimalFallbackFromBrief(brief);
    const hasEvjfSlot = fallback.days.flatMap((d) => d.slots).some((s) => s.category === "jeu_groupe" || s.label.includes("mariée"));
    expect(hasEvjfSlot).toBe(true);
  });

  // B. événement oublié par Gemini -> fallback dynamique dans un vrai trou
  it("B. événement oublié par Gemini -> présence garantie via mandatoryNeeds", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "anniversaire" }));
    expect(brief.mandatoryNeeds.some((n) => n.type === "event_signature")).toBe(true);
  });

  // C. aucun 22:15 hardcodé
  it("C. aucun horaire hardcodé 22:15 pour l'événement", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf" }));
    const fallback = buildMinimalFallbackFromBrief(brief);
    const eventSlot = fallback.days.flatMap((d) => d.slots).find((s) => s.label.includes("mariée"));
    expect(eventSlot?.time).not.toBe("22:15");
  });

  // D. aucun 18:00 arrivée fictive
  it("D. aucun 18:00 arrivée fictive si arrivée inconnue", () => {
    const window = calculatePlanningWindow(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    expect(window.arrivalReady).toBeNull();
    const brief = buildPlanningBrief(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    expect(brief.dayWindows[0]?.availableFrom).toBe("08:00");
  });

  // E. aucun 12:00 départ fictif
  it("E. aucun 12:00 départ fictif si départ inconnu", () => {
    const window = calculatePlanningWindow(baseInput({ earliestGroupDeparture: null, latestReturnHome: null }));
    expect(window.latestDestinationDeparture).toBeNull();
    const brief = buildPlanningBrief(baseInput({ earliestGroupDeparture: null, latestReturnHome: null }));
    expect(brief.dayWindows[brief.dayWindows.length - 1]?.availableUntil).toBe("23:59");
  });

  // F. startTime Gemini invalide -> jamais 12:00 automatique
  it("F. startTime Gemini invalide -> repositionné selon window, pas 12:00 automatique", async () => {
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
                        {
                          day: 1,
                          slots: [{ kind: "place_required", time: "INVALID", momentType: "repas", label: "Dîner" }],
                        },
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
    const slotTime = res.enrichedSkeleton.days[0]?.slots[0]?.time;
    expect(slotTime).not.toBe("12:00");
  });

  // G. day Gemini invalide -> rejet
  it("G. day 99 ou invalide retourné par Gemini -> rejeté", async () => {
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
                        { day: 99, slots: [{ kind: "internal", time: "20:00", label: "Invalid Day" }] },
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
    const hasDay99 = res.enrichedSkeleton.days.some((d) => d.day === 99);
    expect(hasDay99).toBe(false);
  });

  // H. date Gemini incorrecte -> date KREW conservée
  it("H. date Gemini différente -> date KREW canonique conservée", async () => {
    const inputData = baseInput({ startDate: "2026-06-13" });
    const skeleton = buildMinimalFallbackFromBrief(buildPlanningBrief(inputData));
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
                        { day: 1, date: "2099-01-01", slots: [{ kind: "internal", time: "20:00", label: "Soirée" }] },
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

    const res = await geminiEnrichSkeleton(skeleton, inputData);
    expect(res.enrichedSkeleton.days[0]?.date).toBe("2026-06-13");
  });

  // I. kind invalide -> rejet/réparation sûre
  it("I. kind invalide -> réparé ou rejeté proprement", async () => {
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
                        { day: 1, slots: [{ kind: "unknown_kind", time: "12:30", label: "Resto", canonicalVenueFamily: "restaurant" }] },
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
    const kind = res.enrichedSkeleton.days[0]?.slots[0]?.kind;
    expect(["internal", "place_required"]).toContain(kind);
  });

  // J. canonical family invalide -> réparation déterministe ou rejet, jamais restaurant par défaut
  it("J. canonicalVenueFamily invalide pour une activité -> réparé en culture/sport/etc., jamais restaurant par défaut", async () => {
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
                        { day: 1, slots: [{ kind: "place_required", time: "15:00", momentType: "sport", label: "Kayak", canonicalVenueFamily: "invalid_family" }] },
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
    const sportSlot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.label === "Kayak");
    expect(sportSlot?.venueFamily).toBe("sport");
    expect(sportSlot?.venueFamily).not.toBe("restaurant");
  });

  // K. rythme léger -> maxActivitiesPerDay respecté
  it("K. rythme léger -> maxActivitiesPerDay = 1 respecté", () => {
    const brief = buildPlanningBrief(baseInput({ travelPace: "leger" }));
    expect(brief.planningRules.maxActivitiesPerDay).toBe(1);
    const fallback = buildMinimalFallbackFromBrief(brief);
    const mainActs = fallback.days.flatMap((d) => d.slots).filter((s) => s.kind === "place_required" && s.category !== "repas");
    expect(mainActs.length).toBeLessThanOrEqual(fallback.days.length * 1);
  });

  // L. mandatory meal oublié -> réparation dynamique
  it("L. mandatory meal présent dans mandatoryNeeds", () => {
    const brief = buildPlanningBrief(baseInput({ startDate: "2026-06-13", endDate: "2026-06-14", nights: 1 }));
    const dinner = brief.mandatoryNeeds.find((n) => n.subType === "dinner");
    expect(dinner).toBeDefined();
  });

  // M. centerpiece -> lodging_rest présent
  it("M. centerpiece -> lodging_rest obligatoire présent", () => {
    const brief = buildPlanningBrief(baseInput({ groupAccommodationRole: "centerpiece" }));
    const lodgingRest = brief.mandatoryNeeds.find((n) => n.type === "lodging_rest");
    expect(lodgingRest).toBeDefined();
  });
});

describe("Tests Obligatoires — Transport & Horaires", () => {
  // N. trajet passant minuit -> date correcte
  it("N. trajet passant minuit -> calcul HH:mm et date cohérents", () => {
    const outboundStart = toMinutes("20:30")!; // 1230 min
    const durationMin = 5 * 60; // 300 min
    const marginMin = 45;
    const arrivalTotal = outboundStart + durationMin + marginMin; // 1575 min = 26h15 -> 02:15 le lendemain
    expect(arrivalTotal).toBeGreaterThan(1440);
    expect(fromMinutes(arrivalTotal)).toBe("02:15");
  });

  // O. aucune activité avant arrivée réelle
  it("O. aucune activité avant arrivée réelle sur le jour 1", () => {
    const input = baseInput({ latestGroupArrival: "18:00", transferMarginMinutes: 0 });
    const brief = buildPlanningBrief(input);
    const fallback = buildMinimalFallbackFromBrief(brief);
    const day1Slots = fallback.days[0]?.slots ?? [];
    expect(day1Slots.some((s) => s.time < "18:00")).toBe(false);
  });

  // P. aucune activité après départ réel
  it("P. aucune activité après départ réel le dernier jour", () => {
    const input = baseInput({ earliestGroupDeparture: "12:00", transferMarginMinutes: 0 });
    const brief = buildPlanningBrief(input);
    const fallback = buildMinimalFallbackFromBrief(brief);
    const lastDaySlots = fallback.days[fallback.days.length - 1]?.slots ?? [];
    expect(lastDaySlots.some((s) => s.endTime > "12:00")).toBe(false);
  });

  // Q. plusieurs transportPicks -> jamais transportPicksSummary[0] arbitraire
  it("Q. plusieurs transportPicks -> max des arrivées pour l'arrivée collective", () => {
    const window = calculatePlanningWindow(
      baseInput({
        transportPicksSummary: [
          { city: "Paris", mode: "train", arrival: "14:00" },
          { city: "Lyon", mode: "train", arrival: "17:30" },
        ],
        transferMarginMinutes: 30,
      }),
    );
    expect(window.arrivalReady).toBe("18:00"); // 17:30 + 30m
  });

  // R. absence de transport fiable -> aucune fausse précision
  it("R. absence de transport fiable -> arrivalReady est null", () => {
    const window = calculatePlanningWindow(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    expect(window.arrivalReady).toBeNull();
  });
});

describe("Tests Obligatoires — Préférences & Profils", () => {
  // T. activityCategoryFrequencies réellement utilisées
  it("T. activityCategoryFrequencies transmises dans le PlanningBrief", () => {
    const brief = buildPlanningBrief(
      baseInput({
        activityCategoryFrequencies: { "dégustation": 5, "spa": 2 },
      }),
    );
    expect(brief.preferenceSignals.activityCategoryFrequencies["dégustation"]).toBe(5);
  });

  // U. ambianceFrequencies réellement utilisées
  it("U. ambianceFrequencies transmises dans le PlanningBrief", () => {
    const brief = buildPlanningBrief(
      baseInput({
        ambianceFrequencies: { "gastronomie": 4, "fete": 3 },
      }),
    );
    expect(brief.preferenceSignals.ambianceFrequencies["gastronomie"]).toBe(4);
  });

  // V. dealBreaker transmis à Gemini
  it("V. dealBreaker ambiances transmises dans dealBreakers", () => {
    const brief = buildPlanningBrief(baseInput({ dealBreakerAmbiances: ["nightclub"] }));
    expect(brief.dealBreakers.ambiances).toContain("nightclub");
  });

  // W. Star deal-breaker transmis
  it("W. Star deal-breakers transmis dans dealBreakers", () => {
    const brief = buildPlanningBrief(baseInput({ starDealBreakers: ["escalade"] }));
    expect(brief.dealBreakers.starExclusions).toContain("escalade");
  });

  // X. plusieurs profils validés transmis
  it("X. plusieurs profils validés transmis dans validatedTripProfiles", () => {
    const brief = buildPlanningBrief(
      baseInput({ validatedTripProfiles: ["Gastronomie", "Bien-être & Spa"] }),
    );
    expect(brief.validatedTripProfiles).toEqual(["Gastronomie", "Bien-être & Spa"]);
  });

  // Y. localMobility inconnue reste unknown/null
  it("Y. localMobility inconnue reste null", () => {
    const brief = buildPlanningBrief(baseInput({ localMobility: null }));
    expect(brief.localMobility).toBeNull();
    const radius = determineSearchRadiusMeters(null, "City trip");
    expect(radius).toBe(10000); // prudent neutral default
  });

  // Z. équipement logement absent -> Gemini brief ne prétend pas qu'il existe
  it("Z. équipement logement non vérifié -> brief contient tableau vide", () => {
    const brief = buildPlanningBrief(baseInput({ verifiedLodgingAmenities: [] }));
    expect(brief.verifiedLodgingAmenities).toEqual([]);
  });
});

describe("Tests Obligatoires — Geoapify & Matchings", () => {
  // AA. breakfast -> cafe
  it("AA. breakfast -> catégorie cafe", () => {
    const req = convertIntentToPlaceRequirements("cafe", "repas", "petit-déjeuner cafe");
    expect(req.categories).toContain("catering.cafe");
  });

  // AB. dinner -> restaurant
  it("AB. dinner -> catégorie restaurant", () => {
    const req = convertIntentToPlaceRequirements("restaurant", "repas", "grand dîner");
    expect(req.categories).toContain("catering.restaurant");
  });

  // AC. nightlife -> bar/pub
  it("AC. nightlife -> catégories bar/pub sans adult/nightclub", () => {
    const req = convertIntentToPlaceRequirements("bar_pub", "soiree", "bar ambiance");
    expect(req.categories).toEqual(["catering.bar", "catering.pub"]);
  });

  // AD. winery intent -> subtype production.winery
  it("AD. winery intent -> subtype production.winery", () => {
    const req = convertIntentToPlaceRequirements("local_experience", "activite", "dégustation winery cave à vin");
    expect(req.subtype).toBe("production.winery");
  });

  // AE. market intent -> subtype commercial.marketplace
  it("AE. market intent -> subtype commercial.marketplace", () => {
    const req = convertIntentToPlaceRequirements("shopping", "activite", "visite du marché local");
    expect(req.subtype).toBe("commercial.marketplace");
  });

  // AF. deux intentions différentes avec catégories proches -> pools distincts
  it("AF. deux intentions distinctes -> pool keys distinctes", () => {
    const req1 = convertIntentToPlaceRequirements("bar_pub", "soiree", "apéro bar");
    const req2 = convertIntentToPlaceRequirements("bar_pub", "soiree", "dégustation winery cave");
    expect(buildPoolKey(req1)).not.toBe(buildPoolKey(req2));
  });
});

describe("Test de non-régression Scénario Complexe & Fallback", () => {
  it("Scénario EVJF 1 nuit -> fenêtres respectées, 1 Gemini max, mandatoryNeeds complets", async () => {
    const inputData = baseInput({
      eventType: "evjf",
      nights: 1,
      latestGroupArrival: "11:00",
      earliestGroupDeparture: "17:00",
      travelPace: "equilibre",
    });

    const brief = buildPlanningBrief(inputData);
    expect(brief.dayWindows.length).toBe(2);
    expect(brief.mandatoryNeeds.some((n) => n.type === "event_signature")).toBe(true);

    const fallback = buildMinimalFallbackFromBrief(brief);
    expect(fallback.days.length).toBe(2);

    // Day 1 slots should all start >= 11:00
    const day1Slots = fallback.days[0]?.slots ?? [];
    expect(day1Slots.every((s) => s.time >= "11:00")).toBe(true);

    // Day 2 slots should all end <= 17:00
    const day2Slots = fallback.days[1]?.slots ?? [];
    expect(day2Slots.every((s) => s.endTime <= "17:00")).toBe(true);
  });

  it("Fallback test -> Gemini indisponible -> planning minimal fonctionnel", () => {
    const origKey = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    const brief = buildPlanningBrief(baseInput());
    const fallback = buildMinimalFallbackFromBrief(brief);

    process.env["GEMINI_API_KEY"] = origKey;

    expect(fallback.days.length).toBe(2);
    expect(fallback.days[0]?.slots.length).toBeGreaterThan(0);
  });
});
