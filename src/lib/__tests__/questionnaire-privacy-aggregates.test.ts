import { describe, expect, it } from "vitest";
import { getTripAvailabilityHelper } from "../availability-read.functions";

function mockSupabase() {
  const tripId = "11111111-1111-4111-8111-111111111111";
  const ownerId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";
  const rowsByTable: Record<string, any> = {
    trips: {
      id: tripId,
      name: "Test",
      event_type: "weekend",
      owner_id: ownerId,
      co_organizer_id: null,
      participants_count: 2,
      has_star: false,
      celebrated_person: null,
      star_user_id: null,
      group_logistics: {},
      duration_nights: 2,
      dates_locked: false,
      provisional_start_date: null,
      provisional_end_date: null,
      start_date: null,
      end_date: null,
    },
    trip_participants: [
      { id: "p1", user_id: ownerId, email: "owner@example.test", display_name: "Owner", status: "accepte" },
      { id: "p2", user_id: memberId, email: "member@example.test", display_name: "Member", status: "accepte" },
    ],
    trip_preferences: { duration_nights: 2 },
    trip_participant_preferences: [
      { user_id: ownerId, submitted_at: "2026-09-20T10:00:00Z" },
      { user_id: memberId, submitted_at: "2026-09-20T11:00:00Z" },
    ],
    trip_star_preferences: null,
    trip_availability: [
      {
        user_id: ownerId,
        available_dates: ["2026-10-10", "2026-10-11"],
        blocked_dates: [],
        flex_days: 0,
        duration_nights: 2,
        notes: null,
        submitted_at: "2026-09-20T10:00:00Z",
        updated_at: "2026-09-20T10:00:00Z",
      },
      {
        user_id: memberId,
        available_dates: ["2026-10-10", "2026-10-11"],
        blocked_dates: [],
        flex_days: 0,
        duration_nights: 2,
        notes: null,
        submitted_at: "2026-09-20T11:00:00Z",
        updated_at: "2026-09-20T11:00:00Z",
      },
    ],
  };

  return {
    tripId,
    ownerId,
    memberId,
    client: {
      from(table: string) {
        let data = rowsByTable[table];
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
          single: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error: null }),
          then: (resolve: (value: any) => unknown) =>
            resolve({ data: Array.isArray(data) ? data : data == null ? [] : [data], error: null }),
        };
        return chain;
      },
    },
  };
}

describe("questionnaire group aggregates", () => {
  it("returns identical group counters and windows for an organizer and a regular member", async () => {
    const { client, tripId, ownerId, memberId } = mockSupabase();

    const organizer = await getTripAvailabilityHelper(client as any, ownerId, tripId);
    const member = await getTripAvailabilityHelper(client as any, memberId, tripId);

    expect(member.answered).toBe(organizer.answered);
    expect(member.expected).toBe(organizer.expected);
    expect(member.windows).toEqual(organizer.windows);
    expect(member.participants).toEqual(organizer.participants);

    expect(organizer.mine).not.toBeNull();
    expect(member.mine).not.toBeNull();
  });
});
