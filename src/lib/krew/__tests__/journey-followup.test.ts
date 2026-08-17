import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateTripDateRange } from "../../availability.functions";
import { buildTripSteps } from "../availability";
import { destinationBudgetTotal, isDestinationBudgetEstimated } from "../destination-budget";
import { buildTripStatusWhatsApp } from "../whatsapp";

describe("compléments du parcours E2E", () => {
  it("calcule les dates manuelles avec duration_nights", () => {
    expect(calculateTripDateRange("2026-09-12", 2)).toEqual({
      startDate: "2026-09-12",
      endDate: "2026-09-14",
    });
  });

  it("ajoute l'étape Star secrète après Préférences", () => {
    const steps = buildTripSteps({
      tripId: "trip",
      participantsJoined: 2,
      participantsExpected: 3,
      availabilityAnswered: 2,
      questionnaireAnswered: 2,
      datesLocked: false,
      hasRecommendations: false,
      destinationSelected: false,
      showStarStep: true,
      starName: "Titi",
      starDone: true,
    });
    expect(steps.map((step) => step.label).slice(2, 4)).toEqual([
      "Préférences",
      "Préférences de Titi",
    ]);
    expect(steps[3]?.status).toBe("done");
  });

  it("ne crée aucune étape Star en mode participant", () => {
    const steps = buildTripSteps({
      tripId: "trip",
      participantsJoined: 2,
      participantsExpected: 3,
      availabilityAnswered: 2,
      questionnaireAnswered: 2,
      datesLocked: false,
      hasRecommendations: false,
      destinationSelected: false,
      showStarStep: false,
      starName: "Titi",
      starDone: false,
    });
    expect(steps.some((step) => step.id === "star")).toBe(false);
  });

  it("additionne chaque composante et signale les estimations", () => {
    const budget = {
      transport: 100,
      accommodation: 200,
      activities: 50,
      food: 75,
      priceSource: { transport: "estimated", accommodation: "provider" },
    };
    expect(destinationBudgetTotal(budget)).toBe(425);
    expect(isDestinationBudgetEstimated(budget)).toBe(true);
  });

  it("construit le statut WhatsApp avec uniquement les actions fournies", () => {
    const text = buildTripStatusWhatsApp({
      tripName: "Rome",
      tripUrl: "https://krew.test/trips/1",
      statusLines: ["📅 Dates : 12 → 14 sept."],
      actions: [{ name: "Julie", action: "préférences" }],
    });
    expect(text).toContain("Petit point KREW pour « Rome » ✈️");
    expect(text).toContain("• Julie : préférences");
    expect(text).not.toContain("disponibilités");
  });

  it("conserve les six sections du questionnaire dans l'ordre et les quatre calendriers", () => {
    const questionnaire = readFileSync(
      "src/routes/_authenticated/trips.$tripId.questionnaire.tsx",
      "utf8",
    );
    const titles = [
      "1. Envies & ambiance",
      "2. Destination & cadre",
      "3. Transport",
      "4. Budget",
      "5. Hébergement",
      "6. Contraintes & précisions",
    ];
    expect(titles.map((title) => questionnaire.indexOf(title))).toEqual(
      [...titles.map((title) => questionnaire.indexOf(title))].sort((a, b) => a - b),
    );
    expect(questionnaire.indexOf("localMobility")).toBeLessThan(
      questionnaire.indexOf('title="4. Budget"'),
    );
    const hub = readFileSync("src/routes/_authenticated/trips.$tripId.index.tsx", "utf8");
    for (const option of [
      "Apple / calendrier mobile (.ics)",
      "Google Calendar",
      "Outlook",
      "Microsoft 365",
    ])
      expect(hub).toContain(option);
  });
});
