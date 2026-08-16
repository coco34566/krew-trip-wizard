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
  type ActivityAiInput,
} from "../activity-ai.server";

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

describe("vérification grounding", () => {
  const payload = (
    sourceUrl: string,
    groundingUrl: string,
    groundingTitle = "Club Nautique Annecy",
  ) => ({
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                candidates: [{ name: "Club Nautique Annecy", category: "kayak", sourceUrl }],
              }),
            },
          ],
        },
        groundingMetadata: {
          groundingChunks: [{ web: { title: groundingTitle, uri: groundingUrl } }],
        },
      },
    ],
  });

  it("ne vérifie pas une URL HTTPS absente du grounding", () => {
    expect(
      normalizeSearchCandidates(
        payload(
          "https://unrelated.example/activity",
          "https://tourism.example/other",
          "Agenda touristique régional",
        ),
        input(),
      ),
    ).toHaveLength(0);
  });

  it("vérifie une source réellement liée au candidat", () => {
    const candidates = normalizeSearchCandidates(
      payload("https://nautique.example/annecy", "https://nautique.example/annecy"),
      input(),
    );
    expect(candidates[0]?.verified).toBe(true);
    expect(candidates[0]?.groundingSources).toHaveLength(1);
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
