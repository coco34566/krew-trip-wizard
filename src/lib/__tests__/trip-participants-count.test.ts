import { describe, expect, it, vi } from "vitest";
import { tripParticipantsCountInputSchema, updateTripParticipantsCountForUser } from "../trips.functions";

const tripId = "11111111-1111-4111-8111-111111111111";

describe("modification du nombre de participants", () => {
  it.each([[1, false], [2, true], [25, true], [26, false], [2.5, false]])("valide %s: %s", (value, valid) => {
    expect(tripParticipantsCountInputSchema.safeParse({ tripId, participantsCount: value }).success).toBe(valid);
  });

  it("refuse co-organisateur et participant avant toute mise à jour", async () => {
    const update = vi.fn();
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: tripId, owner_id: "owner" }, error: null }) }) }), update }) };
    await expect(updateTripParticipantsCountForUser(supabase, "co-organizer", { tripId, participantsCount: 6 })).rejects.toThrow("propriétaire principal");
    await expect(updateTripParticipantsCountForUser(supabase, "participant", { tripId, participantsCount: 6 })).rejects.toThrow("propriétaire principal");
    expect(update).not.toHaveBeenCalled();
  });

  it("autorise l'owner et ne met à jour que le compteur et updated_at", async () => {
    const payloads: any[] = [];
    const updateChain = { eq: () => updateChain, select: () => updateChain, single: async () => ({ data: { participants_count: 6 }, error: null }) };
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: tripId, owner_id: "owner" }, error: null }) }) }), update: (payload: any) => { payloads.push(payload); return updateChain; } }) };
    await expect(updateTripParticipantsCountForUser(supabase, "owner", { tripId, participantsCount: 6 })).resolves.toEqual({ participantsCount: 6 });
    expect(payloads[0]).toEqual({ participants_count: 6, updated_at: expect.any(String) });
  });
});
