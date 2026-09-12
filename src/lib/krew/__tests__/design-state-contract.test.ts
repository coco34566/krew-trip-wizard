import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const tripLayout = readFileSync("src/routes/_authenticated/trips.$tripId.tsx", "utf8");
const recapRoute = readFileSync("src/routes/_authenticated/trips.$tripId.recap.tsx", "utf8");
const memoriesRoute = readFileSync("src/routes/_authenticated/trips.$tripId.memories.tsx", "utf8");

describe("approved D7 secondary-state contract", () => {
  it("keeps the Invite lifecycle gate on the form shell and narrow gutter", () => {
    expect(tripLayout).toContain(
      '<CompletedPreparationGate tripId={tripId} externalStatus size="form" gutter="narrow">',
    );
  });

  it("aligns Recap loading and error padding with the normal story rhythm", () => {
    const approvedAsyncShells = recapRoute.match(
      /<KrewPageShell[\s\S]*?data-krew-story-page="recap"[\s\S]*?className="py-8 sm:py-12"[\s\S]*?>/g,
    );

    expect(approvedAsyncShells).toHaveLength(2);
    expect(recapRoute).not.toContain('className="py-10"');
  });

  it("keeps Memories outside the reduced D7 implementation scope", () => {
    expect(memoriesRoute).toMatch(
      /<KrewThinkingState\s+context="generic"\s+customMessage="Chargement des souvenirs…"\s+delayMs=\{0\}\s*\/>/,
    );
    expect(memoriesRoute).not.toContain("KrewJourneyLoadingState");
  });
});
