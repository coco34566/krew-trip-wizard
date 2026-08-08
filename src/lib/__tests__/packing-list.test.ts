import { describe, it, expect } from "vitest";
import { buildPackingList } from "../krew/packing-list";

describe("Liste de valise (packing-list.ts)", () => {
  it("contient les documents et articles de santé essentiels", () => {
    const list = buildPackingList({ durationDays: 2 });
    expect(list.some((item) => item.label.includes("identité") && item.category === "documents" && item.essential)).toBe(true);
    expect(list.some((item) => item.label.includes("brosse à dents") && item.category === "divers" && item.essential)).toBe(true);
  });

  it("gère les destinations chaudes avec activités nautiques", () => {
    const list = buildPackingList({
      durationDays: 3,
      avgTemp: 26,
      isNautical: true,
    });
    // Devrait contenir un maillot de bain et de la crème solaire
    expect(list.some((item) => item.label.toLowerCase().includes("maillot de bain") && item.essential)).toBe(true);
    expect(list.some((item) => item.label.toLowerCase().includes("crème solaire") && item.essential)).toBe(true);
    // Devrait contenir des vêtements chauds ? Non, car temp = 26 (hot)
    expect(list.some((item) => item.label.toLowerCase().includes("manteau chaud"))).toBe(false);
  });

  it("gère les destinations froides avec activités urbaines", () => {
    const list = buildPackingList({
      durationDays: 4,
      avgTemp: 8,
      activities: ["visite de musée", "restaurant"],
    });
    // Devrait contenir manteau chaud
    expect(list.some((item) => item.label.toLowerCase().includes("manteau chaud") && item.essential)).toBe(true);
    expect(list.some((item) => item.label.toLowerCase().includes("chaussures confortables") && item.essential)).toBe(true);
    // Pas de maillot de bain
    expect(list.some((item) => item.label.toLowerCase().includes("maillot de bain"))).toBe(false);
  });

  it("différencie séjour court vs long dans les labels de vêtements", () => {
    const shortList = buildPackingList({ durationDays: 1 });
    const longList = buildPackingList({ durationDays: 5 });

    const shortUnders = shortList.find((item) => item.label.includes("Sous-vêtements"));
    const longUnders = longList.find((item) => item.label.includes("Sous-vêtements"));

    expect(shortUnders?.label).not.toContain("x");
    expect(longUnders?.label).toContain("x5");
  });
});
