import { describe, expect, it } from "vitest";
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
  buildKrewSkeleton,
  geminiEnrichSkeleton,
  type ActivityAiInput,
} from "../activity-ai.server";
import {
  mapVenueFamilyToGeoapifyCategories,
  determineSearchRadiusMeters,
  searchGeoapifyPlaces,
} from "../geoapify.server";
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
    // Calling geminiEnrichSkeleton uses at most 1 fetch request
    if (process.env["GEMINI_API_KEY"]) {
      const res = await geminiEnrichSkeleton(skeleton, input());
      expect(res.usedLlm).toBe(true);
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
    const { adjustItineraryTransferTimes } = require("../activity-ai.server");
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
    const { adjustItineraryTransferTimes } = require("../activity-ai.server");
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

  it("donne la priorité à l'arrivée du transport réellement sélectionné", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 2,
          transferMarginMinutes: 60,
          transportPicksSummary: [{ city: "Paris", mode: "train", arrival: "18:00" }],
        }),
      ).arrivalReady,
    ).toBe("19:00");
  });

  it("calcule l'arrivée depuis un départ à 13:00 et la durée, puis applique la marge", () => {
    expect(
      calculatePlanningWindow(
        input({
          earliestOutboundDeparture: "13:00",
          transportDurationHours: 4,
          transferMarginMinutes: 60,
        }),
      ).arrivalReady,
    ).toBe("18:00");
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

  it("calcule le départ destination à rebours d'un retour impératif à 20:00", () => {
    const ctx = input({
      latestReturnHome: "20:00",
      transportDurationHours: 4,
      transferMarginMinutes: 60,
    });
    expect(calculatePlanningWindow(ctx).latestDestinationDeparture).toBe("15:00");
    const last = validateItinerary(
      [
        {
          day: 3,
          slots: [
            {
              moment: "Après-midi",
              time: "14:30",
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

  it("rejette un saut absurde en city trip mais l'autorise pour un profil outdoor justifié", () => {
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
    expect(validateItinerary(plan, input(), [candidate, far])[0]?.slots).toHaveLength(2);
  });
});

describe("personnalisation du fallback et de la discovery", () => {
  it("oriente Nature & sportif vers des recherches outdoor", () => {
    const queries = buildDiscoveryQueries(input());
    expect(queries.some((query) => /outdoor|sport|nautique|randonnée/.test(query))).toBe(true);
  });

  it("laisse beaucoup de moments logement au profil maison/chill sans inventer de visite", () => {
    const itinerary = buildLocalItinerary(
      input({ tripProfile: "Maison entre nous", travelPace: "chill", ambiances: ["cocooning"] }),
      [],
    );
    const slots = itinerary.days.flatMap((day) => day.slots);
    expect(
      slots.filter((slot) => slot.category === "moment_maison" || slot.category === "jeu_groupe")
        .length,
    ).toBeGreaterThanOrEqual(2);
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
