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
    const supabase = { from: fromMock } as any;

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
    const supabase = { from: fromMock } as any;

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
});
