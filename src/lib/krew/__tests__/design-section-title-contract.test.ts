import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const approvedClass = "text-[length:var(--krew-title-section)]";
const read = (path: string) => readFileSync(path, "utf8");

describe("approved D8 page-section title consumers", () => {
  it.each([
    ["availability", "src/components/krew/ParticipantAvailabilityStep.tsx", 1],
    ["questionnaire", "src/routes/_authenticated/trips.$tripId.questionnaire.tsx", 1],
    ["star", "src/routes/_authenticated/trips.$tripId.star.tsx", 1],
    ["planning", "src/components/krew/TripPlanningPage.tsx", 1],
    ["destination", "src/components/krew/TripDestinationPage.tsx", 1],
    ["invite", "src/components/krew/TripInvitePage.tsx", 1],
    ["recap", "src/routes/_authenticated/trips.$tripId.recap.tsx", 1],
  ])("uses the section token on %s", (_name, path, expectedCount) => {
    expect(read(path).split(approvedClass)).toHaveLength(expectedCount + 1);
  });

  it("removes the historical questionnaire font-size overrides", () => {
    const preferencesCss = read("src/styles/krew-preferences.css");
    expect(preferencesCss).not.toContain("font-size: 28px !important;");
    expect(preferencesCss).not.toContain("font-size: 30px !important;");
  });

  it("preserves the approved editorial and modal exceptions", () => {
    const recap = read("src/routes/_authenticated/trips.$tripId.recap.tsx");
    const memories = read("src/routes/_authenticated/trips.$tripId.memories.tsx");

    expect(recap).toContain("text-[28px] sm:text-[32px]");
    expect(recap).toContain("font-display text-xl font-normal");
    expect(memories).toMatch(
      /id="photo-album-title"[\s\S]*?className="[^"]*\btext-2xl\b[^"]*\bsm:text-3xl\b[^"]*"/,
    );
    expect(memories).toMatch(
      /<h3 className="[^"]*\btext-3xl\b[^"]*\bsm:text-5xl\b[^"]*">[\s\S]*?recapSource\?\.trip\?\.name/,
    );
  });
});
