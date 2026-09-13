import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

const dashboardNavigation = 'navigate({ to: "/trips/$tripId", params: { tripId } })';

describe("journey step completion navigation", () => {
  it.each([
    ["questionnaire", "src/routes/_authenticated/trips.$tripId.questionnaire.tsx"],
    ["star questionnaire", "src/routes/_authenticated/trips.$tripId.star.tsx"],
    ["dates", "src/components/krew/TripDatesPage.tsx"],
    ["profile", "src/components/krew/TripProfilePage.tsx"],
    ["destination", "src/components/krew/TripDestinationPage.tsx"],
    ["accommodation", "src/components/krew/TripAccommodationPage.tsx"],
    ["transport", "src/components/krew/TripTransportPage.tsx"],
  ])("returns to the trip dashboard after %s completion", (_label, path) => {
    expect(source(path)).toContain(dashboardNavigation);
  });

  it("does not treat planning generation as a final step validation", () => {
    const planning = source("src/components/krew/TripPlanningPage.tsx");
    expect(planning).not.toContain(dashboardNavigation);
  });
});
