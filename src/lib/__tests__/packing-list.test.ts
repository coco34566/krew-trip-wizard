import { describe, it, expect } from "vitest";
import { buildPackingList, buildTripPreparation } from "../krew/packing-list";

describe("Liste de voyage (packing-list.ts)", () => {
  it("gère les déguisements et thèmes de soirée", () => {
    const list = buildPackingList({
      durationDays: 2,
      activities: ["soirée déguisée", "karaoké"],
    });
    expect(
      list.some((item) => item.label.toLowerCase().includes("déguisement") && item.essential),
    ).toBe(true);
  });

  it("contient les documents et articles de santé essentiels", () => {
    const list = buildPackingList({ durationDays: 2 });
    expect(
      list.some(
        (item) =>
          item.label.includes("identité") && item.category === "documents" && item.essential,
      ),
    ).toBe(true);
    expect(
      list.some(
        (item) =>
          item.label.includes("brosse à dents") && item.category === "divers" && item.essential,
      ),
    ).toBe(true);
  });

  it("gère les destinations chaudes avec activités nautiques", () => {
    const list = buildPackingList({
      durationDays: 3,
      avgTemp: 26,
      isNautical: true,
    });
    // Devrait contenir un maillot de bain et de la crème solaire
    expect(
      list.some((item) => item.label.toLowerCase().includes("maillot de bain") && item.essential),
    ).toBe(true);
    expect(
      list.some((item) => item.label.toLowerCase().includes("crème solaire") && item.essential),
    ).toBe(true);
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
    expect(
      list.some((item) => item.label.toLowerCase().includes("manteau chaud") && item.essential),
    ).toBe(true);
    expect(
      list.some(
        (item) => item.label.toLowerCase().includes("chaussures confortables") && item.essential,
      ),
    ).toBe(true);
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

  it("sépare personnel, collectif, courses et tâches et déduplique les activités aquatiques", () => {
    const result = buildTripPreparation({
      eventType: "evjf",
      accommodation: "maison",
      activities: [
        "piscine",
        "journée bateau",
        "soirée au logement",
        "jeu de cartes",
        "dîner au logement",
        "apéro au logement",
        "accessoires et décoration EVJF",
      ],
    });
    expect(result.personal.filter((item) => item.id === "swimsuit")).toHaveLength(1);
    expect(result.personal.find((item) => item.id === "swimsuit")?.quantity.type).toBe(
      "per_person",
    );
    expect(result.group.find((item) => item.id === "speaker")?.quantity.type).toBe("one_for_group");
    expect(result.group.some((item) => item.id === "card_game" && item.purchasable)).toBe(true);
    expect(result.groceries.some((item) => item.id === "dinner_ingredients")).toBe(true);
    expect(result.groceries.find((item) => item.id === "alcohol")?.optional).toBe(true);
    expect(result.tasks.some((item) => item.id === "do_groceries")).toBe(true);
  });

  it("conserve les ajouts manuels au recalcul et retire les suggestions devenues sans raison", () => {
    const manual = buildTripPreparation({ activities: ["bateau"] }).personal[0]!;
    const after = buildTripPreparation({
      activities: ["activité inconnue"],
      manualItems: [{ ...manual, id: "manual_hat", label: "Mon chapeau", manual: true }],
    });
    expect(after.personal.some((item) => item.id === "swimsuit")).toBe(false);
    expect(after.personal.some((item) => item.id === "manual_hat" && item.manual)).toBe(true);
  });

  it("contient le socle collectif de base pour le groupe sans doublon et avec enrichissement", () => {
    const prepBase = buildTripPreparation({ activities: [] });
    expect(prepBase.group.some((item) => item.id === "speaker")).toBe(true);
    expect(prepBase.group.some((item) => item.id === "card_game")).toBe(true);
    expect(prepBase.group.some((item) => item.id === "power_strip")).toBe(true);

    const prepActivity = buildTripPreparation({ activities: ["soiree au logement", "jeu de cartes"] });
    expect(prepActivity.group.filter((item) => item.id === "speaker")).toHaveLength(1);
    expect(prepActivity.group.filter((item) => item.id === "card_game")).toHaveLength(1);

    const speakerItem = prepActivity.group.find((item) => item.id === "speaker");
    expect(speakerItem?.sources).toContain("base");
    expect(speakerItem?.sources).toContain("activity");
    expect(speakerItem?.reasons.length).toBeGreaterThan(1);
  });

  it("produit des résultats nettement différents selon le voyage", () => {
    const evjf = buildTripPreparation({
      eventType: "evjf",
      accommodation: "maison",
      activities: [
        "piscine",
        "bateau",
        "soirée au logement",
        "dîner au logement",
        "décoration EVJF",
      ],
    });
    const friends = buildTripPreparation({
      eventType: "weekend",
      accommodation: "hôtel",
      activities: ["randonnée", "restaurant"],
    });
    expect(evjf.group.map((item) => item.id)).not.toEqual(friends.group.map((item) => item.id));
    expect(evjf.groceries.length).toBeGreaterThan(friends.groceries.length);
    expect(friends.personal.some((item) => item.id === "walking_shoes")).toBe(true);
  });
});
