import { describe, expect, it } from "vitest";
import {
  buildDiscoveryQueries,
  isSafeActivityUrl,
  type ActivityCandidate,
} from "../activity-discovery.server";
import {
  buildLocalItinerary,
  calculatePlanningWindow,
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
  verifiedAt: "2026-08-16T00:00:00.000Z",
  groundingSources: [],
};

describe("contraintes déterministes du planning", () => {
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
