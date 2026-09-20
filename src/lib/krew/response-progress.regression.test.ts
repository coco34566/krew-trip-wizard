import { describe, expect, it } from "vitest";
import { getDashboardResponseState } from "./trip-dashboard-response-state";
import {
  deriveResponseProgress,
  hasSecretStarPreferences,
} from "./response-progress";

describe("questionnaire response progress regressions", () => {
  it("keeps 4 expected / 2 submitted at 2/4 even when dates are locked", () => {
    const progress = deriveResponseProgress({
      ownerId: "owner",
      coOrganizerId: null,
      hasStar: false,
      starUserId: null,
      starMode: "participant",
      participants: [
        { user_id: "owner", status: "accepte" },
        { user_id: "p2", status: "accepte" },
        { user_id: "p3", status: "accepte" },
        { user_id: "p4", status: "accepte" },
      ],
      preferenceRows: [
        { user_id: "owner", submitted_at: "2026-09-20T09:00:00Z" },
        { user_id: "p2", submitted_at: "2026-09-20T09:05:00Z" },
        { user_id: "p3", submitted_at: null },
        { user_id: "p4", submitted_at: null },
      ],
      availabilityUserIds: ["owner", "p2"],
    });

    expect(progress.preferencesExpected).toBe(4);
    expect(progress.preferencesAnswered).toBe(2);

    const dashboard = getDashboardResponseState({
      progressReady: true,
      datesLocked: true,
      preferencesExpected: progress.preferencesExpected,
      preferencesAnswered: progress.preferencesAnswered,
      availabilityExpected: progress.availabilityExpected,
      availabilityAnswered: progress.availabilityAnswered,
    });

    expect(dashboard).toEqual({
      state: "ready",
      preferencesExpected: 4,
      preferencesAnswered: 2,
      availabilityExpected: 4,
      availabilityAnswered: 2,
    });
  });

  it("does not treat partially filled secret-Star preferences as submitted", () => {
    expect(
      hasSecretStarPreferences({
        wanted_activities: ["spa"],
        desired_destination: "Lisbonne",
        submitted_at: null,
      }),
    ).toBe(false);

    expect(
      hasSecretStarPreferences({
        submitted_at: "2026-09-20T09:00:00Z",
      }),
    ).toBe(true);
  });
});
