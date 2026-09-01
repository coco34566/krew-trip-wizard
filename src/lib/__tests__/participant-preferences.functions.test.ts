import { describe, it, expect, vi } from "vitest";
import { attachParticipantToTrip, getParticipantsProgressHelper } from "../participant-preferences.functions";

describe("attachParticipantToTrip", () => {
  it("attaches only the matching unclaimed invite when there are 3 unclaimed invites", async () => {
    const tripId = "trip-123";
    const userId = "user-1";
    const userEmail = "match@example.com";

    const selectMock = vi.fn().mockResolvedValue({ data: [{ id: 3, trip_id: tripId, email: userEmail, user_id: userId }], error: null });
    const isMock = vi.fn(() => ({ select: selectMock }));
    const ilikeMock = vi.fn(() => ({ is: isMock }));
    const eqMock = vi.fn(() => ({ ilike: ilikeMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const authMock = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: userEmail } } }) };
    const supabase = { from: fromMock, auth: authMock } as any;

    const updated = await attachParticipantToTrip(supabase, tripId, userId, userEmail);

    expect(fromMock).toHaveBeenCalledWith("trip_participants");
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: "accepte" });
    expect(eqMock).toHaveBeenCalledWith("trip_id", tripId);
    expect(ilikeMock).toHaveBeenCalledWith("email", userEmail);
    expect(isMock).toHaveBeenCalledWith("user_id", null);
    expect(selectMock).toHaveBeenCalled();
    expect(updated).toEqual({ id: 3, trip_id: tripId, email: userEmail, user_id: userId });
  });

  it("throws when no matching unclaimed invite exists", async () => {
    const tripId = "trip-123";
    const userId = "user-1";
    const userEmail = "nomatch@example.com";

    const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const isMock = vi.fn(() => ({ select: selectMock }));
    const ilikeMock = vi.fn(() => ({ is: isMock }));
    const eqMock = vi.fn(() => ({ ilike: ilikeMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const authMock = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: userEmail } } }) };
    const supabase = { from: fromMock, auth: authMock } as any;

    await expect(attachParticipantToTrip(supabase, tripId, userId, userEmail)).rejects.toThrow(
      `No pending invitation found for email ${userEmail} on trip ${tripId}`,
    );

    expect(fromMock).toHaveBeenCalledWith("trip_participants");
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: "accepte" });
    expect(eqMock).toHaveBeenCalledWith("trip_id", tripId);
    expect(ilikeMock).toHaveBeenCalledWith("email", userEmail);
    expect(isMock).toHaveBeenCalledWith("user_id", null);
    expect(selectMock).toHaveBeenCalled();
  });
});

describe("getParticipantsProgress", () => {
  it("counts a secret Star once without padding the denominator with unclaimed places", async () => {
    const tripId = "trip-123";
    const tripsData = {
      participants_count: 6,
      celebrated_person: "Titi",
      has_star: true,
      star_user_id: "star-uid",
      owner_id: "user-coco",
      co_organizer_id: null,
      group_logistics: { star_mode: "secret" },
    };
    const participantsData = [
      { id: "p1", user_id: "user-coco", email: "coco@krew.travel", display_name: "Coco", status: "accepte" },
      { id: "p2", user_id: "star-uid", email: "titi@krew.travel", display_name: "Titi", status: "accepte" },
      { id: "p3", user_id: "user-bruce", email: "bruce@krew.travel", display_name: "Bruce", status: "accepte" },
    ];
    const preferencesData = [
      { user_id: "user-coco", submitted_at: "2026-08-10", updated_at: null },
      { user_id: "user-bruce", submitted_at: "2026-08-11", updated_at: null },
    ];
    const availabilityData = [{ user_id: "user-coco" }];
    const starPrefsData = {
      user_id: "user-coco",
      wanted_activities: ["soirée"],
      ambiances: ["fete"],
      submitted_at: "2026-08-12",
    };

    const supabase = {
      from: (table: string) => {
        let data: any = [];
        if (table === "trips") data = tripsData;
        else if (table === "trip_participants") data = participantsData;
        else if (table === "trip_participant_preferences") data = preferencesData;
        else if (table === "trip_availability") data = availabilityData;
        else if (table === "trip_star_preferences") data = starPrefsData;

        const queryChain = {
          select: () => queryChain,
          eq: () => queryChain,
          maybeSingle: async () => ({ data, error: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return queryChain as any;
      },
    } as any;

    const result = await getParticipantsProgressHelper(supabase, tripId);

    expect(result.expected).toBe(3);
    expect(result.joined).toBe(2);
    expect(result.answered).toBe(3);
    expect(result.participants).toHaveLength(3);
    const secretStar = result.participants.find((participant) => participant.isSecretStar);
    expect(secretStar?.isStar).toBe(true);
    expect(secretStar?.hasAnswered).toBe(true);
  });

  describe("Krew dashboard Star logic and double counting scenarios", () => {
    const createSupabaseMock = ({
      participantsCount = 6,
      celebratedPerson = "Léa",
      hasStar = true,
      starUserId = "star-uid",
      participants = [] as any[],
      preferences = [] as any[],
      availabilities = [] as any[],
      starPrefs = null as any,
    }) => {
      const tripsData = {
        participants_count: participantsCount,
        celebrated_person: celebratedPerson,
        has_star: hasStar,
        star_user_id: starUserId,
        owner_id: "orga-uid",
        co_organizer_id: null,
        group_logistics: { star_mode: "secret" },
      };

      return {
        from: (table: string) => {
          let data: any = [];
          if (table === "trips") data = tripsData;
          else if (table === "trip_participants") data = participants;
          else if (table === "trip_participant_preferences") data = preferences;
          else if (table === "trip_availability") data = availabilities;
          else if (table === "trip_star_preferences") data = starPrefs;

          const queryChain = {
            select: () => queryChain,
            eq: () => queryChain,
            maybeSingle: async () => ({ data, error: null }),
            then: (resolve: any) => resolve({ data, error: null }),
          };
          return queryChain as any;
        },
      } as any;
    };

    const organizerAndSecretStar = [
      { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
      { id: "p2", user_id: "star-uid", email: null, display_name: "Léa", status: "accepte" },
    ];

    it("Scenario 1 : seuls l'organisateur et la Star secrète sont dans la population réelle", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({ participants: organizerAndSecretStar }),
        "trip-123",
      );
      expect(result.expected).toBe(2);
      expect(result.answered).toBe(0);
      expect(result.availabilityAnswered).toBe(0);
    });

    it("Scenario 2 : organisateur uniquement", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          preferences: [{ user_id: "orga-uid" }],
          availabilities: [{ user_id: "orga-uid" }],
        }),
        "trip-123",
      );
      expect(result.expected).toBe(2);
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 3 : Star secrète uniquement", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.expected).toBe(2);
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 4 : organisateur + Star secrète", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          preferences: [{ user_id: "orga-uid" }],
          availabilities: [{ user_id: "orga-uid" }],
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.expected).toBe(2);
      expect(result.answered).toBe(2);
      expect(result.availabilityAnswered).toBe(2);
    });

    it("Scenario 5 : organisateur + Star + 2 participants réels", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: [
            ...organizerAndSecretStar,
            { id: "p3", user_id: "p3-uid", email: "p3@krew.travel", display_name: "Participant 3", status: "accepte" },
            { id: "p4", user_id: "p4-uid", email: "p4@krew.travel", display_name: "Participant 4", status: "accepte" },
          ],
          preferences: [{ user_id: "orga-uid" }, { user_id: "p3-uid" }, { user_id: "p4-uid" }],
          availabilities: [{ user_id: "orga-uid" }, { user_id: "p3-uid" }, { user_id: "p4-uid" }],
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.expected).toBe(4);
      expect(result.answered).toBe(4);
      expect(result.availabilityAnswered).toBe(4);
    });

    it("Scenario 6 : les six membres réels ont répondu", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: [
            ...organizerAndSecretStar,
            { id: "p3", user_id: "p3-uid", email: "p3@krew.travel", display_name: "Participant 3", status: "accepte" },
            { id: "p4", user_id: "p4-uid", email: "p4@krew.travel", display_name: "Participant 4", status: "accepte" },
            { id: "p5", user_id: "p5-uid", email: "p5@krew.travel", display_name: "Participant 5", status: "accepte" },
            { id: "p6", user_id: "p6-uid", email: "p6@krew.travel", display_name: "Participant 6", status: "accepte" },
          ],
          preferences: [
            { user_id: "orga-uid" },
            { user_id: "p3-uid" },
            { user_id: "p4-uid" },
            { user_id: "p5-uid" },
            { user_id: "p6-uid" },
          ],
          availabilities: [
            { user_id: "orga-uid" },
            { user_id: "p3-uid" },
            { user_id: "p4-uid" },
            { user_id: "p5-uid" },
            { user_id: "p6-uid" },
          ],
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(6);
      expect(result.availabilityAnswered).toBe(6);
    });

    it("Scenario 7 : questionnaire Star rempli uniquement pour les préférences", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          starPrefs: { user_id: "orga-uid", wanted_activities: ["brunch"], submitted_at: "2026-08-12" },
        }),
        "trip-123",
      );
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(0);
    });

    it("Scenario 8 : questionnaire Star rempli uniquement pour les disponibilités", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          starPrefs: { user_id: "orga-uid", available_dates: ["2026-08-15"] },
        }),
        "trip-123",
      );
      expect(result.answered).toBe(0);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 9 : questionnaire Star rempli pour les deux", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 10, 11 & 12 : pas de double comptage de l'organisateur ou de la Star", async () => {
      const result = await getParticipantsProgressHelper(
        createSupabaseMock({
          participants: organizerAndSecretStar,
          preferences: [{ user_id: "orga-uid" }],
          availabilities: [{ user_id: "orga-uid" }],
          starPrefs: {
            user_id: "orga-uid",
            wanted_activities: ["brunch"],
            available_dates: ["2026-08-15"],
            submitted_at: "2026-08-12",
          },
        }),
        "trip-123",
      );
      expect(result.expected).toBe(2);
      expect(result.answered).toBe(2);
      expect(result.availabilityAnswered).toBe(2);
    });
  });
});