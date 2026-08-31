import { describe, expect, it } from "vitest";
import { deriveResponseProgress } from "./response-progress";

const ownerId = "00000000-0000-4000-8000-000000000001";
const lateParticipantId = "00000000-0000-4000-8000-000000000002";

describe("locked response phase", () => {
  it("keeps the canonical real-member population independent from placeholder slots", () => {
    const result = deriveResponseProgress({
      ownerId,
      coOrganizerId: null,
      hasStar: false,
      starUserId: null,
      starMode: "participant",
      participants: [
        { user_id: lateParticipantId, status: "accepte" },
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
        { user_id: null, status: "à inviter" },
      ],
      preferenceUserIds: [ownerId, lateParticipantId],
      availabilityUserIds: [ownerId],
    });

    expect(result.expectedUserIds).toEqual([ownerId, lateParticipantId]);
    expect(result.availabilityExpected).toBe(2);
    expect(result.availabilityAnswered).toBe(1);
  });
});
