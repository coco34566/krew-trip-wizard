import { describe, expect, it } from "vitest";

import {
  EVENT_SPECIFIC_PREFERENCES,
  getEventSpecificPreferences,
} from "../constants";
import {
  GEMINI_CONTRACTUAL_PROMPT_TEMPLATE,
  buildPlanningBrief,
  isActivityExcludedBySignals,
  type ActivityAiInput,
} from "../activity-ai.server";
import { participantPreferencesSchema } from "../../participant-preferences.legacy";

const input = (overrides: Partial<ActivityAiInput> = {}): ActivityAiInput => ({
  destination: "Lisbonne",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  nights: 2,
  participants: 8,
  budgetPerPerson: 450,
  eventType: "evjf",
  ambiances: ["fete", "insolite"],
  activityCategories: ["gastronomie", "experiences"],
  travelPace: "equilibre",
  starWanted: [],
  starDealBreakers: [],
  ...overrides,
});

describe("questionnaire événementiel", () => {
  it("ajoute seulement des signaux spécifiques à l'événement, sans dupliquer les catégories générales", () => {
    const evjf = getEventSpecificPreferences("evjf");
    expect(evjf.map((item) => item.id)).toContain("event_adult_show");
    expect(evjf.map((item) => item.id)).toContain("event_star_challenges");
    expect(evjf.map((item) => item.label.toLowerCase()).join(" ")).not.toMatch(/spa|bateau|gastronomie|shopping/);
    expect(getEventSpecificPreferences("weekend")).toEqual([]);
    expect(EVENT_SPECIFIC_PREFERENCES.anniversaire?.length).toBeGreaterThan(0);
  });

  it("préserve les signaux Star événementiels dans le schéma participant", () => {
    const parsed = participantPreferencesSchema.parse({
      tripId: "00000000-0000-4000-8000-000000000001",
      starEventWanted: ["event_photo_moment"],
      starEventDealBreakers: ["event_adult_show"],
    });
    expect(parsed.starEventWanted).toEqual(["event_photo_moment"]);
    expect(parsed.starEventDealBreakers).toEqual(["event_adult_show"]);
  });
});

describe("planning événementiel", () => {
  it("utilise un moment signature neutre au lieu d'un cliché EVJF imposé", () => {
    const brief = buildPlanningBrief(input());
    const signature = brief.mandatoryNeeds.find((need) => need.type === "event_signature");
    expect(signature?.label).toBe("Moment signature de l’événement");
    expect(signature?.label).not.toMatch(/mariée|marié|strip|défi/i);
  });

  it("respecte réellement la densité chill / équilibré / plein programme", () => {
    expect(buildPlanningBrief(input({ travelPace: "chill" })).planningRules.maxActivitiesPerDay).toBe(1);
    expect(buildPlanningBrief(input({ travelPace: "equilibre" })).planningRules.maxActivitiesPerDay).toBe(2);
    expect(buildPlanningBrief(input({ travelPace: "plein_programme" })).planningRules.maxActivitiesPerDay).toBe(3);
  });

  it("traite un refus show adulte comme exclusion dure mais pas une absence de refus", () => {
    const label = "Show adulte et strip-tease privé";
    expect(isActivityExcludedBySignals(input({ starDealBreakers: ["event_adult_show"] }), label)).toBe(true);
    expect(isActivityExcludedBySignals(input({ starDealBreakers: [] }), label)).toBe(false);
    expect(
      isActivityExcludedBySignals(
        input({ starWanted: ["event_adult_show"], starDealBreakers: [] }),
        label,
      ),
    ).toBe(false);
  });

  it("traite insolite comme un modificateur et le type d'événement comme un contexte", () => {
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("un type d'événement donne du contexte, jamais une recette automatique");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("l'absence d'un refus ne signifie JAMAIS que l'activité est souhaitée");
    expect(GEMINI_CONTRACTUAL_PROMPT_TEMPLATE).toContain("insolite + gastronomie, insolite + sport et insolite + fête");
  });
});
