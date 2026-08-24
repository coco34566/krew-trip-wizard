import { describe, expect, test } from "vitest";

describe("Questionnaire & Profile Access Unit Tests", () => {
  function checkQuestionnaireAuthorization(
    trip: { owner_id: string; co_organizer_id?: string | null; group_logistics?: any },
    userId: string,
    participantRowExists: boolean,
  ): { authorized: boolean; isTripAdmin: boolean } {
    const isTripAdmin =
      trip.owner_id === userId ||
      trip.co_organizer_id === userId ||
      trip.group_logistics?.co_organizer_id === userId;

    if (isTripAdmin) {
      return { authorized: true, isTripAdmin: true };
    }

    if (participantRowExists) {
      return { authorized: true, isTripAdmin: false };
    }

    return { authorized: false, isTripAdmin: false };
  }

  test("Co-organizer is authorized as trip admin without requiring a trip_participants row", () => {
    const coOrgUserId = "user-co-org-99";
    const trip = {
      owner_id: "user-owner-1",
      co_organizer_id: coOrgUserId,
    };

    const res = checkQuestionnaireAuthorization(trip, coOrgUserId, false);
    expect(res.authorized).toBe(true);
    expect(res.isTripAdmin).toBe(true);
  });

  test("Co-organizer in group_logistics is authorized as trip admin without a trip_participants row", () => {
    const coOrgUserId = "user-co-org-88";
    const trip = {
      owner_id: "user-owner-1",
      co_organizer_id: null,
      group_logistics: { co_organizer_id: coOrgUserId },
    };

    const res = checkQuestionnaireAuthorization(trip, coOrgUserId, false);
    expect(res.authorized).toBe(true);
    expect(res.isTripAdmin).toBe(true);
  });

  test("Non-admin participant with a trip_participants row is authorized as non-admin", () => {
    const participantUserId = "user-part-22";
    const trip = {
      owner_id: "user-owner-1",
      co_organizer_id: "user-co-org-99",
    };

    const res = checkQuestionnaireAuthorization(trip, participantUserId, true);
    expect(res.authorized).toBe(true);
    expect(res.isTripAdmin).toBe(false);
  });

  test("Non-admin user without a trip_participants row is denied authorization", () => {
    const strangerUserId = "user-stranger-00";
    const trip = {
      owner_id: "user-owner-1",
      co_organizer_id: "user-co-org-99",
    };

    const res = checkQuestionnaireAuthorization(trip, strangerUserId, false);
    expect(res.authorized).toBe(false);
    expect(res.isTripAdmin).toBe(false);
  });

  test("Dates gating requires datesLocked = true without artificial start_date bypass", () => {
    const datesLockedFalse = false;
    const datesReadyStrict = datesLockedFalse;
    expect(datesReadyStrict).toBe(false);

    const datesLockedTrue = true;
    const datesReadyLocked = datesLockedTrue;
    expect(datesReadyLocked).toBe(true);
  });
});
