import { describe, expect, it } from "vitest";
import {
  aiCandidateToDestinationRow,
  mergeCandidates,
  normCity,
  type AiEstimate,
} from "../krew/candidate-merge";
import type { CandidateDestination } from "../krew/destination-discovery.server";

const rule: CandidateDestination[] = [
  { name: "Lisbonne", country: "Portugal", distanceKm: 1450, affinity: 80, reason: "ambiance locale" },
];

const ai: AiEstimate[] = [
  {
    name: "Lisbonne",
    country: "Portugal",
    affinity: 92,
    reason: "IA",
    why: "Ville animée et région côtière à explorer",
    destinationType: "region_territory",
    region: "Lisbonne",
    anchorPlaces: ["Lisbonne", "Cascais"],
    activityFit: ["bars_clubs", "culture"],
    environmentFit: ["ville", "mer"],
    accommodationFit: ["citybreak"],
  },
  {
    name: "Tbilissi",
    country: "Géorgie",
    affinity: 70,
    reason: "hors sentiers",
    destinationType: "city",
    anchorPlaces: ["Tbilissi"],
  },
];

describe("mergeCandidates", () => {
  it("déduplique par nom normalisé en gardant Gemini comme base sémantique", () => {
    const merged = mergeCandidates(rule, ai);
    expect(merged).toHaveLength(2);
    const lisbonne = merged.find((c) => normCity(c.name) === "lisbonne")!;
    expect(lisbonne.source).toBe("merged");
    expect(lisbonne.affinity).toBe(92);
    expect(lisbonne.reason).toBe("IA");
    expect(lisbonne.why).toBe("Ville animée et région côtière à explorer");
    expect(lisbonne.destinationType).toBe("region_territory");
    expect(lisbonne.anchorPlaces).toEqual(["Lisbonne", "Cascais"]);
    expect(lisbonne.activityFit).toEqual(["bars_clubs", "culture"]);
    expect(lisbonne.distanceKm).toBe(1450);
  });

  it("fusionne un territoire Gemini avec la destination locale présente dans ses anchors", () => {
    const merged = mergeCandidates(rule, [
      {
        name: "Lisbonne & Riviera de Cascais",
        country: "Portugal",
        affinity: 94,
        reason: "IA territoire",
        why: "Lisbonne pour l'animation, Cascais pour le littoral",
        destinationType: "region_territory",
        region: "Région de Lisbonne",
        anchorPlaces: ["Lisbonne", "Cascais", "Sintra"],
        activityFit: ["bars_clubs", "culture", "plage"],
        environmentFit: ["ville", "mer"],
        accommodationFit: ["citybreak", "villa"],
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: "Lisbonne & Riviera de Cascais",
      source: "merged",
      affinity: 94,
      reason: "IA territoire",
      region: "Région de Lisbonne",
      destinationType: "region_territory",
      distanceKm: 1450,
      anchorPlaces: ["Lisbonne", "Cascais", "Sintra"],
      activityFit: ["bars_clubs", "culture", "plage"],
    });
  });

  it("fusionne Annecy & Le Lac avec Annecy via les anchors sans appauvrir Gemini", () => {
    const localAnnecy: CandidateDestination[] = [
      { name: "Annecy", country: "France", distanceKm: 540, affinity: 70, reason: "catalogue" },
    ];
    const geminiAnnecy: AiEstimate[] = [
      {
        name: "Annecy & Le Lac",
        country: "France",
        affinity: 88,
        reason: "IA lac",
        why: "Ville, lac et territoire outdoor",
        destinationType: "outdoor_area",
        region: "Haute-Savoie",
        anchorPlaces: ["Annecy", "Talloires", "Doussard"],
        activityFit: ["nautique", "randonnée"],
        environmentFit: ["lac", "montagne"],
        accommodationFit: ["nature_stay"],
      },
    ];

    const merged = mergeCandidates(localAnnecy, geminiAnnecy);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      name: "Annecy & Le Lac",
      source: "merged",
      reason: "IA lac",
      destinationType: "outdoor_area",
      region: "Haute-Savoie",
      distanceKm: 540,
      anchorPlaces: ["Annecy", "Talloires", "Doussard"],
      activityFit: ["nautique", "randonnée"],
      environmentFit: ["lac", "montagne"],
    });
  });

  it("conserve les villes Gemini absentes du catalogue", () => {
    const merged = mergeCandidates(rule, ai);
    const tbi = merged.find((c) => normCity(c.name) === "tbilissi")!;
    expect(tbi.source).toBe("gemini");
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
      source: "gemini",
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
      { name: "Tbilissi", affinity: 70, reason: "IA", source: "gemini", bestMonths: [5, 13, 0, 9] },
      ["fete", "insolite"],
    );
    expect(row.score_fete).toBeNull();
    expect(row.score_insolite).toBeNull();
    expect(row.score_luxe).toBeNull();
    expect(row.best_months).toEqual([5, 9]);
  });

  it("privilégie les mois issus de la météo réelle", () => {
    const row = aiCandidateToDestinationRow(
      { name: "Tbilissi", affinity: 70, reason: "IA", source: "gemini", bestMonths: [5] },
      [],
      { bestMonths: [6, 7, 8] },
    );
    expect(row.best_months).toEqual([6, 7, 8]);
  });
});
