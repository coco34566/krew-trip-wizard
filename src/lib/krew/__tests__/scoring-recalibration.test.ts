import { describe, expect, it } from "vitest";
import {
  filterEligibleScoringFeedback,
  hasEnoughLearningSignal,
  isLearningExcludedTripName,
  MIN_LEARNING_TRIPS,
  MIN_POSITIVE_LEARNING_TRIPS,
} from "../scoring-recalibration";

describe("scoring recalibration safeguards", () => {
  it("excludes QA, test, E2E and demo trips from learning", () => {
    expect(isLearningExcludedTripName("TEST 16 EVJF")).toBe(true);
    expect(isLearningExcludedTripName("Test15")).toBe(true);
    expect(isLearningExcludedTripName("QA Golden Path")).toBe(true);
    expect(isLearningExcludedTripName("E2E - Budapest")).toBe(true);
    expect(isLearningExcludedTripName("Demo voyage")).toBe(true);
    expect(isLearningExcludedTripName("Week-end de Clara")).toBe(false);
  });

  it("filters feedback belonging to excluded trips", () => {
    const rows = [
      { trip_id: "real", was_selected: true },
      { trip_id: "qa", was_selected: true },
    ];
    expect(
      filterEligibleScoringFeedback(rows, [
        { id: "real", name: "EVJF Clara" },
        { id: "qa", name: "TEST 16" },
      ]),
    ).toEqual([{ trip_id: "real", was_selected: true }]);
  });

  it("requires enough distinct real trips before changing weights", () => {
    const reactions = new Map<string, { likes: number; dislikes: number }>();
    const insufficient = Array.from({ length: MIN_LEARNING_TRIPS - 1 }, (_, index) => ({
      trip_id: `trip-${index}`,
      recommendation_id: `rec-${index}`,
      was_selected: index < MIN_POSITIVE_LEARNING_TRIPS,
    }));
    expect(hasEnoughLearningSignal(insufficient, reactions)).toBe(false);

    const enough = Array.from({ length: MIN_LEARNING_TRIPS }, (_, index) => ({
      trip_id: `trip-${index}`,
      recommendation_id: `rec-${index}`,
      was_selected: index < MIN_POSITIVE_LEARNING_TRIPS,
    }));
    expect(hasEnoughLearningSignal(enough, reactions)).toBe(true);
  });

  it("counts positive learning signal by distinct trip, not repeated rows", () => {
    const reactions = new Map<string, { likes: number; dislikes: number }>();
    const rows = Array.from({ length: MIN_LEARNING_TRIPS }, (_, index) => ({
      trip_id: `trip-${index}`,
      recommendation_id: `rec-${index}`,
      was_selected: index < MIN_POSITIVE_LEARNING_TRIPS - 1,
    }));
    rows.push(
      { trip_id: "trip-0", recommendation_id: "duplicate-1", was_selected: true },
      { trip_id: "trip-0", recommendation_id: "duplicate-2", was_selected: true },
    );
    expect(hasEnoughLearningSignal(rows, reactions)).toBe(false);
  });
});
