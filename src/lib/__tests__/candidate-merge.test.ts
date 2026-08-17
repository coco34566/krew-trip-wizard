import { describe, expect, it } from "vitest";
import {
  aiCandidateToDestinationRow,
  buildDestinationDiscoveryPool,
  mergeCandidates,
  normCity,
  type AiEstimate,
} from "../krew/candidate-merge";
import type { CandidateDestination } from "../krew/destination-discovery.server";
import {
  buildDestinationProposals,
  evaluateDestinationHardConstraints,
  type DestinationRecord,
  type ScoringContext,
} from "../krew/engine";

const rule: CandidateDestination[] = [
  { name: "Lisbonne", country: "Portugal", distanceKm: 1450, affinity: 80, reason: "ambiance" },
];

const ai: AiEstimate[] = [
  {
    name: "lisbonne",
    affinity: 92,
    reason: "IA",
    dailyCost: 88,
    distanceKm: 1400,
    bestMonths: [5, 6],
  },
  {
    name: "Tbilissi",
    country: "Géorgie",
    affinity: 70,
    reason: "hors sentiers",
    dailyCost: 45,
    distanceKm: 3300,
    bestMonths: [5, 9],
  },
];

describe("mergeCandidates", () => {
  it("déduplique par nom normalisé et conserve les deux provenances", () => {
    const merged = mergeCandidates(rule, ai);
    expect(merged).toHaveLength(2);
    const lisbonne = merged.find((c) => normCity(c.name) === "lisbonne")!;
    expect(lisbonne.source).toBe("catalog");
    expect(lisbonne.provenance).toEqual(["local", "gemini"]);
    expect(lisbonne.affinity).toBe(92);
    expect(lisbonne.bestMonths).toEqual([5, 6]);
  });

  it("conserve les villes IA absentes du catalogue en ai_estimate", () => {
    const merged = mergeCandidates(rule, ai);
    const tbi = merged.find((c) => normCity(c.name) === "tbilissi")!;
    expect(tbi.source).toBe("ai_estimate");
    expect(tbi.provenance).toEqual(["gemini"]);
    expect(tbi.dailyCost).toBe(45);
  });

  it("trie par affinité décroissante", () => {
    const merged = mergeCandidates(rule, ai);
    expect(merged[0]!.affinity).toBeGreaterThanOrEqual(merged[1]!.affinity);
  });
});

describe("aiCandidateToDestinationRow", () => {
  it("ne fabrique aucune valeur de scoring quand l'estimation manque", () => {
    const row = aiCandidateToDestinationRow({
      name: "Tbilissi",
      affinity: 70,
      reason: "IA",
      source: "ai_estimate",
      provenance: ["gemini"],
    });
    expect(row.rating).toBeNull();
    expect(row.popularity).toBeNull();
    expect(row.avg_daily_cost).toBeNull();
    expect(row.distance_from_paris_km).toBeNull();
    expect(row.slug).toBe("tbilissi");
    expect(row.source).toBe("ai_estimate");
  });

  it("ne transforme pas les ambiances demandées en scores factuels", () => {
    const row = aiCandidateToDestinationRow(
      {
        name: "Tbilissi",
        affinity: 70,
        reason: "IA",
        source: "ai_estimate",
        provenance: ["gemini"],
        bestMonths: [5, 13, 0, 9],
      },
      ["fete", "insolite"],
    );
    expect(row.score_fete).toBeNull();
    expect(row.score_insolite).toBeNull();
    expect(row.score_luxe).toBeNull();
    expect(row.best_months).toEqual([5, 9]);
  });

  it("privilégie les mois issus de la météo réelle", () => {
    const row = aiCandidateToDestinationRow(
      {
        name: "Tbilissi",
        affinity: 70,
        reason: "IA",
        source: "ai_estimate",
        provenance: ["gemini"],
        bestMonths: [5],
      },
      [],
      { bestMonths: [6, 7, 8] },
    );
    expect(row.best_months).toEqual([6, 7, 8]);
  });

  it("persiste les estimations exploratoires sans les marquer vérifiées", () => {
    const row = aiCandidateToDestinationRow({
      name: "Tbilissi",
      affinity: 70,
      reason: "IA",
      source: "ai_estimate",
      provenance: ["gemini"],
      dailyCost: 55,
      distanceKm: 3200,
      verificationState: "estimated",
    });
    expect(row.avg_daily_cost).toBe(55);
    expect(row.distance_from_paris_km).toBe(3200);
    expect(row.verification_state).toBe("estimated");
  });
});

describe("Gemini candidates at the KREW scoring boundary", () => {
  const candidate = aiCandidateToDestinationRow({
    name: "Annecy",
    country: "France",
    affinity: 85,
    reason: "lac et ville",
    source: "ai_estimate",
    provenance: ["gemini"],
    dailyCost: 90,
    distanceKm: 560,
    bestMonths: [6, 7, 9],
    verificationState: "estimated",
  });
  const destination: DestinationRecord = {
    id: "annecy-ai",
    description: "Estimation exploratoire Gemini",
    image_url: null,
    ...candidate,
    avg_daily_cost: candidate.avg_daily_cost ?? 90,
    distance_from_paris_km: candidate.distance_from_paris_km ?? 560,
    popularity: 0.5,
    rating: 0,
    score_fete: 0.5,
    score_aventure: 0.5,
    score_detente: 0.7,
    score_luxe: 0.5,
    score_insolite: 0.5,
    score_sportif: 0.6,
    score_culturel: 0.6,
  };
  const baseContext: ScoringContext = {
    participants: 4,
    nights: 2,
    budgetPerPerson: 600,
    ambiances: ["detente"],
    activityCategories: ["nature"],
    maxDistanceKm: 1000,
    excludedCountries: [],
    startMonth: 6,
    transportModes: ["train"],
    individualPreferences: [],
    letKrewDecide: true,
    needsCityCenter: false,
  };

  it("lets a compatible new Gemini destination enter normal KREW scoring", () => {
    const proposals = buildDestinationProposals(
      { destinations: [destination], accommodations: [], activities: [] },
      baseContext,
      4,
    );
    expect(proposals[0]?.destination.name).toBe("Annecy");
  });

  it("eliminates a Gemini destination that violates a KREW hard constraint", () => {
    const proposals = buildDestinationProposals(
      { destinations: [destination], accommodations: [], activities: [] },
      { ...baseContext, excludedCountries: ["France"] },
      4,
    );
    expect(proposals).toHaveLength(0);
  });

  it("scores a destination without inventory even when hotel criteria exist", () => {
    const proposals = buildDestinationProposals(
      { destinations: [destination], accommodations: [], activities: [] },
      { ...baseContext, requiredAmenities: ["pool"], minAccommodationRating: 4.5 },
      4,
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.accommodation).toBeNull();
    expect(proposals[0]?.activities).toEqual([]);
  });

  it("does not use the Paris proxy as a hard constraint for a Lyon origin", () => {
    const evaluation = evaluateDestinationHardConstraints(
      { ...destination, distance_from_paris_km: 5_000 },
      { ...baseContext, departureOrigins: [{ city: "Lyon", count: 4 }], maxDistanceKm: 800 },
    );
    expect(evaluation).toEqual({ accepted: true, reasons: [] });
  });

  it("returns deterministic hard rejection reasons", () => {
    const evaluation = evaluateDestinationHardConstraints(destination, {
      ...baseContext,
      excludedCountries: ["France"],
    });
    expect(evaluation).toEqual({ accepted: false, reasons: ["excluded_country"] });
  });

  it("keeps all local fallback candidates when the catalogue is empty", () => {
    const local = ["Luberon", "Côte basque", "Bourgogne"].map((name, index) => ({
      name,
      country: "France",
      affinity: 90 - index,
      reason: "fallback local",
      distanceKm: 400 + index * 50,
    }));
    const merged = mergeCandidates(local, []);
    const pool = buildDestinationDiscoveryPool(merged, []);
    const evaluations = pool.destinations.map((item) =>
      evaluateDestinationHardConstraints(item, {
        ...baseContext,
        departureOrigins: [{ city: "Lyon", count: 4 }],
      }),
    );
    expect(merged).toHaveLength(3);
    expect(pool.destinations).toHaveLength(3);
    expect(evaluations).toHaveLength(3);
    expect(
      evaluations.filter((result) => result.accepted).length +
        evaluations.filter((result) => !result.accepted).length,
    ).toBe(3);
  });

  it.each([
    { label: "local", provenance: ["local"] as Array<"local" | "gemini"> },
    { label: "Gemini", provenance: ["gemini"] as Array<"local" | "gemini"> },
  ])("scores a $label candidate absent from the catalogue", ({ provenance }) => {
    const pool = buildDestinationDiscoveryPool(
      [
        {
          name: "Val d'Aoste",
          country: "Italie",
          affinity: 80,
          reason: "discovery",
          source: provenance.includes("gemini") ? "ai_estimate" : "catalog",
          provenance,
          dailyCost: 75,
          distanceKm: 300,
          bestMonths: [6, 9],
        },
      ],
      [],
    );
    const proposals = buildDestinationProposals(
      { destinations: pool.destinations, accommodations: [], activities: [] },
      { ...baseContext, departureOrigins: [{ city: "Lyon", count: 4 }] },
      4,
    );
    expect(pool.destinations).toHaveLength(1);
    expect(proposals[0]?.destination.name).toBe("Val d'Aoste");
    expect(pool.provenanceByName.get("val d'aoste")).toEqual(provenance);
  });

  it("keeps verified catalogue data while filling missing discovery metadata", () => {
    const merged = mergeCandidates(rule, ai);
    const pool = buildDestinationDiscoveryPool(merged, [
      { ...destination, name: "Lisbonne", country: "Portugal", avg_daily_cost: 120 },
    ]);
    const lisboa = pool.destinations.find((item) => normCity(item.name) === "lisbonne")!;
    expect(lisboa.avg_daily_cost).toBe(120);
    expect(pool.provenanceByName.get("lisbonne")).toEqual(["local", "gemini"]);
  });
});
