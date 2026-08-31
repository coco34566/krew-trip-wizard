import { describe, expect, it } from "vitest";
import { deriveResponseProgress } from "./response-progress";

const ownerId = "00000000-0000-4000-8000-000000000001";
const user2 = "00000000-0000-4000-8000-000000000002";
const user3 = "00000000-0000-4000-8000-000000000003";

function progress(overrides: Partial<Parameters<typeof deriveResponseProgress>[0]> = {}) {
  return deriveResponseProgress({
    ownerId,
    coOrganizerId: null,
    hasStar: false,
    starUserId: null,
    starMode: "participant",
    participants: [],
    preferenceUserIds: [],
    availabilityUserIds: [],
    ...overrides,
  });
}

describe("deriveResponseProgress", () => {
  it("counts only the organizer when five displayed places are still placeholders", () => {
    const result = progress({
      participants: Array.from({ length: 5 }, () => ({ user_id: null, status: "à inviter" })),
    });

    expect(result.preferencesExpected).toBe(1);
    expect(result.preferencesAnswered).toBe(0);
    expect(result.preferencesMissing).toBe(1);
    expect(result.availabilityExpected).toBe(1);
    expect(result.availabilityAnswered).toBe(0);
  });

  it("counts two real people and excludes three placeholders", () => {
    const result = progress({
      participants: [
        { user_id: ownerId, status: "accepte" },
        { user_id: user2, status: "accepte" },
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
      ],
    });

    expect(result.preferencesExpected).toBe(2);
    expect(result.availabilityExpected).toBe(2);
  });

  it("keeps preference and availability numerators independent", () => {
    const result = progress({
      participants: [{ user_id: user2, status: "accepte" }],
      preferenceUserIds: [ownerId, user2],
      availabilityUserIds: [ownerId],
    });

    expect(result.preferencesAnswered).toBe(2);
    expect(result.availabilityAnswered).toBe(1);
    expect(result.preferencesMissing).toBe(0);
    expect(result.availabilityMissing).toBe(1);
  });

  it("does not add a virtual Star when a non-Star trip happens to have secret as its default mode", () => {
    const result = progress({
      hasStar: false,
      starMode: "secret",
      secretStarHasPreferences: true,
      secretStarHasAvailability: true,
      preferenceUserIds: [ownerId],
      availabilityUserIds: [ownerId],
    });

    expect(result.secretStarExpected).toBe(false);
    expect(result.preferencesExpected).toBe(1);
    expect(result.preferencesAnswered).toBe(1);
    expect(result.availabilityExpected).toBe(1);
    expect(result.availabilityAnswered).toBe(1);
  });

  it("counts a participant-mode Star once like any other participant", () => {
    const result = progress({
      hasStar: true,
      starMode: "participant",
      starUserId: user2,
      participants: [
        { user_id: user2, status: "accepte" },
        { user_id: user2, status: "accepte" },
      ],
      preferenceUserIds: [ownerId, user2, user2],
      availabilityUserIds: [ownerId, user2],
    });

    expect(result.preferencesExpected).toBe(2);
    expect(result.preferencesAnswered).toBe(2);
    expect(result.availabilityExpected).toBe(2);
    expect(result.availabilityAnswered).toBe(2);
  });

  it("adds one secret Star response to both counters when both parts are completed", () => {
    const result = progress({
      hasStar: true,
      starMode: "secret",
      secretStarHasPreferences: true,
      secretStarHasAvailability: true,
      preferenceUserIds: [ownerId],
      availabilityUserIds: [ownerId],
    });

    expect(result.preferencesExpected).toBe(2);
    expect(result.preferencesAnswered).toBe(2);
    expect(result.availabilityExpected).toBe(2);
    expect(result.availabilityAnswered).toBe(2);
  });

  it("counts only secret-Star preferences when availability is incomplete", () => {
    const result = progress({
      hasStar: true,
      starMode: "secret",
      secretStarHasPreferences: true,
      secretStarHasAvailability: false,
      preferenceUserIds: [ownerId],
      availabilityUserIds: [ownerId],
    });

    expect(result.preferencesAnswered).toBe(2);
    expect(result.availabilityAnswered).toBe(1);
  });

  it("counts only secret-Star availability when preferences are incomplete", () => {
    const result = progress({
      hasStar: true,
      starMode: "secret",
      secretStarHasPreferences: false,
      secretStarHasAvailability: true,
      preferenceUserIds: [ownerId],
      availabilityUserIds: [ownerId],
    });

    expect(result.preferencesAnswered).toBe(1);
    expect(result.availabilityAnswered).toBe(2);
  });

  it("never includes placeholders in expected or missing answers", () => {
    const result = progress({
      participants: [
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
      ],
      preferenceUserIds: [ownerId],
      availabilityUserIds: [ownerId],
    });

    expect(result.preferencesExpected).toBe(1);
    expect(result.preferencesMissing).toBe(0);
    expect(result.availabilityExpected).toBe(1);
    expect(result.availabilityMissing).toBe(0);
  });

  it("excludes a member who no longer participates", () => {
    const result = progress({
      participants: [
        { user_id: user2, status: "absent" },
        { user_id: user3, status: "refuse" },
      ],
      preferenceUserIds: [ownerId, user2, user3],
      availabilityUserIds: [ownerId, user2, user3],
    });

    expect(result.expectedUserIds).toEqual([ownerId]);
    expect(result.preferencesExpected).toBe(1);
    expect(result.preferencesAnswered).toBe(1);
    expect(result.availabilityExpected).toBe(1);
    expect(result.availabilityAnswered).toBe(1);
  });
});
