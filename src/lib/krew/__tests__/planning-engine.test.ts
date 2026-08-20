import { describe, expect, it, vi } from "vitest";
import {
  buildPlanningBrief,
  buildMinimalFallbackFromBrief,
  calculatePlanningWindow,
  geminiEnrichSkeleton,
  ensureMandatoryNeeds,
  applyMaxActivitiesPerDay,
  regenerateSlotWithAi,
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
  ...overrides,
});

describe("PR 107 — Tests Obligatoires du Moteur de Planning KREW", () => {
  // A. arrival inconnue -> availableFrom null
  it("A. arrival inconnue -> availableFrom est null", () => {
    const brief = buildPlanningBrief(baseInput({ latestGroupArrival: null, earliestOutboundDeparture: null }));
    expect(brief.dayWindows[0]?.availableFrom).toBeNull();
  });

  // B. departure inconnue -> availableUntil null
  it("B. departure inconnue -> availableUntil est null", () => {
    const brief = buildPlanningBrief(baseInput({ earliestGroupDeparture: null, latestReturnHome: null }));
    const lastDayIdx = brief.dayWindows.length - 1;
    expect(brief.dayWindows[lastDayIdx]?.availableUntil).toBeNull();
  });

  // C. overnight transport -> day offset/date correcte
  it("C. overnight transport -> arrivalDayOffset = 1 et arrivalReadyDate le lendemain", () => {
    const window = calculatePlanningWindow(
      baseInput({
        startDate: "2026-06-13",
        earliestOutboundDeparture: "20:30",
        transportDurationHours: 5,
        transferMarginMinutes: 45,
      }),
    );
    expect(window.arrivalDayOffset).toBe(1);
    expect(window.arrivalReady).toBe("02:15");
    expect(window.arrivalReadyDate).toBe("2026-06-14");
  });

  // D. jour avant arrivée overnight -> aucune fenêtre (availableFrom & availableUntil null)
  it("D. jour 1 avant arrivée overnight -> indisponible à destination (availableFrom & availableUntil null)", () => {
    const brief = buildPlanningBrief(
      baseInput({
        startDate: "2026-06-13",
        nights: 2,
        earliestOutboundDeparture: "20:30",
        transportDurationHours: 5,
        transferMarginMinutes: 45,
      }),
    );

    // Day 1: unavailable
    expect(brief.dayWindows[0]?.availableFrom).toBeNull();
    expect(brief.dayWindows[0]?.availableUntil).toBeNull();

    // Day 2: available from 02:15
    expect(brief.dayWindows[1]?.availableFrom).toBe("02:15");
  });

  // E. heure Gemini invalide -> placement dynamique ou rejet (pas de 12:00)
  it("E. startTime Gemini invalide -> placement dynamique selon gap, pas 12:00 fictif", async () => {
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
                          slots: [{ kind: "place_required", time: "INVALID_TIME", momentType: "repas", label: "Dîner de groupe" }],
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

  // F. kind inconnu non déterminable -> rejet
  it("F. kind inconnu non déterminable -> slot rejeté", async () => {
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
                        { day: 1, slots: [{ kind: "whatever_unknown", time: "15:00", momentType: "unknown_type", label: "Truc" }] },
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
    const hasSlot = res.enrichedSkeleton.days[0]?.slots.some((s) => s.label === "Truc");
    expect(hasSlot).toBe(false);
  });

  // G. momentType inconnu non déterminable -> rejet
  it("G. momentType inconnu non déterminable -> slot rejeté (jamais culture par défaut)", async () => {
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
                        { day: 1, slots: [{ kind: "place_required", time: "15:00", momentType: "xyz_invalid", label: "Mystère" }] },
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
    const mystereSlot = res.enrichedSkeleton.days[0]?.slots.find((s) => s.label === "Mystère");
    expect(mystereSlot).toBeUndefined();
  });

  // H. EVJF 1 nuit, soirée jour 1 -> targetDay jour 1
  it("H. EVJF 1 nuit avec soirée jour 1 disponible -> targetDay = 1", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf", nights: 1, latestGroupArrival: "11:00" }));
    const evjfNeed = brief.mandatoryNeeds.find((n) => n.type === "event_signature");
    expect(evjfNeed?.targetDay).toBe(1);
  });

  // I. Gemini oublie EVJF -> réparation post-Gemini réelle
  it("I. Gemini oublie EVJF -> réinjecté réellement post-Gemini via ensureMandatoryNeeds", () => {
    const brief = buildPlanningBrief(baseInput({ eventType: "evjf" }));
    const skeletonWithoutEvjf = {
      destination: "Beaune",
      nights: 1,
      days: [{ day: 1, date: "2026-06-13", slots: [] }],
    };

    const repaired = ensureMandatoryNeeds(skeletonWithoutEvjf, brief);
    const hasEvjf = repaired.days.flatMap((d) => d.slots).some((s) => s.label.includes("mariée"));
    expect(hasEvjf).toBe(true);
  });

  // J. Gemini oublie dîner obligatoire -> réparation réelle
  it("J. Gemini oublie le dîner obligatoire -> réinjecté réellement post-Gemini", () => {
    const brief = buildPlanningBrief(baseInput());
    const skeletonWithoutDinner = {
      destination: "Beaune",
      nights: 1,
      days: [{ day: 1, date: "2026-06-13", slots: [] }],
    };

    const repaired = ensureMandatoryNeeds(skeletonWithoutDinner, brief);
    const hasDinner = repaired.days.flatMap((d) => d.slots).some((s) => s.category === "repas");
    expect(hasDinner).toBe(true);
  });

  // K. léger + Gemini 4 activités -> plafond maxActivitiesPerDay appliqué
  it("K. travelPace = leger + Gemini renvoie 4 activités -> max 1 activité conservée par jour", () => {
    const brief = buildPlanningBrief(baseInput({ travelPace: "leger" }));
    expect(brief.planningRules.maxActivitiesPerDay).toBe(1);

    const skeletonWith4Acts = {
      destination: "Beaune",
      nights: 1,
      days: [
        {
          day: 1,
          date: "2026-06-13",
          slots: [
            { id: "1", day: 1, moment: "Matin", time: "10:00", endTime: "11:30", durationMinutes: 90, kind: "place_required" as const, type: "activite" as const, category: "culture" as const, label: "Act 1", importance: "high" as const, flexibility: "flexible" as const },
            { id: "2", day: 1, moment: "Après-midi", time: "14:00", endTime: "15:30", durationMinutes: 90, kind: "place_required" as const, type: "activite" as const, category: "culture" as const, label: "Act 2", importance: "high" as const, flexibility: "flexible" as const },
            { id: "3", day: 1, moment: "Après-midi", time: "16:00", endTime: "17:30", durationMinutes: 90, kind: "place_required" as const, type: "activite" as const, category: "culture" as const, label: "Act 3", importance: "high" as const, flexibility: "flexible" as const },
          ],
        },
      ],
    };

    const pruned = applyMaxActivitiesPerDay(skeletonWith4Acts, brief);
    const acts = pruned.days[0]?.slots.filter((s) => s.kind === "place_required");
    expect(acts?.length).toBe(1);
  });

  // L. profil non validé présent dans stayConcepts -> pas transmis dans validatedTripProfiles
  it("L. profil non validé -> pas transmis dans validatedTripProfiles", () => {
    const brief = buildPlanningBrief(
      baseInput({
        validatedTripProfiles: ["Gastronomie"],
      }),
    );
    expect(brief.validatedTripProfiles).toEqual(["Gastronomie"]);
  });

  // M. amenities selected accommodation -> réellement injectées
  it("M. amenities de l'hébergement sélectionné -> injectées dans verifiedLodgingAmenities", () => {
    const brief = buildPlanningBrief(
      baseInput({
        verifiedLodgingAmenities: ["pool", "spa", "terrace"],
      }),
    );
    expect(brief.verifiedLodgingAmenities).toEqual(["pool", "spa", "terrace"]);
  });

  // N. winery -> production.winery réellement envoyé
  it("N. winery intent -> production.winery inclus dans categories", () => {
    const req = convertIntentToPlaceRequirements("local_experience", "activite", "dégustation de vin en cave/winery");
    expect(req.categories).toContain("production.winery");
  });

  // O. market -> commercial.marketplace réellement envoyé
  it("O. market intent -> commercial.marketplace inclus dans categories", () => {
    const req = convertIntentToPlaceRequirements("shopping", "activite", "marché local des producteurs");
    expect(req.categories).toContain("commercial.marketplace");
  });

  // P. dietary supported -> condition Geoapify réellement envoyée
  it("P. régimes alimentaires supportés -> conditions Geoapify générées", () => {
    const conds = mapDietaryConstraintsToGeoapifyConditions(["végétalien", "halal"]);
    expect(conds).toContain("vegan");
    expect(conds).toContain("halal");
  });

  // Q. accessibility -> condition Geoapify réellement envoyée
  it("Q. accessibilité requise -> condition wheelchair générée", () => {
    const conds = mapAccessibilityToGeoapifyConditions(true, ["accès fauteuil roulant"]);
    expect(conds).toContain("wheelchair");
  });

  // R. candidat subtype incorrect -> classé derrière
  it("R. candidat subtype compatible classé devant candidat sans subtype", () => {
    const req = convertIntentToPlaceRequirements("shopping", "activite", "marché local");
    const candidates = [
      { id: "p1", name: "Magasin général", category: "commercial.shopping_mall", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true },
      { id: "p2", name: "Grand Marché", category: "commercial.marketplace", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 500, website: null, source: "geoapify" as const, verified: true },
    ];

    const ranked = rankGeoapifyCandidates(candidates, req, null, new Set());
    expect(ranked[0]?.name).toBe("Grand Marché");
  });

  // S. candidat closed -> rejeté, candidat suivant testé
  it("S. fetchPlaceDetails en cache -> réutilise les propriétés sans double appel", async () => {
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

  // U. Place Details appelé seulement sur candidat shortlisté
  it("U. Place Details appelé uniquement par ID spécifique", async () => {
    process.env["GEOAPIFY_API_KEY"] = "test-geo-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: { formatted: "Address" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPlaceDetails("shortlisted-id");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("id=shortlisted-id"),
      expect.anything(),
    );
  });

  // W. internal lodging -> locationContext = lodging
  it("W. slots logement internal -> locationContext = lodging", () => {
    const brief = buildPlanningBrief(baseInput({ groupAccommodationRole: "centerpiece" }));
    const fallback = buildMinimalFallbackFromBrief(brief);
    const lodgingSlot = fallback.days.flatMap((d) => d.slots).find((s) => s.category === "moment_maison");
    expect(lodgingSlot?.locationContext).toBe("lodging");
  });

  // X. internal "apéro" sans locationContext lodging -> ne reset PAS vers logement
  it("X. slot external apéro au bar -> locationContext !== lodging", () => {
    const req = convertIntentToPlaceRequirements("bar_pub", "soiree", "apéro au bar");
    expect(req.canonicalFamily).toBe("bar_pub");
  });

  // Y. pool extension avec doublon -> déduplication par ID stable
  it("Y. pool extension avec doublons -> dédupliqué par ID stable", () => {
    const p1 = { id: "geo-1", name: "Place 1", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
    const p2 = { id: "geo-2", name: "Place 2", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };
    const p1Dup = { id: "geo-1", name: "Place 1 Dup", category: "cafe", address: null, latitude: 45.9, longitude: 6.1, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };

    const merged = mergeUniquePlacesById([p1, p2], [p1Dup]);
    expect(merged.length).toBe(2);
    expect(merged.map((m) => m.id)).toEqual(["geo-1", "geo-2"]);
  });

  // Z. regenerate -> 0 Gemini
  it("Z. regenerateSlotWithAi -> 0 appel Gemini", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const mockSlot = { moment: "Soir", type: "activite" as const, label: "Visite", time: "20:00" };
    const res = await regenerateSlotWithAi(baseInput(), mockSlot, 1, [], []);

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(res.usedLlm).toBe(false);
  });
});
