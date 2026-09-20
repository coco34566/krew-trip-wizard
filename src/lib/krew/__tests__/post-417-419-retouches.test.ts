import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("post #417/#419 retouches", () => {
  it("keeps Star and participant travel duration unlimited by default", () => {
    for (const path of [
      "src/routes/_authenticated/trips.$tripId.star.tsx",
      "src/routes/_authenticated/trips.$tripId.questionnaire.tsx",
    ]) {
      const content = source(path);
      expect(content).toContain("useState<number | null>(null)");
      expect(content).toContain("Pas de limite");
      expect(content).toContain("maxTravelDurationHours != null ? (");
      expect(content).not.toContain("useState(6)");
    }

    expect(source("src/lib/participant-preferences.legacy.ts")).toContain(
      "maxTravelDurationHours: z.number().min(0).max(48).optional().nullable()",
    );
  });

  it("uses organizer-or-co-organizer access for feedback actions and the secret Star row", () => {
    const members = source("src/components/krew/TripHubMembersSection.tsx");
    const invite = source("src/components/krew/TripInvitePage.tsx");

    expect(members).toContain("const canManageTrip = isTripAdmin(trip, data.userId);");
    expect(members).toContain("{canManageTrip ? (");
    expect(invite).toContain("const canManageTrip = Boolean(data && trip && isTripAdmin(trip, data.userId));");
    expect(invite).toContain('savedStarMode === "secret" && secretStarSlot && canManageTrip');
  });
});
