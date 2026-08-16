import { describe, it, expect, vi } from 'vitest';
import { attachParticipantToTrip } from '../participant-preferences.functions';

describe('attachParticipantToTrip', () => {
  it('attaches only the matching unclaimed invite when there are 3 unclaimed invites', async () => {
    const tripId = 'trip-123';
    const userId = 'user-1';
    const userEmail = 'match@example.com';

    // Mock behavior: from('trip_participants').update(...).eq(...).ilike(...).is(...).select() returns one updated row
    const selectMock = vi.fn().mockResolvedValue({ data: [{ id: 3, trip_id: tripId, email: userEmail, user_id: userId }], error: null });
    const isMock = vi.fn(() => ({ select: selectMock }));
    const ilikeMock = vi.fn(() => ({ is: isMock }));
    const eqMock = vi.fn(() => ({ ilike: ilikeMock }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const authMock = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId, email: userEmail } } }) };
    const supabase = { from: fromMock, auth: authMock } as any;

    const updated = await attachParticipantToTrip(supabase, tripId, userId, userEmail);

    expect(fromMock).toHaveBeenCalledWith('trip_participants');
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: 'accepte' });
    expect(eqMock).toHaveBeenCalledWith('trip_id', tripId);
    expect(ilikeMock).toHaveBeenCalledWith('email', userEmail);
    expect(isMock).toHaveBeenCalledWith('user_id', null);
    expect(selectMock).toHaveBeenCalled();

    expect(updated).toEqual({ id: 3, trip_id: tripId, email: userEmail, user_id: userId });
  });

  it('throws when no matching unclaimed invite exists', async () => {
    const tripId = 'trip-123';
    const userId = 'user-1';
    const userEmail = 'nomatch@example.com';

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

    expect(fromMock).toHaveBeenCalledWith('trip_participants');
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: 'accepte' });
    expect(eqMock).toHaveBeenCalledWith('trip_id', tripId);
    expect(ilikeMock).toHaveBeenCalledWith('email', userEmail);
    expect(isMock).toHaveBeenCalledWith('user_id', null);
    expect(selectMock).toHaveBeenCalled();
  });
});

import { getParticipantsProgress, getParticipantsProgressHelper } from '../participant-preferences.functions';

describe('getParticipantsProgress', () => {
  it('handles star counting and expected total correctly without adding +1', async () => {
    const tripId = 'trip-123';

    // Mock responses for Supabase
    // 1. trips -> select("participants_count, celebrated_person, has_star, star_user_id")
    const tripsData = { participants_count: 6, celebrated_person: 'Titi', has_star: true, star_user_id: 'star-uid' };

    // 2. trip_participants -> select("id, user_id, email, display_name, status")
    const participantsData = [
      { id: 'p1', user_id: 'user-coco', email: 'coco@krew.travel', display_name: 'Coco', status: 'accepte' },
      { id: 'p2', user_id: 'star-uid', email: 'titi@krew.travel', display_name: 'Titi', status: 'accepte' },
      { id: 'p3', user_id: 'user-bruce', email: 'bruce@krew.travel', display_name: 'Bruce', status: 'accepte' },
    ];

    // 3. trip_participant_preferences -> select("user_id, submitted_at, updated_at")
    const preferencesData = [
      { user_id: 'user-coco', submitted_at: '2026-08-10', updated_at: null },
      { user_id: 'user-bruce', submitted_at: '2026-08-11', updated_at: null },
    ];

    // 4. trip_availability -> select("user_id")
    const availabilityData = [
      { user_id: 'user-coco' },
    ];

    // 5. trip_star_preferences -> select("*")
    const starPrefsData = {
      user_id: 'star-uid',
      wanted_activities: ['soirée'],
      ambiances: ['fete'],
      submitted_at: '2026-08-12',
    };

    const context = {
      supabase: {
        from: (table: string) => {
          let data: any = [];
          if (table === 'trips') data = tripsData;
          else if (table === 'trip_participants') data = participantsData;
          else if (table === 'trip_participant_preferences') data = preferencesData;
          else if (table === 'trip_availability') data = availabilityData;
          else if (table === 'trip_star_preferences') data = starPrefsData;

          const queryChain = {
            select: () => queryChain,
            eq: () => queryChain,
            maybeSingle: async () => ({ data, error: null }),
            then: (resolve: any) => resolve({ data, error: null }),
          };
          return queryChain as any;
        }
      }
    };

    const result = await getParticipantsProgressHelper(
      context.supabase,
      tripId,
    );

    expect(result.expected).toBe(6); // should match participants_count = 6
    expect(result.joined).toBe(3);   // 3 accepted
    expect(result.answered).toBe(3); // Coco + Bruce + Titi (via starPrefs)
    expect(result.participants.length).toBe(6); // 3 accepted + 3 padded generic participants
    expect(result.participants[1].isStar).toBe(true); // Titi is correctly marked as the star
    expect(result.participants[1].hasAnswered).toBe(true); // star has answered since starPrefs is filled
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

    it("Scenario 1 : Groupe de 6, personne n'a répondu", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(0);
      expect(result.availabilityAnswered).toBe(0);
    });

    it("Scenario 2 : Groupe de 6, organisateur uniquement", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        preferences: [{ user_id: "orga-uid" }],
        availabilities: [{ user_id: "orga-uid" }],
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 3 : Groupe de 6, Star uniquement", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        starPrefs: {
          user_id: "orga-uid", // Rempli par l'organisateur (user_id est l'id de l'orga en base)
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(1); // La star uniquement (les prefs de l'orga ne sont pas remplies)
      expect(result.availabilityAnswered).toBe(1); // La star uniquement
    });

    it("Scenario 4 : Groupe de 6, organisateur + Star", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        preferences: [{ user_id: "orga-uid" }],
        availabilities: [{ user_id: "orga-uid" }],
        starPrefs: {
          user_id: "orga-uid", // rempli par l'orga
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(2);
      expect(result.availabilityAnswered).toBe(2);
    });

    it("Scenario 5 : Groupe de 6, organisateur + Star + 2 participants", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
          { id: "p3", user_id: "p3-uid", email: "p3@krew.travel", display_name: "Participant 3", status: "accepte" },
          { id: "p4", user_id: "p4-uid", email: "p4@krew.travel", display_name: "Participant 4", status: "accepte" },
        ],
        preferences: [{ user_id: "orga-uid" }, { user_id: "p3-uid" }, { user_id: "p4-uid" }],
        availabilities: [{ user_id: "orga-uid" }, { user_id: "p3-uid" }, { user_id: "p4-uid" }],
        starPrefs: {
          user_id: "orga-uid", // rempli par l'orga
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(4);
      expect(result.availabilityAnswered).toBe(4);
    });

    it("Scenario 6 : Groupe de 6, tout le monde", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
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
          user_id: "orga-uid", // rempli par l'orga
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6);
      expect(result.answered).toBe(6);
      expect(result.availabilityAnswered).toBe(6);
    });

    it("Scenario 7 : Questionnaire Star rempli uniquement pour les préférences", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        starPrefs: {
          user_id: "orga-uid",
          submitted_at: "2026-08-12",
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.answered).toBe(1); // Star a répondu aux préférences
      expect(result.availabilityAnswered).toBe(0); // Star n'a pas répondu aux dispos
    });

    it("Scenario 8 : Questionnaire Star rempli uniquement pour les disponibilités", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        starPrefs: {
          user_id: "orga-uid",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.answered).toBe(0); // Star n'a pas de préférences
      expect(result.availabilityAnswered).toBe(1); // Star a répondu aux dispos
    });

    it("Scenario 9 : Questionnaire Star rempli pour les deux", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        starPrefs: {
          user_id: "orga-uid",
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.answered).toBe(1);
      expect(result.availabilityAnswered).toBe(1);
    });

    it("Scenario 10, 11 & 12 : Pas de double comptage de la Star, dénominateur inchangé", async () => {
      const supabase = createSupabaseMock({
        participants: [
          { id: "p1", user_id: "orga-uid", email: "orga@krew.travel", display_name: "Organisateur", status: "accepte" },
          { id: "p2", user_id: "star-uid", email: "star@krew.travel", display_name: "Léa", status: "accepte" },
        ],
        preferences: [{ user_id: "orga-uid" }],
        availabilities: [{ user_id: "orga-uid" }],
        starPrefs: {
          user_id: "orga-uid", // l'id de l'orga est stocké dans le user_id de la star car rempli par lui
          submitted_at: "2026-08-12",
          available_dates: ["2026-08-15"],
        },
      });
      const result = await getParticipantsProgressHelper(supabase, "trip-123");
      expect(result.expected).toBe(6); // dénominateur reste 6, la Star n'en crée pas une 7e
      expect(result.answered).toBe(2); // 1 orga + 1 star = 2, pas de double comptage de l'orga ou de la star
      expect(result.availabilityAnswered).toBe(2); // 1 orga + 1 star = 2
    });
  });
});
