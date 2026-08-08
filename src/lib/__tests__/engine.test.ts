import { describe, it, expect } from "vitest";
import {
  buildProposals,
  selectDiverseTop,
  type TravelCatalog,
  type ScoringContext,
  type DestinationRecord,
} from "../krew/engine";

// Helper to create a minimal valid destination
const mockDestination = (overrides: Partial<DestinationRecord> = {}): DestinationRecord => ({
  id: "dest-1",
  slug: "paris",
  name: "Paris",
  country: "France",
  description: "La ville lumière",
  image_url: null,
  avg_daily_cost: 100,
  distance_from_paris_km: 10,
  popularity: 0.9,
  rating: 4.5,
  best_months: [5, 6, 9],
  score_fete: 0.8,
  score_aventure: 0.3,
  score_detente: 0.4,
  score_luxe: 0.7,
  score_insolite: 0.5,
  score_sportif: 0.4,
  score_culturel: 0.9,
  ...overrides,
});

describe("Moteur de scoring Krew (engine.ts)", () => {
  it("calcule correctement les sous-scores (SubScores) et le score final", () => {
    const catalog: TravelCatalog = {
      destinations: [mockDestination()],
      activities: [
        {
          id: "act-1",
          destination_id: "dest-1",
          name: "Louvre",
          category: "culture",
          description: "Musée",
          price_per_person: 15,
          duration_hours: 2,
          rating: 4.8,
          image_url: null,
        },
      ],
      accommodations: [
        {
          id: "acc-1",
          destination_id: "dest-1",
          name: "Hôtel Paris",
          type: "hôtel",
          description: "Hôtel sympa",
          price_per_night_per_person: 60,
          capacity: 4,
          rating: 4.2,
          distance_center_km: 1.5,
          image_url: null,
        },
      ],
    };

    const ctx: ScoringContext = {
      participants: 2,
      budgetPerPerson: 500,
      nights: 2,
      letKrewDecide: true,
      needsCityCenter: true,
      startMonth: 6, // Juin (dans les best_months de Paris [5, 6, 9])
      ambiances: ["culturel"],
      activityCategories: ["culture"],
      maxDistanceKm: 1000,
      excludedCountries: [],
      individualPreferences: [
        {
          ambiances: ["culturel"],
          activityCategories: ["culture"],
          budgetMax: 500,
          dealBreakerAmbiances: [],
          dealBreakerDestinations: [],
        },
      ],
    };

    const proposals = buildProposals(catalog, ctx, 1);
    expect(proposals).toHaveLength(1);

    const proposal = proposals[0]!;
    expect(proposal.destination.name).toBe("Paris");

    // Vérification des sous-scores
    expect(proposal.subScores).toBeDefined();
    expect(proposal.subScores.sAmbiance).toBeGreaterThan(0.5);
    expect(proposal.subScores.sActivities).toBe(1.0); // culture est disponible et demandée
    expect(proposal.subScores.sSeason).toBe(1.0); // Juin est un best_month
    expect(proposal.subScores.sQuality).toBeGreaterThan(0.5);

    // Le score final doit être cohérent et clampé entre 0 et 100
    expect(proposal.score).toBeGreaterThanOrEqual(0);
    expect(proposal.score).toBeLessThanOrEqual(100);
  });

  it("diversifie correctement le top des propositions (selectDiverseTop)", () => {
    const buildMockProposal = (
      id: string,
      name: string,
      country: string,
      ambiance: "fete" | "detente",
      budget: number,
      score: number
    ) => ({
      destination: mockDestination({
        id,
        name,
        country,
        score_fete: ambiance === "fete" ? 1.0 : 0.1,
        score_detente: ambiance === "detente" ? 1.0 : 0.1,
      }),
      accommodation: null,
      activities: [],
      score,
      rationale: "",
      matchReasons: [],
      itinerary: [],
      budget: {
        transport: 100,
        transportGroup: 200,
        accommodation: 100,
        activities: 50,
        food: 50,
        totalPerPerson: budget,
        totalGroup: budget * 2,
        budgetPerPerson: 500,
        fits: true,
        hardBudgetFits: true,
        budgetFitCount: 2,
        budgetFitTotal: 2,
      },
      consensusScore: 0.8,
      minSatisfaction: 0.8,
      satisfiedCount: 2,
      participantsEvaluated: 2,
      subScores: {
        sAmbiance: 0.8,
        sActivities: 0.8,
        sBudget: 0.8,
        sDistance: 0.8,
        sSeason: 0.8,
        sQuality: 0.8,
        sConsensus: 0.8,
        sMinSatisfaction: 0.8,
      },
    });

    // 4 propositions, l'une très similaire à l'autre (Barcelone et Madrid en Espagne, toutes deux fete)
    const sortedProposals = [
      buildMockProposal("1", "Barcelone", "Espagne", "fete", 300, 95),
      buildMockProposal("2", "Madrid", "Espagne", "fete", 310, 93), // Très similaire à Barcelone
      buildMockProposal("3", "Reykjavik", "Islande", "detente", 450, 90), // Pays différent, ambiance différente
      buildMockProposal("4", "Rome", "Italie", "detente", 280, 88), // Pays différent, budget différent
    ];

    // selectDiverseTop de taille 2
    const diverse = selectDiverseTop(sortedProposals, 2);

    expect(diverse).toHaveLength(2);
    // Le premier doit être Barcelone (meilleur score)
    expect(diverse[0]!.destination.name).toBe("Barcelone");
    // Le deuxième devrait être Reykjavik ou Rome (car Madrid est trop similaire à Barcelone, MMR le pénalise)
    expect(diverse[1]!.destination.name).not.toBe("Madrid");
  });

  describe("Cas limites (edge cases)", () => {
    it("gère correctement le cas où aucun participant n'a encore répondu", () => {
      const catalog: TravelCatalog = {
        destinations: [mockDestination()],
        activities: [],
        accommodations: [],
      };

      const ctx: ScoringContext = {
        participants: 2,
        budgetPerPerson: 500,
        nights: 2,
        letKrewDecide: true,
        needsCityCenter: true,
        startMonth: 6,
        ambiances: [],
        activityCategories: [],
        maxDistanceKm: 1000,
        excludedCountries: [],
        individualPreferences: [], // Aucun questionnaire rempli
      };

      const proposals = buildProposals(catalog, ctx, 3);
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.score).toBeGreaterThan(0);
      expect(proposals[0]!.consensusScore).toBe(0.65); // Valeur par défaut
    });

    it("gère correctement le cas d'un budget individuel ou collectif à zéro ou très faible", () => {
      const catalog: TravelCatalog = {
        destinations: [mockDestination()],
        activities: [],
        accommodations: [],
      };

      const ctx: ScoringContext = {
        participants: 2,
        budgetPerPerson: 0, // Budget à zéro !
        nights: 2,
        letKrewDecide: true,
        needsCityCenter: true,
        startMonth: 6,
        ambiances: [],
        activityCategories: [],
        maxDistanceKm: 1000,
        excludedCountries: [],
        individualPreferences: [
          {
            ambiances: [],
            activityCategories: [],
            budgetMax: 0,
            dealBreakerAmbiances: [],
            dealBreakerDestinations: [],
          },
        ],
      };

      const proposals = buildProposals(catalog, ctx, 3);
      expect(proposals).toHaveLength(1);
      // Le budget à 0 doit générer une pénalité, mais ne pas planter le code
      expect(proposals[0]!.budget.fits).toBe(false);
      expect(proposals[0]!.score).toBeLessThan(50);
    });

    it("gère correctement le cas où il n'y a qu'une seule destination candidate", () => {
      const catalog: TravelCatalog = {
        destinations: [mockDestination({ name: "Seul Au Monde" })],
        activities: [],
        accommodations: [],
      };

      const ctx: ScoringContext = {
        participants: 2,
        budgetPerPerson: 500,
        nights: 2,
        letKrewDecide: true,
        needsCityCenter: true,
        startMonth: 6,
        ambiances: [],
        activityCategories: [],
        maxDistanceKm: 1000,
        excludedCountries: [],
        individualPreferences: [],
      };

      const proposals = buildProposals(catalog, ctx, 3);
      expect(proposals).toHaveLength(1);
      expect(proposals[0]!.destination.name).toBe("Seul Au Monde");
    });
  });
});
