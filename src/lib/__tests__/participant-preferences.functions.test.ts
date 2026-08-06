import { describe, it, expect, vi } from 'vitest';
import { attachParticipantToTrip } from '../participant-preferences.functions';

describe('attachParticipantToTrip', () => {
  it('attaches only the matching unclaimed invite when there are 3 unclaimed invites', async () => {
    const tripId = 'trip-123';
    const userId = 'user-1';
    const userEmail = 'match@example.com';

    // Mock behavior: from('trip_participants').update(...).match(...) => select() returns one updated row
    const selectMock = vi.fn().mockResolvedValue({ data: [{ id: 3, trip_id: tripId, email: userEmail, user_id: userId }], error: null });
    const matchMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ match: matchMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const supabase = { from: fromMock } as any;

    const updated = await attachParticipantToTrip(supabase, tripId, userId, userEmail);

    expect(fromMock).toHaveBeenCalledWith('trip_participants');
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: 'accepte' });
    expect(matchMock).toHaveBeenCalledWith({ trip_id: tripId, email: userEmail, user_id: null });
    expect(selectMock).toHaveBeenCalled();

    expect(updated).toEqual({ id: 3, trip_id: tripId, email: userEmail, user_id: userId });
  });

  it('throws when no matching unclaimed invite exists', async () => {
    const tripId = 'trip-123';
    const userId = 'user-1';
    const userEmail = 'nomatch@example.com';

    const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const matchMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ match: matchMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const supabase = { from: fromMock } as any;

    await expect(attachParticipantToTrip(supabase, tripId, userId, userEmail)).rejects.toThrow(
      `No pending invitation found for email ${userEmail} on trip ${tripId}`,
    );

    expect(fromMock).toHaveBeenCalledWith('trip_participants');
    expect(updateMock).toHaveBeenCalledWith({ user_id: userId, status: 'accepte' });
    expect(matchMock).toHaveBeenCalledWith({ trip_id: tripId, email: userEmail, user_id: null });
    expect(selectMock).toHaveBeenCalled();
  });
});
