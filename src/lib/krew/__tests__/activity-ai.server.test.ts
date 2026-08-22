import { describe, expect, it, vi } from "vitest";
import {
  buildDiscoveryQueries,
  normalizeSearchCandidates,
  isSafeActivityUrl,
  type ActivityCandidate,
} from "../activity-discovery.server";
import {
  buildLocalItinerary,
  aggregateMajorityTimePreference,
  calculatePlanningWindow,
  haversineDistanceKm,
  validateItinerary,
  adjustItineraryTransferTimes,
  buildKrewSkeleton,
  buildPlanningBrief,
  buildGroupPlanningContext,
  geminiEnrichSkeleton,
  regenerateSlotWithAi,
  normalizeGeminiParsedResponse,
  GEMINI_CONTRACTUAL_PROMPT_TEMPLATE,
  type ActivityAiInput,
} from "../activity-ai.server";
import {
  mapVenueFamilyToGeoapifyCategories,
  determineSearchRadiusMeters,
  searchGeoapifyPlaces,
  buildVerifiedPlaceFallbackUrl,
  extractGeographicSignalFromIntent,
  resolveSearchIntentLocation,
  clearIntentLocationCache,
  convertIntentToPlaceRequirements,
  buildPoolKey,
  rankGeoapifyCandidates,
  mergeUniquePlacesById,
} from "../geoapify.server";
import { resolveActivityResourceForPlace, resolveActivityResourceUrl } from "../activity-ai.server";
import { isTripAdmin } from "../engine";

const input = (overrides: Partial<ActivityAiInput> = {}): ActivityAiInput => ({
  destination: "Annecy",
  startDate: "2026-09-11",
  endDate: "2026-09-13",
  nights: 2,
  participants: 8,
  budgetPerPerson: 450,
  eventType: "weekend",
  tripProfile: "Évasion outdoor & sportive",
  ambiances: ["nature", "sportif"],
  activityCategories: ["kayak", "randonnée"],
  starWanted: [],
  travelPace: "equilibre",
  ...overrides,
});

const candidate: ActivityCandidate = {
  id: "kayak-1",
  name: "Club de kayak vérifié",
  type: "external",
  category: "kayak",
  description: "Kayak sur le lac",
  destination: "Annecy",
  address: "Annecy",
  latitude: 45.9,
  longitude: 6.1,
  sourceUrl: "https://example.org/kayak",
  mapsUrl: null,
  source: "office-tourisme.example",
  priceHint: null,
  priceRange: null,
  durationMinutes: 120,
  openingHours: [],
  rating: 4.7,
  reviewCount: 120,
  environment: "outdoor",
  tags: ["sport", "nature"],
  profileFit: 95,
  eventFit: 60,
  seasonality: null,
  verified: true,
  verifiedAt: "2026-08-16T00:00:00.000Z",
  groundingSources: [],
};

describe("Enrichissement des liens d'activités & classification des modes", () => {
  it("classifyActivityMode classifie correctement les 3 besoins fonctionnels", () => {
    const { classifyActivityMode } = require("../activity-ai.server");

    expect(classifyActivityMode({ kind: "internal", label: "Jeu de la mariée" })).toBe("self_guided_group");
    expect(classifyActivityMode({ category: "jeu_groupe", label: "Quiz" })).toBe("self_guided_group");
    expect(classifyActivityMode({ label: "Balade dans le centre historique" })).toBe("free_exploration");
    expect(classifyActivityMode({ label: "Promenade au parc" })).toBe("free_exploration");
    expect(classifyActivityMode({ label: "Séance de spa et massages" })).toBe("bookable");
  });

  it("resolveActivityResourceUrl n'infère pas 'official' ou 'booking' uniquement d'après le domaine", () => {
    const { resolveActivityResourceUrl } = require("../activity-ai.server");

    // Sans hint explicit, par défaut website si HTTPS valide
    expect(resolveActivityResourceUrl("https://parc-national.fr/site")).toEqual({
      url: "https://parc-national.fr/site",
      resourceKind: "website",
    });

    // TripAdvisor ou Google Search ne deviennent ni official ni booking
    expect(resolveActivityResourceUrl("https://www.tripadvisor.fr/attraction")).toEqual({
      url: null,
      resourceKind: null,
    });
    expect(resolveActivityResourceUrl("https://google.com/search?q=test")).toEqual({
      url: null,
      resourceKind: null,
    });

    // Avec hint explicite "booking" ou "ideas"
    expect(resolveActivityResourceUrl("https://partner.com/offer", { kindHint: "booking" })).toEqual({
      url: "https://partner.com/offer",
      resourceKind: "booking",
    });
    expect(resolveActivityResourceUrl("https://ideas-blog.fr/article", { kindHint: "ideas" })).toEqual({
      url: "https://ideas-blog.fr/article",
      resourceKind: "ideas",
    });

    expect(resolveActivityResourceUrl("javascript:alert(1)")).toEqual({
      url: null,
      resourceKind: null,
    });
    expect(resolveActivityResourceUrl(null)).toEqual({
      url: null,
      resourceKind: null,
    });
  });

  it("validateItinerary conserve l'activité tout en nettoyant l'URL invalide ou interne", () => {
    const candidateWithBadUrl = { ...candidate, sourceUrl: "javascript:alert(1)" };
    const internalPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 90,
            type: "libre" as const,
            category: "moment_maison" as const,
            label: "Jeu de groupe au logement",
            url: "https://parc-national.fr/game",
          },
          {
            moment: "Soir",
            time: "20:00",
            durationMinutes: 90,
            type: "activite" as const,
            category: "culture" as const,
            label: candidateWithBadUrl.name,
            candidateId: candidateWithBadUrl.id,
            url: "javascript:alert(1)",
          },
        ],
      },
    ];

    const validated = validateItinerary(internalPlan, input(), [candidateWithBadUrl]);
    const slots = validated[0]?.slots ?? [];

    expect(slots).toHaveLength(2);
    expect(slots[0]?.url).toBeNull();
    expect(slots[1]?.url).toBeNull();
    expect(slots[0]?.activityMode).toBe("self_guided_group");
  });

  it("prouve que self_guided_group avec une ressource ideas et free_exploration ont verified = false", () => {
    const { resolveActivityResourceUrl } = require("../activity-ai.server");

    // self_guided_group avec ressource
    const ideasLink = resolveActivityResourceUrl("https://idees-evjf.fr/regles-jeu-mariee", { kindHint: "ideas" });
    const selfGuidedSlot = {
      label: "Jeu de la mariée",
      activityMode: "self_guided_group" as const,
      verified: false,
      url: ideasLink.url,
      resourceKind: ideasLink.resourceKind,
    };

    expect(selfGuidedSlot.verified).toBe(false);
    expect(selfGuidedSlot.url).toBe("https://idees-evjf.fr/regles-jeu-mariee");
    expect(selfGuidedSlot.resourceKind).toBe("ideas");

    // free_exploration
    const freeExploSlot = {
      label: "Balade dans le quartier du Château",
      activityMode: "free_exploration" as const,
      verified: false,
      url: null,
      resourceKind: null,
    };

    expect(freeExploSlot.verified).toBe(false);
    expect(freeExploSlot.url).toBeNull();
  });

  it("findIdeasResourceForActivity trouve une URL d'idées pour un jeu et renvoie null pour un apéro", async () => {
    const { findIdeasResourceForActivity } = await import("../activity-discovery.server");

    // Simple apéro -> aucune recherche web
    const aperoRes = await findIdeasResourceForActivity({
      label: "Apéro au logement",
      eventType: "weekend",
    });
    expect(aperoRes).toBeNull();

    // Jeu / quiz -> recherche web déclenchée
    const originalFetch = global.fetch;
    const origTavily = process.env["TAVILY_API_KEY"];
    process.env["TAVILY_API_KEY"] = "fake-key";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: "https://www.google.com/search?q=jeu" }, // Filtre Google
          { url: "https://idees-evjf.fr/regles-jeu-mariee" }, // URL d'idées valide
        ],
      }),
    });
    global.fetch = fetchMock;

    try {
      const gameRes = await findIdeasResourceForActivity({
        label: "Jeu de la mariée",
        searchIntent: "jeu de la mariée quiz",
        eventType: "evjf",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(gameRes).toBe("https://idees-evjf.fr/regles-jeu-mariee");
    } finally {
      global.fetch = originalFetch;
      process.env["TAVILY_API_KEY"] = origTavily;
    }
  });
});

describe("Nouveau moteur de planning KREW (Skeletons, Gemini, Geoapify)", () => {
  it("A. Arrivée à 18h -> aucune activité déplacée à 13h sur le jour 1", () => {
    const skeleton = buildKrewSkeleton(
      input({ latestGroupArrival: "18:00", transferMarginMinutes: 0 }),
    );
    const day1Slots = skeleton.days[0]?.slots ?? [];
    expect(day1Slots.some((s) => s.time < "18:00")).toBe(false);
  });

  it("B. Départ destination à 12h -> aucune activité ne se termine après 12h le dernier jour", () => {
    const skeleton = buildKrewSkeleton(
      input({ earliestGroupDeparture: "12:00", transferMarginMinutes: 0 }),
    );
    const lastDaySlots = skeleton.days[skeleton.days.length - 1]?.slots ?? [];
    expect(lastDaySlots.some((s) => s.endTime > "12:00")).toBe(false);
  });

  it("C. Travel pace léger vs intense -> léger contient moins de créneaux structurants", () => {
    const lightSkeleton = buildKrewSkeleton(input({ travelPace: "leger" }));
    const intenseSkeleton = buildKrewSkeleton(input({ travelPace: "intense" }));

    const countSlots = (s: typeof lightSkeleton) =>
      s.days.flatMap((d) => d.slots).filter((slot) => slot.kind === "place_required").length;

    expect(countSlots(lightSkeleton)).toBeLessThan(countSlots(intenseSkeleton));
  });

  it("C2. Travel pace intense sans préférence sport -> aucune activité sportive forcée", () => {
    const intenseNoSport = buildKrewSkeleton(
      input({
        travelPace: "intense",
        ambiances: ["culturel"],
        activityCategories: ["musée", "gastronomie"],
      }),
    );

    const hasSport = intenseNoSport.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");

    expect(hasSport).toBe(false);
  });

  it("D. Accommodation role centerpiece -> davantage de moments au logement qu'un base_only", () => {
    const centerpiece = buildKrewSkeleton(
      input({
        groupAccommodationRole: "centerpiece",
      }),
    );
    const baseOnly = buildKrewSkeleton(
      input({
        groupAccommodationRole: "base_only",
      }),
    );

    const homeSlotsCount = (s: typeof centerpiece) =>
      s.days.flatMap((d) => d.slots).filter((slot) => slot.category === "moment_maison").length;

    expect(homeSlotsCount(centerpiece)).toBeGreaterThan(homeSlotsCount(baseOnly));
  });

  it("D2. preferredTimeSlots : tard_soir ≠ matin_tard", () => {
    const lateNightOnly = buildKrewSkeleton(
      input({
        preferredTimeSlots: ["tard_soir"],
      }),
    );

    const breakfastSlot = lateNightOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Matin");
    const dinnerSlot = lateNightOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Soir");

    expect(dinnerSlot?.time).toBe("20:30");
    expect(breakfastSlot?.time).toBe("08:30");

    const lateMorningOnly = buildKrewSkeleton(
      input({
        preferredTimeSlots: ["matin_tard"],
      }),
    );

    const breakfastLate = lateMorningOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Matin");
    const dinnerNormal = lateMorningOnly.days[1]?.slots.find((s) => s.category === "repas" && s.moment === "Soir");

    expect(breakfastLate?.time).toBe("09:30");
    expect(dinnerNormal?.time).toBe("20:00");
  });

  it("D3. Aucun équipement logement non vérifié dans les defaults du skeleton", () => {
    const skeleton = buildKrewSkeleton(input());
    const allText = skeleton.days
      .flatMap((d) => d.slots)
      .map((s) => `${s.label} ${s.detail || ""}`.toLowerCase())
      .join(" ");

    expect(allText).not.toMatch(/barbecue|piscine|terrasse|jacuzzi|spa privé|jardin|cheminée/);
  });

  it("E. Profil montagne + souhait sport -> intention outdoor/sport cohérente", () => {
    const skeleton = buildKrewSkeleton(
      input({
        tripProfile: "Montagne & Outdoor",
        ambiances: ["montagne", "sportif"],
        activityCategories: ["randonnée"],
      }),
    );

    const hasSportOrOutdoor = skeleton.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");
    expect(hasSportOrOutdoor).toBe(true);
  });

  it("F. Sport refusé/non souhaité -> ne pas forcer de randonnée ou activité sportive", () => {
    const skeleton = buildKrewSkeleton(
      input({
        tripProfile: "City trip culture",
        ambiances: ["culturel", "urbain"],
        activityCategories: ["musée", "gastronomie"],
      }),
    );

    const hasSport = skeleton.days
      .flatMap((d) => d.slots)
      .some((s) => s.category === "sport_outdoor");
    expect(hasSport).toBe(false);
  });

  it("G. EVJF -> event_moment présent, aucun lieu inventé", () => {
    const skeleton = buildKrewSkeleton(input({ eventType: "evjf" }));
    const eventSlot = skeleton.days
      .flatMap((d) => d.slots)
      .find((s) => s.category === "jeu_groupe" || s.category === "evenement");

    expect(eventSlot).toBeDefined();
    expect(eventSlot?.kind).toBe("internal");
    // Skeleton slot is internal with no external place/url attached
    expect(eventSlot?.url).toBeUndefined();
  });

  it("H. Gemini en erreur -> skeleton KREW utilisable", async () => {
    const skeleton = buildKrewSkeleton(input());
    // Simulate missing GEMINI_API_KEY
    const origKey = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    const enriched = await geminiEnrichSkeleton(skeleton, input());
    process.env["GEMINI_API_KEY"] = origKey;

    expect(enriched.usedLlm).toBe(false);
    expect(enriched.enrichedSkeleton.days.length).toBe(skeleton.days.length);
  });

  it("I. Geoapify en erreur / clé absente -> aucune fausse activité & planning non vide", async () => {
    const origKey = process.env["GEOAPIFY_API_KEY"];
    delete process.env["GEOAPIFY_API_KEY"];

    const places = await searchGeoapifyPlaces({
      categories: ["catering.restaurant"],
      longitude: 6.1,
      latitude: 45.9,
    });

    process.env["GEOAPIFY_API_KEY"] = origKey;

    expect(places).toEqual([]);
  });

  it("J. Geoapify -> catégories officielles et format filter circle:lon,lat,radiusMeters", () => {
    const categories = mapVenueFamilyToGeoapifyCategories("restaurant", "resto");
    expect(categories).toContain("catering.restaurant");

    const radius = determineSearchRadiusMeters("walk_transit", "city trip");
    expect(radius).toBe(3500);
  });

  it("K. Pool de candidats et autre proposition reconsomme le pool sans rappel Gemini/Geoapify", () => {
    const mockPool = [
      { id: "p1", name: "Resto A", address: "Adresse A" },
      { id: "p2", name: "Resto B", address: "Adresse B" },
    ];

    const currentSlot = { label: "Resto A", venueFamily: "restaurant", type: "resto" };
    const avoidLabels = ["Resto A"];

    const unusedPlace = mockPool.find(
      (place) => !avoidLabels.some((l) => l.toLowerCase().trim() === place.name.toLowerCase().trim()),
    );

    expect(unusedPlace).toBeDefined();
    expect(unusedPlace?.name).toBe("Resto B");
  });

  it("L. Cohérence géographique : rayon resserré pour un city trip", () => {
    const cityRadius = determineSearchRadiusMeters("walk_transit", "City trip");
    const outdoorRadius = determineSearchRadiusMeters("car_ok", "Montagne Outdoor");

    expect(cityRadius).toBeLessThan(outdoorRadius);
  });

  it("M. Droits : seul l'organisateur / co-organisateur (isTripAdmin) peut administrer", () => {
    const trip = { owner_id: "user-owner", co_organizer_id: "user-coorg" };

    expect(isTripAdmin(trip as any, "user-owner")).toBe(true);
    expect(isTripAdmin(trip as any, "user-coorg")).toBe(true);
    expect(isTripAdmin(trip as any, "user-participant")).toBe(false);
  });

  it("N. Au maximum 1 seul appel Gemini par enrichissement du skeleton", async () => {
    const skeleton = buildKrewSkeleton(input());
    const origKey = process.env["GEMINI_API_KEY"];
    process.env["GEMINI_API_KEY"] = "test-key";
    const validPayload = {
      days: [
        {
          day: 1,
          slots: [
            {
              kind: "place_required",
              momentType: "repas",
              canonicalVenueFamily: "restaurant",
              label: "Dîner",
              time: "20:00",
              durationMinutes: 90,
            },
          ],
        },
      ],
    };
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(validPayload) }] } }] }),
    });
    global.fetch = fetchMock;

    try {
      const res = await geminiEnrichSkeleton(skeleton, input());
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(res.usedLlm).toBe(true);
    } finally {
      global.fetch = originalFetch;
      process.env["GEMINI_API_KEY"] = origKey;
    }
  });

  it("O. Aucune dépendance Tavily dans la découverte d'activités pour le planning", async () => {
    const { discoverActivities } = await import("../activity-discovery.server");
    const res = await discoverActivities({
      destination: "Annecy",
      budgetPerPerson: 400,
      ambiances: [],
      activityCategories: [],
    });
    // Tavily is completely bypassed in planning discovery
    expect(res.candidates).toEqual([]);
  });

  it("P. adjustItineraryTransferTimes décale les créneaux suivants d'au moins le temps de transfert quand les deux ont des coordonnées", () => {
    const dayPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 60,
            endTime: "16:00",
            label: "Lieu A",
            latitude: 45.9,
            longitude: 6.1,
            type: "activite" as const,
          },
          {
            moment: "Après-midi",
            time: "16:05",
            durationMinutes: 60,
            endTime: "17:05",
            label: "Lieu B",
            latitude: 46.1, // ~22km away -> requires transfer
            longitude: 6.2,
            type: "activite" as const,
          },
        ],
      },
    ];

    const adjusted = adjustItineraryTransferTimes(dayPlan, input());
    const slotB = adjusted[0]?.slots[1];

    expect(slotB?.time).not.toBe("16:05");
    expect((slotB?.time ?? "") > "16:05").toBe(true);
  });

  it("Q. adjustItineraryTransferTimes n'ajoute pas de transfert de 20 min sans coordonnées", () => {
    const dayPlan = [
      {
        day: 2,
        slots: [
          {
            moment: "Après-midi",
            time: "14:00",
            durationMinutes: 60,
            endTime: "15:00",
            label: "Slot interne sans coords",
            type: "libre" as const,
          },
          {
            moment: "Après-midi",
            time: "15:00",
            durationMinutes: 60,
            endTime: "16:00",
            label: "Slot suivant",
            type: "activite" as const,
          },
        ],
      },
    ];

    const adjusted = adjustItineraryTransferTimes(dayPlan, input());
    const slotB = adjusted[0]?.slots[1];

    expect(slotB?.time).toBe("15:00");
  });

  it("R. Geoapify categories: Nightlife (no adult/nightclub) et Spa (leisure.spa, service.beauty.spa, service.beauty.massage)", () => {
    const nightlifeCats = mapVenueFamilyToGeoapifyCategories("nightlife", "bar");
    expect(nightlifeCats).toEqual(["catering.bar", "catering.pub"]);
    expect(nightlifeCats.some((c) => c.includes("adult") || c.includes("nightclub"))).toBe(false);

    const spaCats = mapVenueFamilyToGeoapifyCategories("relaxation", "spa");
    expect(spaCats).toEqual(["leisure.spa", "service.beauty.spa", "service.beauty.massage"]);
    expect(spaCats.some((c) => c.includes("fitness") || c.includes("theme_park"))).toBe(false);
  });
});

describe("contraintes déterministes du planning", () => {
  it("agrège les préférences aller et retour selon la majorité", () => {
    expect(
      aggregateMajorityTimePreference([...Array(6).fill("13:00"), ...Array(2).fill("18:00")]),
    ).toBe("13:00");
    expect(
      aggregateMajorityTimePreference([...Array(6).fill("20:00"), ...Array(2).fill("16:00")]),
    ).toBe("20:00");
  });

  it("P1 & P2. transportPicksSummary et transportDurationHours ne dévient pas les fallbacks 18:30 / 16:30 sans vraie heure destination", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 2,
          transferMarginMinutes: 60,
          transportPicksSummary: [{ city: "Paris", mode: "train", arrival: "18:00" }],
        }),
      ).arrivalReady,
    ).toBe("18:30");
  });

  it("P3. earliestOutboundDeparture ne transforme pas l'horaire origine en arrivée destination", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 4,
          transferMarginMinutes: 60,
        }),
      ).arrivalReady,
    ).toBe("18:30");
  });

  it("supprime tout slot avant une arrivée à 18:00 plus marge", () => {
    const ctx = input({ latestGroupArrival: "18:00", transferMarginMinutes: 60 });
    const [day] = validateItinerary(
      [
        {
          day: 1,
          slots: [
            {
              moment: "Après-midi",
              time: "18:30",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Soir",
              time: "19:00",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
          ],
        },
      ],
      ctx,
      [candidate],
    );
    expect(day?.slots.map((slot) => slot.time)).toEqual(["19:00"]);
  });

  it("P4. latestReturnHome ne transforme pas l'horaire origine en départ destination (reste 16:30)", () => {
    const ctx = input({
      latestReturnHome: "20:00",
      transportDurationHours: 4,
      transferMarginMinutes: 60,
    });
    expect(calculatePlanningWindow(ctx).latestDestinationDeparture).toBe("16:30");
    const last = validateItinerary(
      [
        {
          day: 3,
          slots: [
            {
              moment: "Après-midi",
              time: "15:30",
              durationMinutes: 90,
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
          ],
        },
      ],
      ctx,
      [candidate],
    );
    expect(last[0]?.slots).toHaveLength(0);
  });

  it("rejette URL invalide, doublon horaire et lieu externe non vérifié", () => {
    expect(isSafeActivityUrl("javascript:alert(1)")).toBe(false);
    const days = validateItinerary(
      [
        {
          day: 2,
          slots: [
            {
              moment: "Matin",
              time: "10:00",
              durationMinutes: 120,
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Matin",
              time: "10:30",
              type: "activite",
              label: candidate.name,
              candidateId: candidate.id,
            },
            {
              moment: "Midi",
              time: "13:00",
              type: "resto",
              label: "Restaurant inventé",
              url: "https://fake.example",
            },
          ],
        },
      ],
      input(),
      [candidate],
    );
    expect(days[0]?.slots).toHaveLength(1);
    expect(days[0]?.slots[0]?.verified).toBe(true);
  });

  it("rejette un lieu fermé à l'heure proposée", () => {
    const closed = { ...candidate, id: "closed", openingHours: ["Samedi: 18:00-23:00"] };
    const days = validateItinerary(
      [
        {
          day: 2,
          slots: [
            {
              moment: "Midi",
              time: "13:00",
              type: "resto",
              label: closed.name,
              candidateId: closed.id,
            },
          ],
        },
      ],
      input(),
      [closed],
    );
    expect(days[0]?.slots).toHaveLength(0);
  });

  it("rejette un saut absurde en city trip et applique le plafond dur 30km même outdoor", () => {
    const far = {
      ...candidate,
      id: "far",
      name: "Base outdoor distante",
      latitude: 46.25,
      longitude: 6.1,
      category: "randonnée",
      environment: "outdoor" as const,
    };
    expect(haversineDistanceKm(candidate, far)).toBeGreaterThan(35);
    const plan = [
      {
        day: 2,
        slots: [
          {
            moment: "Matin",
            time: "09:00",
            durationMinutes: 60,
            type: "activite" as const,
            label: candidate.name,
            candidateId: candidate.id,
          },
          {
            moment: "Après-midi",
            time: "12:00",
            durationMinutes: 60,
            type: "activite" as const,
            label: far.name,
            candidateId: far.id,
          },
        ],
      },
    ];
    expect(
      validateItinerary(plan, input({ tripProfile: "City trip", ambiances: ["urbain"] }), [
        candidate,
        far,
      ])[0]?.slots,
    ).toHaveLength(1);
    // Plafond dur 30 km : rejeté même outdoor si > 30 km
    expect(validateItinerary(plan, input(), [candidate, far])[0]?.slots).toHaveLength(1);
  });
});

describe("personnalisation du fallback et de la discovery", () => {
  it("oriente Nature & sportif vers des recherches outdoor", () => {
    const queries = buildDiscoveryQueries(input());
    expect(queries.some((query) => /outdoor|sport|nautique|randonnée/.test(query))).toBe(true);
  });

  it("laisse des moments logement au profil maison/chill sans inventer de visite", () => {
    const itinerary = buildLocalItinerary(
      input({ tripProfile: "Maison entre nous", travelPace: "chill", ambiances: ["cocooning"] }),
      [],
    );
    const slots = itinerary.days.flatMap((day) => day.slots);
    expect(
      slots.filter((slot) => slot.category === "moment_maison" || slot.category === "jeu_groupe" || slot.locationContext === "lodging")
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(slots.every((slot) => slot.verified === false || slot.type === "transport")).toBe(true);
  });

  it.each([
    ["evjf", "Jeu de la mariée"],
    ["evg", "Défis du marié"],
    ["anniversaire", "Surprise anniversaire"],
  ])("ajoute un moment fort pour %s", (eventType, label) => {
    const itinerary = buildLocalItinerary(input({ eventType, latestGroupArrival: "10:00" }), [
      candidate,
    ]);
    expect(itinerary.days.flatMap((day) => day.slots).some((slot) => slot.label === label)).toBe(
      true,
    );
  });

  it("n'injecte jamais l'ancienne arrivée arbitraire à 11:00", () => {
    const itinerary = buildLocalItinerary(
      input({ latestGroupArrival: null, earliestOutboundDeparture: null }),
      [],
    );
    expect(
      itinerary.days
        .flatMap((day) => day.slots)
        .some((slot) => slot.type === "transport" && slot.time === "11:00"),
    ).toBe(false);
  });
});

describe("Pipeline Planning Gemini & Backups Contractuels", () => {
  it("construit un GroupPlanningContext complet avec Star séparée et signaux de scoring", () => {
    const testInput = input({
      destinationScore: 88,
      matchReasons: ["Proche de la nature", "Adapté au groupe"],
      scoredActivityLabels: ["Canoë lac", "Randonnée col"],
      activityCategoryFrequencies: { kayak: 5, rando: 3 },
      ambianceFrequencies: { nature: 6, sportif: 4 },
      starWanted: ["Escape Game Star"],
      starWantedEnvType: "montagne",
      starDealBreakers: ["pas_de_boite"],
      dealBreakerAmbiances: ["soiree_arrosee"],
      groupAgeRange: "25-35",
      wantedEnvTypes: ["lac"],
    });

    const brief = buildPlanningBrief(testInput);
    const ctx = buildGroupPlanningContext(testInput, brief);

    expect(ctx.trip.destination).toBe("Annecy");
    expect(ctx.trip.participantCount).toBe(8);
    expect(ctx.group.activityPreferences["kayak"]?.frequency).toBe(5);
    expect(ctx.group.ambiancePreferences["nature"]?.frequency).toBe(6);
    expect(ctx.group.dealBreakers).toContain("soiree_arrosee");

    // Star transmise séparément
    expect(ctx.star.starWantedActivities).toContain("Escape Game Star");
    expect(ctx.star.starWantedEnvType).toBe("montagne");
    expect(ctx.star.starDealBreakers).toContain("pas_de_boite");

    // KREW Signals & Scoring
    expect(ctx.krewSignals.destinationScore).toBe(88);
    expect(ctx.krewSignals.matchReasons).toContain("Proche de la nature");
    expect(ctx.krewSignals.scoredActivityLabels).toContain("Canoë lac");

    // Day windows & mandatory needs
    expect(ctx.planning.dayWindows.length).toBeGreaterThan(0);
    expect(ctx.planning.maxActivitiesPerDay).toBe(2);
  });

  it("parse le planning principal et les backups dans un unique appel Gemini et conserve le detail", async () => {
    const originalFetch = global.fetch;
    let fetchCalls = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchCalls++;
      if (String(url).includes("googleapis.com")) {
        return {
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
                              slots: [
                                {
                                  id: "slot_1_1",
                                  kind: "place_required",
                                  momentType: "sport_outdoor",
                                  label: "Kayak sur le lac",
                                  detail: "Un moment rafraîchissant sur le lac parfait pour le groupe.",
                                  time: "14:00",
                                  durationMinutes: 120,
                                  locationContext: "external",
                                  canonicalVenueFamily: "sport",
                                  searchIntent: "kayak lac d'Annecy",
                                  suggestedPlace: "Club Nautique Annecy",
                                },
                              ],
                            },
                          ],
                          backups: [
                            {
                              id: "backup_1_1",
                              day: 1,
                              forSlot: "slot_1_1",
                              kind: "place_required",
                              momentType: "sport_outdoor",
                              label: "Paddle sur le lac",
                              detail: "Une belle alternative glisse sur l'eau.",
                              time: "14:00",
                              durationMinutes: 120,
                              locationContext: "external",
                              canonicalVenueFamily: "sport",
                              searchIntent: "paddle lac d'Annecy",
                              suggestedPlace: "Paddle Club",
                            },
                          ],
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
        };
      }
      return originalFetch(url);
    });

    try {
      const origKey = process.env["GEMINI_API_KEY"];
      process.env["GEMINI_API_KEY"] = "fake_key";
      const testInput = input({ latestGroupArrival: "10:00" });
      const skeleton = buildKrewSkeleton(testInput);
      const res = await geminiEnrichSkeleton(skeleton, testInput);

      expect(fetchCalls).toBe(1);
      expect(res.usedLlm).toBe(true);
      expect(res.enrichedSkeleton.days.length).toBeGreaterThan(0);

      const day1 = res.enrichedSkeleton.days[0];
      const kayakSlot = day1?.slots.find((s) => s.label === "Kayak sur le lac");
      expect(kayakSlot).toBeDefined();
      expect(kayakSlot?.detail).toBe("Un moment rafraîchissant sur le lac parfait pour le groupe.");

      // Backups conservés
      expect(res.enrichedSkeleton.backups).toBeDefined();
      expect(res.enrichedSkeleton.backups?.length).toBe(1);
      expect(res.enrichedSkeleton.backups?.[0]?.label).toBe("Paddle sur le lac");
      expect(res.enrichedSkeleton.backups?.[0]?.suggestedPlace).toBe("Paddle Club");
      process.env["GEMINI_API_KEY"] = origKey;
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("regenerateSlotWithAi réutilise un candidat du pool avant toute nouvelle requête externe", async () => {
    const poolCandidate = {
      id: "geo_1",
      name: "Canoë Club Annecy",
      address: "Lac d'Annecy",
      categories: ["sport.water"],
      latitude: 45.9,
      longitude: 6.1,
      website: "https://example.com/canoe",
    };

    const existingSlot = {
      moment: "Après-midi",
      type: "activite" as const,
      category: "sport_outdoor" as const,
      label: "Kayak sur le lac",
      detail: "Descriptif original",
      time: "14:00",
      durationMinutes: 90,
      venueFamily: "sport",
      searchIntent: "kayak lac annecy",
    };

    const { convertIntentToPlaceRequirements, buildPoolKey } = await import("../geoapify.server");
    const req = convertIntentToPlaceRequirements("sport", "sport_outdoor", "kayak lac annecy");
    const poolKey = buildPoolKey(req);

    const placePools = {
      [poolKey]: [poolCandidate],
    };

    const result = await regenerateSlotWithAi(
      input(),
      existingSlot,
      1,
      [],
      [],
      placePools,
      [],
      { latitude: 45.9, longitude: 6.1 },
    );

    expect(result.usedLlm).toBe(false);
    expect(result.slot.label).toBe("Canoë Club Annecy");
    expect(result.slot.candidateId).toBe("geo_1");
    expect(result.slot.verified).toBe(true);
    expect(result.updatedUsedIds).toContain("geo_1");
  });
});

describe("Micro-corrections PR #115 — Backups, Cohérence géographique, GeographyPolicy", () => {
  it("1. backup avec momentType='sport' -> sport_outdoor", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "sport", label: "Kayak", detail: "d", time: "14:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups?.[0]?.momentType).toBe("sport_outdoor");
  });

  it("2. backup avec momentType='gastronomie' -> repas", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "gastronomie", label: "Dégustation", detail: "d", time: "12:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups?.[0]?.momentType).toBe("repas");
  });

  it("3. backup avec type totalement inconnu -> backup ignoré", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [{ id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "type_totalement_inconnu_xyz", label: "Test", detail: "d", time: "14:00", durationMinutes: 90 }],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    expect(norm?.backups ?? []).toHaveLength(0);
  });

  it("4. aucune sortie backup avec momentType='activite'", () => {
    const raw = {
      days: [{ day: 1, slots: [{ id: "s1", kind: "internal", momentType: "repas", label: "Brunch", detail: "d", time: "10:00", durationMinutes: 60 }] }],
      backups: [
        { id: "b1", day: 1, forSlot: "s1", kind: "place_required", momentType: "sport", label: "A", detail: "d", time: "14:00", durationMinutes: 90 },
        { id: "b2", day: 1, forSlot: "s1", kind: "place_required", momentType: "gastronomie", label: "B", detail: "d", time: "14:00", durationMinutes: 90 },
        { id: "b3", day: 1, forSlot: "s1", kind: "place_required", momentType: "inconnu", label: "C", detail: "d", time: "14:00", durationMinutes: 90 },
      ],
    };
    const norm = normalizeGeminiParsedResponse(raw);
    const moments = (norm?.backups ?? []).map((b) => b.momentType);
    expect(moments).not.toContain("activite");
  });

  it("5. le prompt Gemini contient EXACTEMENT le nouveau bloc COHÉRENCE GÉOGRAPHIQUE", () => {
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("## COHÉRENCE GÉOGRAPHIQUE");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("Compose chaque journée comme un parcours géographiquement cohérent.");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("Ne suppose jamais que le groupe dispose d'une voiture si cette information n'est pas présente dans GROUP_PLANNING_CONTEXT.");
  });

  it("6, 7, 8, 9, 10. règles geographyPolicy et plafond dur 30 km", () => {
    // 6. city sans voiture -> maxKm = 10
    const cityInput = input({ tripProfile: "Découverte urbaine", ambiances: ["culture"], activityCategories: ["musée"], localMobility: "à pied" });
    const cityPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: "Point 12km", candidateId: "c12", latitude: 45.9, longitude: 6.25 }, // ~12 km
        ],
      },
    ];
    const c12 = { ...candidate, id: "c12", name: "Point 12km", latitude: 45.9, longitude: 6.25 };
    expect(haversineDistanceKm(candidate, c12)).toBeGreaterThan(11);
    expect(validateItinerary(cityPlan, cityInput, [candidate, c12])[0]?.slots).toHaveLength(1);

    // 7. logement / maison -> maxKm = 8
    const homeInput = input({ tripProfile: "Maison cocooning", ambiances: ["chill"], groupAccommodationRole: "centerpiece" });
    const homePlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: "Point 10km", candidateId: "c10", latitude: 45.9, longitude: 6.22 }, // ~10 km
        ],
      },
    ];
    const c10 = { ...candidate, id: "c10", name: "Point 10km", latitude: 45.9, longitude: 6.22 };
    expect(haversineDistanceKm(candidate, c10)).toBeGreaterThan(8.5);
    expect(validateItinerary(homePlan, homeInput, [candidate, c10])[0]?.slots).toHaveLength(1);

    // 8. voiture explicite -> maxKm = 30
    const carInput = input({ tripProfile: "City trip", ambiances: ["culture"], localMobility: "voiture de location" });
    const c20 = { ...candidate, id: "c20", name: "Point 20km", latitude: 45.9, longitude: 6.35 };
    expect(haversineDistanceKm(candidate, c20)).toBeLessThan(30);
    const carPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: c20.name, candidateId: c20.id },
        ],
      },
    ];
    expect(validateItinerary(carPlan, carInput, [candidate, c20])[0]?.slots).toHaveLength(2);

    // 9. outdoor -> maxKm = 30 & 10. candidat > 30 km rejeté même outdoor
    const outdoorInput = input({ tripProfile: "Randonnée & aventure", ambiances: ["nature", "sportif"] });
    const c35 = { ...candidate, id: "c35", name: "Point 35km", latitude: 46.25, longitude: 6.1 };
    expect(haversineDistanceKm(candidate, c35)).toBeGreaterThan(30);
    const outdoorPlan = [
      {
        day: 2,
        slots: [
          { moment: "Matin", time: "10:00", durationMinutes: 60, type: "activite" as const, label: candidate.name, candidateId: candidate.id },
          { moment: "Après-midi", time: "14:00", durationMinutes: 60, type: "activite" as const, label: c35.name, candidateId: c35.id },
        ],
      },
    ];
    expect(validateItinerary(outdoorPlan, outdoorInput, [candidate, c35])[0]?.slots).toHaveLength(1);
  });
});

describe("Correctifs PR #133 Grounding Geoapify — Tests Obligatoires 1 à 15", () => {
  it("TEST 1 : 'bistro tendance et convivial' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("bistro tendance et convivial")).toBeNull();
  });

  it("TEST 2 : 'café chaleureux pour petit-déjeuner' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("café chaleureux pour petit-déjeuner")).toBeNull();
  });

  it("TEST 3 : 'restaurant chic et festif' -> extractGeographicSignalFromIntent === null", () => {
    expect(extractGeographicSignalFromIntent("restaurant chic et festif")).toBeNull();
  });

  it("TEST 4 : 'restaurant dans le quartier juif' -> extrait la partie localisable", () => {
    const signal = extractGeographicSignalFromIntent("restaurant dans le quartier juif");
    expect(signal).toBe("quartier juif");
  });

  it("TEST 5 : 'visite du Bastion des Pêcheurs' -> signal localisable non-null", () => {
    const signal = extractGeographicSignalFromIntent("visite du Bastion des Pêcheurs");
    expect(signal).toBe("Bastion des Pêcheurs");
  });

  it("TEST 6 : Mock d'un résultat Geoapify hors destination -> resolveSearchIntentLocation === null", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 48.85,
              lon: 2.35,
              city: "Paris",
              formatted: "Paris, France",
              result_type: "locality",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 7 : Mock d'un résultat Geoapify cohérent avec la destination -> intentCenter accepté", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              lat: 47.50,
              lon: 19.06,
              city: "Budapest",
              formatted: "Erzsébetváros, Budapest, Hungary",
              result_type: "district",
            },
          },
        ],
      }),
    })) as any;

    try {
      const res = await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402);
      expect(res).not.toBeNull();
      expect(res?.latitude).toBe(47.50);
      expect(res?.longitude).toBe(19.06);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 8 : Même intent normalisé appelé deux fois -> 1 seul appel geocoding (cache)", async () => {
    clearIntentLocationCache();
    process.env["GEOAPIFY_API_KEY"] = "test-key";
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                lat: 47.50,
                lon: 19.06,
                city: "Budapest",
                formatted: "Budapest, Hungary",
                result_type: "district",
              },
            },
          ],
        }),
      };
    }) as any;

    try {
      const telemetry = { intentResolutionCalls: 0, intentResolutionHits: 0 };
      await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402, telemetry);
      await resolveSearchIntentLocation("quartier juif", "Budapest", 47.4979, 19.0402, telemetry);

      expect(fetchCount).toBe(1);
      expect(telemetry.intentResolutionCalls).toBe(1);
      expect(telemetry.intentResolutionHits).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("TEST 9 : 3 slots restaurant partageant les mêmes requirements de base mais 3 intentCenters -> keys séparées", () => {
    const req1 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier A", [], false, [], { latitude: 47.50, longitude: 19.06, label: "quartier A" });
    const req2 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier B", [], false, [], { latitude: 47.49, longitude: 19.03, label: "quartier B" });
    const req3 = convertIntentToPlaceRequirements("restaurant", "repas", "quartier C", [], false, [], { latitude: 47.51, longitude: 19.05, label: "quartier C" });

    const key1 = buildPoolKey(req1);
    const key2 = buildPoolKey(req2);
    const key3 = buildPoolKey(req3);

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
  });

  it("TEST 10 : Merge basePool + intentSupplement avec doublons -> dédupliqué", () => {
    const candA = { id: "p1", name: "Lieu A", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 47.5, longitude: 19.04, distanceMeters: 100, website: null, source: "geoapify" as const, verified: true };
    const candB = { id: "p2", name: "Lieu B", category: "catering.restaurant", categories: ["catering.restaurant"], address: null, latitude: 47.51, longitude: 19.05, distanceMeters: 200, website: null, source: "geoapify" as const, verified: true };

    const merged = mergeUniquePlacesById([candA], [candA, candB]);
    expect(merged).toHaveLength(2);
    expect(merged.map((x) => x.id)).toEqual(["p1", "p2"]);
  });

  it("TEST 11 : Candidat Geoapify vérifié avec website valide -> website conservé, fallbackMapLinks = 0", () => {
    const place = { name: "Kiosk Buda", website: "https://kioskbuda.hu", address: "Budapest, Fő utca 1", latitude: 47.5, longitude: 19.04 };
    const telemetry = { fallbackMapLinks: 0 };
    const res = resolveActivityResourceForPlace(place, "Budapest", { telemetry });

    expect(res.url).toBe("https://kioskbuda.hu");
    expect(res.resourceKind).toBe("website");
    expect(telemetry.fallbackMapLinks).toBe(0);
  });

  it("TEST 12 : Candidat Geoapify vérifié sans website -> fallback Google Maps déterministe, fallbackMapLinks = 1", () => {
    const place = { name: "Kiosk Buda", website: null, address: "Budapest, Fő utca 1", latitude: 47.5, longitude: 19.04 };
    const telemetry = { fallbackMapLinks: 0 };
    const res = resolveActivityResourceForPlace(place, "Budapest", { telemetry });

    expect(res.url).toBe("https://www.google.com/maps/search/?api=1&query=Kiosk%20Buda%2C%20Budapest%2C%20F%C5%91%20utca%201");
    expect(res.resourceKind).toBe("website");
    expect(telemetry.fallbackMapLinks).toBe(1);
  });

  it("TEST 13 : URL Google Maps arbitraire donnée directement à resolveActivityResourceUrl sans flag verified -> rejetée", () => {
    const res = resolveActivityResourceUrl("https://www.google.com/maps/search/?api=1&query=Arbitrary");
    expect(res.url).toBeNull();
    expect(res.resourceKind).toBeNull();
  });

  it("TEST 14 : place_required conserve son comportement grounded", () => {
    const { shouldResolveWithPlaceProvider } = require("../activity-ai.server");
    expect(shouldResolveWithPlaceProvider({ kind: "place_required", activityMode: "bookable" })).toBe(true);
  });

  it("TEST 15 : free_exploration et self_guided_group conservent leur comportement actuel", () => {
    const { classifyActivityMode } = require("../activity-ai.server");
    expect(classifyActivityMode({ kind: "internal", category: "jeu_groupe", label: "Blind test" })).toBe("self_guided_group");
    expect(classifyActivityMode({ kind: "place_required", category: "culture", label: "Balade dans le centre historique" })).toBe("free_exploration");
  });
});
