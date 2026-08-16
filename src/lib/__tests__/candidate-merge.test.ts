import { describe, expect, it } from "vitest";
import {
  aiCandidateToDestinationRow,
  mergeCandidates,
  normCity,
  type AiEstimate,
} from "../krew/candidate-merge";
import type { CandidateDestination } from "../krew/destination-discovery.server";

const rule: CandidateDestination[] = [
  { name: "Lisbonne", country: "Portugal", distanceKm: 1450, affinity: 80, reason: "ambiance" },
];

const ai: AiEstimate[] = [
  { name: "lisbonne", affinity: 92, reason: "IA", dailyCost: 88, distanceKm: 1400, bestMonths: [5, 6] },
  { name: "Tbilissi", country: "Géorgie", affinity: 70, reason: "hors sentiers", dailyCost: 45, distanceKm: 3300, bestMonths: [5, 9] },
];

describe("mergeCandidates", () => {
  it("déduplique par nom normalisé et garde la source catalogue", () => {
    const merged = mergeCandidates(rule, ai);
    expect(merged).toHaveLength(2);
    const lisbonne = merged.find((c) => normCity(c.name) === "lisbonne")!;
    expect(lisbonne.source).toBe("catalog");
    expect(lisbonne.affinity).toBe(92);
    expect(lisbonne.bestMonths).toEqual([5, 6]);
  });

  it("conserve les villes IA absentes du catalogue en ai_estimate", () => {
    const merged = mergeCandidates(rule, ai);
    const tbi = merged.find((c) => normCity(c.name) === "tbilissi")!;
    expect(tbi.source).toBe("ai_estimate");
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
      { name: "Tbilissi", affinity: 70, reason: "IA", source: "ai_estimate", bestMonths: [5, 13, 0, 9] },
      ["fete", "insolite"],
    );
    expect(row.score_fete).toBeNull();
    expect(row.score_insolite).toBeNull();
    expect(row.score_luxe).toBeNull();
    expect(row.best_months).toEqual([5, 9]);
  });

  it("privilégie les mois issus de la météo réelle", () => {
    const row = aiCandidateToDestinationRow(
      { name: "Tbilissi", affinity: 70, reason: "IA", source: "ai_estimate", bestMonths: [5] },
      [],
      { bestMonths: [6, 7, 8] },
    );
    expect(row.best_months).toEqual([6, 7, 8]);
  });
});
