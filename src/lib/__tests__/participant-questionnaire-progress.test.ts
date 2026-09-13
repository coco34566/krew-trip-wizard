import { describe, expect, it } from "vitest";

import { getParticipantsProgressHelper } from "../participant-preferences.functions";

function mockProgressSupabase({
  preferenceUserIds,
  availabilityUserIds,
}: {
  preferenceUserIds: string[];
  availabilityUserIds: string[];
}) {
  const trip = {
    participants_count: 2,
    celebrated_person: null,
    has_star: false,
    star_user_id: null,
    owner_id: "owner",
    co_organizer_id: null,
    group_logistics: {},
  };
  const participants = [
    {
      id: "owner-participant",
      user_id: "owner",
      email: "owner@example.com",
      display_name: "Owner",
      status: "accepte",
    },
    {
      id: "guest-participant",
      user_id: "guest",
      email: "guest@example.com",
      display_name: "Guest",
      status: "accepte",
    },
  ];
  const preferences = preferenceUserIds.map((user_id) => ({
    user_id,
    submitted_at: "2026-09-13T10:00:00Z",
    updated_at: "2026-09-13T10:00:00Z",
    departure_city: "Paris",
  }));
  const availabilities = availabilityUserIds.map((user_id) => ({ user_id }));

  return {
    from(table: string) {
      let data: any = [];
      if (table === "trips") data = trip;
      if (table === "trip_participants") data = participants;
      if (table === "trip_participant_preferences") data = preferences;
      if (table === "trip_availability") data = availabilities;
      if (table === "trip_star_preferences") data = null;

      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
      };
      return chain;
    },
  };
}

describe("participant questionnaire progress", () => {
  it("does not count crossed partial answers from different people as a complete questionnaire", async () => {
    const supabase = mockProgressSupabase({
      preferenceUserIds: ["guest"],
      availabilityUserIds: ["owner"],
    });

    const progress = await getParticipantsProgressHelper(supabase as any, "trip-id");

    expect(progress.answered).toBe(1);
    expect(progress.availabilityAnswered).toBe(1);
    expect(progress.questionnaireAnswered).toBe(0);
    expect(progress.questionnaireExpected).toBe(2);
    expect(progress.pendingQuestionnaire).toBe(2);
  });

  it("counts a person only when that same identity completed availability and preferences", async () => {
    const supabase = mockProgressSupabase({
      preferenceUserIds: ["guest"],
      availabilityUserIds: ["guest"],
    });

    const progress = await getParticipantsProgressHelper(supabase as any, "trip-id");

    expect(progress.questionnaireAnswered).toBe(1);
    expect(progress.questionnaireExpected).toBe(2);
    expect(progress.pendingQuestionnaire).toBe(1);
  });
});
