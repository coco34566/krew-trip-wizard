import { describe, expect, it } from "vitest";
import type { Proposal } from "../engine";
import { buildDestinationPresentation } from "../rationale-llm.server";

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    destination: {
      id: "dest-1",
      slug: "annecy",
      name: "Annecy",
      country: "France",
      description: null,
      image_url: null,
      avg_daily_cost: 75,
      distance_from_paris_km: 560,
      popularity: 0.8,
      rating: 4.7,
      best_months: [5, 6, 7, 8, 9],
      score_fete: 0.3,
      score_aventure: 0.7,
      score_detente: 0.8,
      score_luxe: 0.4,
      score_insolite: 0.5,
      score_sportif: 0.7,
      score_culturel: 0.6,
      env_tags: ["Lac & montagne", "Centre accessible à pied"],
    },
    accommodation: null,
    activities: [
      {
        id: "act-1",
        destination_id: "dest-1",
        name: "Balade au bord du lac",
        category: "nature",
        description: null,
        price_per_person: 0,
        duration_hours: 2,
        rating: 4.8,
        image_url: null,
      },
    ],
    score: 78,
    rationale: "Bon équilibre pour le groupe",
    matchReasons: ["Cadre nature", "Activités outdoor"],
    itinerary: [],
    budget: {
      transport: 80,
      transportGroup: 320,
      accommodation: 120,
      activities: 40,
      food: 80,
      totalPerPerson: 320,
      totalGroup: 1280,
      budgetPerPerson: 400,
      fits: true,
      hardBudgetFits: true,
      budgetFitCount: 4,
      budgetFitTotal: 4,
    },
    consensusScore: 0.82,
    minSatisfaction: 0.7,
    satisfiedCount: 4,
    participantsEvaluated: 4,
    subScores: {
      sAmbiance: 0.72,
      sActivities: 0.86,
      sBudget: 0.8,
      sDistance: 0.65,
      sTransport: 0.7,
      sSeason: 0.9,
      sQuality: 0.85,
      sConsensus: 0.82,
      sMinSatisfaction: 0.7,
      sEnvironment: 0.95,
    },
    ...overrides,
  };
}

describe("buildDestinationPresentation", () => {
  it.each([
    [92, 5, "Excellent choix"],
    [78, 4, "Très bon choix"],
    [62, 3, "Bon choix"],
    [45, 2, "Choix plus mitigé"],
    [30, 1, "Peu adapté"],
  ])("convertit %s en niveau %s", (score, level, label) => {
    const result = buildDestinationPresentation(proposal({ score }));
    expect(result.compatibilityLevel).toBe(level);
    expect(result.compatibilityLabel).toBe(label);
  });

  it("écarte tout commentaire lié au logement", () => {
    const result = buildDestinationPresentation(proposal(), {
      generatedSummary: "Un hôtel central et des chambres pratiques pour le groupe",
      generatedSignals: ["Hôtel bien placé", "Lac & montagne", "Balades"],
    });

    expect(result.summary.toLowerCase()).not.toMatch(/hôtel|hotel|hébergement|logement|chambre/);
    expect(result.signals.join(" ").toLowerCase()).not.toMatch(/hôtel|hotel|hébergement|logement|chambre/);
  });

  it("préfère une phrase concrète et spécifique à la destination", () => {
    const result = buildDestinationPresentation(proposal(), {
      generatedSummary: "Annecy ressort pour son lac, ses balades faciles et son cadre alpin.",
      generatedSignals: ["Lac & montagne", "Balades", "Cadre alpin"],
    });

    expect(result.summary).toContain("Annecy");
    expect(result.signals).toEqual(["Lac & montagne", "Balades", "Cadre alpin"]);
  });

  it("affiche visuellement cinq positions de compatibilité", () => {
    const result = buildDestinationPresentation(proposal({ score: 78 }));
    expect(result.displayText).toContain("● ● ● ● ○");
    expect(result.displayText).toContain("Très bon choix");
  });

  it("ajoute le badge qualité-prix uniquement quand demandé", () => {
    expect(buildDestinationPresentation(proposal(), { bestValue: true }).displayText).toContain(
      "Meilleur rapport qualité-prix",
    );
    expect(buildDestinationPresentation(proposal(), { bestValue: false }).displayText).not.toContain(
      "Meilleur rapport qualité-prix",
    );
  });
});
