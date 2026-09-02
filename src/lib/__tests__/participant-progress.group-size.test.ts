import { describe, expect, it } from "vitest";
import { getParticipantsProgressHelper } from "../participant-progress.functions";

function createSupabaseMock({ answered = true }: { answered?: boolean } = {}) {
  const trip = {
    participants_count: 6,
    celebrated_person: null,
    has_star: false,
    star_user_id: null,
    owner_id: "owner-1",
    co_organizer_id: null,
    group_logistics: {},
  };
  const participants = [
    { id: "p1", user_id: "owner-1", email: "owner@krew.test", display_name: "Owner", status: "accepte" },
  ];
  const preferences = answered ? [{ user_id: "owner-1", submitted_at: "2026-09-02", updated_at: null, departure_city: "Paris" }] : [];
  const availabilities = answered ? [{ user_id: "owner-1" }] : [];

  return {
    from(table: string) {
      let data: any = [];
      if (table === "trips") data = trip;
      if (table === "trip_participants") data = participants;
      if (table === "trip_participant_preferences") data = preferences;
      if (table === "trip_availability") data = availabilities;
      if (table === "trip_star_preferences") data = null;

      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data, error: null }),
        then: (resolve: (value: any) => unknown) => resolve({ data, error: null }),
      };
      return chain as any;
    },
  } as any;
}

describe("group response denominators", () => {
  it("reports one preference and one availability response out of a configured group of six", async () => {
    const result = await getParticipantsProgressHelper(createSupabaseMock(), "trip-1");

    expect(result.answered).toBe(1);
    expect(result.preferencesExpected).toBe(6);
    expect(result.availabilityAnswered).toBe(1);
    expect(result.availabilityExpected).toBe(6);
    expect(result.pendingPrefs).toBe(5);
    expect(result.pendingAvailability).toBe(5);
  });

  it("reports six of six when all configured members are represented and answered", async () => {
    const supabase = createSupabaseMock();
    const originalFrom = supabase.from.bind(supabase);
    supabase.from = (table: string) => {
      if (table === "trip_participants") {
        const participants = Array.from({ length: 6 }, (_, index) => ({
          id: `p${index + 1}`,
          user_id: index === 0 ? "owner-1" : `user-${index + 1}`,
          email: `u${index + 1}@krew.test`,
          display_name: `User ${index + 1}`,
          status: "accepte",
        }));
        const chain = { select: () => chain, eq: () => chain, then: (resolve: (value: any) => unknown) => resolve({ data: participants, error: null }) };
        return chain as any;
      }
      if (table === "trip_participant_preferences" || table === "trip_availability") {
        const rows = Array.from({ length: 6 }, (_, index) => ({ user_id: index === 0 ? "owner-1" : `user-${index + 1}` }));
        const chain = { select: () => chain, eq: () => chain, then: (resolve: (value: any) => unknown) => resolve({ data: rows, error: null }) };
        return chain as any;
      }
      return originalFrom(table);
    };

    const result = await getParticipantsProgressHelper(supabase, "trip-1");
    expect(result.answered).toBe(6);
    expect(result.preferencesExpected).toBe(6);
    expect(result.availabilityAnswered).toBe(6);
    expect(result.availabilityExpected).toBe(6);
  });
});
