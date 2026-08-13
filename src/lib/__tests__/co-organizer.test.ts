import { describe, it, expect, vi } from "vitest";
import { isTripAdmin } from "../krew/engine";
import { setCoOrganizerHelper, inviteParticipantHelper, removeParticipantHelper } from "../trips.functions";

describe("Co-organisateur (engine.ts)", () => {
  it("autorise l'organisateur principal (isTripAdmin)", () => {
    const trip = {
      id: "trip-1",
      owner_id: "user-owner",
      co_organizer_id: null,
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "other-user")).toBe(false);
  });

  it("autorise le co-organisateur (isTripAdmin)", () => {
    const trip = {
      id: "trip-1",
      owner_id: "user-owner",
      co_organizer_id: "user-co-org",
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "user-co-org")).toBe(true);
    expect(isTripAdmin(trip, "other-user")).toBe(false);
  });

  it("gère les clés camelCase et snake_case", () => {
    const trip = {
      id: "trip-1",
      ownerId: "user-owner",
      coOrganizerId: "user-co-org",
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "user-co-org")).toBe(true);
  });
});

describe("setCoOrganizerHelper (trips.functions.ts)", () => {
  it("permet à l'organisateur principal de nommer un co-organisateur", async () => {
    const tripId = "trip-123";
    const ownerId = "user-owner";
    const coOrganizerId = "user-co-org";

    const updateMock = vi.fn().mockResolvedValue({ error: null });
    const eqUpdateMock = vi.fn(() => ({ then: (resolve: any) => resolve({ error: null }) }));

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: ownerId },
      error: null,
    });
    const eqSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: vi.fn(() => ({ eq: eqSelectMock })),
            update: vi.fn((payload) => {
              expect(payload.co_organizer_id).toBe(coOrganizerId);
              return { eq: eqUpdateMock };
            }),
          };
        }
        return {} as any;
      }),
    } as any;

    const result = await setCoOrganizerHelper(supabase, ownerId, tripId, coOrganizerId);
    expect(result).toEqual({ ok: true });
    expect(supabase.from).toHaveBeenCalledWith("trips");
  });

  it("permet à l'organisateur principal de retirer un co-organisateur", async () => {
    const tripId = "trip-123";
    const ownerId = "user-owner";

    const updateMock = vi.fn().mockResolvedValue({ error: null });
    const eqUpdateMock = vi.fn(() => ({ then: (resolve: any) => resolve({ error: null }) }));

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: ownerId },
      error: null,
    });
    const eqSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: vi.fn(() => ({ eq: eqSelectMock })),
            update: vi.fn((payload) => {
              expect(payload.co_organizer_id).toBeNull();
              return { eq: eqUpdateMock };
            }),
          };
        }
        return {} as any;
      }),
    } as any;

    const result = await setCoOrganizerHelper(supabase, ownerId, tripId, null);
    expect(result).toEqual({ ok: true });
  });

  it("interdit à un non-propriétaire de désigner un co-organisateur", async () => {
    const tripId = "trip-123";
    const ownerId = "user-owner";
    const otherUserId = "user-malicious";

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: ownerId },
      error: null,
    });
    const eqSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: vi.fn(() => ({ eq: eqSelectMock })),
          };
        }
        return {} as any;
      }),
    } as any;

    await expect(
      setCoOrganizerHelper(supabase, otherUserId, tripId, "user-co-org")
    ).rejects.toThrow("seul l'organisateur principal peut nommer un co-organisateur");
  });

  it("lève une erreur si le voyage est introuvable", async () => {
    const tripId = "trip-not-exists";

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eqSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: vi.fn(() => ({ eq: eqSelectMock })),
          };
        }
        return {} as any;
      }),
    } as any;

    await expect(
      setCoOrganizerHelper(supabase, "some-user", tripId, "user-co-org")
    ).rejects.toThrow("Voyage introuvable");
  });
});

describe("Gestion des invitations (inviteParticipantHelper / removeParticipantHelper)", () => {
  it("autorise l'organisateur principal à inviter un participant", async () => {
    const tripId = "trip-123";
    const ownerId = "user-owner";

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: ownerId, co_organizer_id: null },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: "p-new", trip_id: tripId, email: "new@krew.travel" },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return { select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) };
        }
        if (table === "trip_participants") {
          return { upsert: () => ({ select: () => ({ single: singleMock }) }) };
        }
        return {} as any;
      }),
    } as any;

    const res = await inviteParticipantHelper(supabase, ownerId, {
      tripId,
      email: "new@krew.travel",
    });
    expect(res.id).toBe("p-new");
  });

  it("autorise le co-organisateur à inviter un participant", async () => {
    const tripId = "trip-123";
    const coOrgId = "user-co-org";

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: "user-owner", co_organizer_id: coOrgId },
      error: null,
    });
    const singleMock = vi.fn().mockResolvedValue({
      data: { id: "p-new", trip_id: tripId, email: "new@krew.travel" },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return { select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) };
        }
        if (table === "trip_participants") {
          return { upsert: () => ({ select: () => ({ single: singleMock }) }) };
        }
        return {} as any;
      }),
    } as any;

    const res = await inviteParticipantHelper(supabase, coOrgId, {
      tripId,
      email: "new@krew.travel",
    });
    expect(res.id).toBe("p-new");
  });

  it("interdit à un participant normal d'inviter quelqu'un", async () => {
    const tripId = "trip-123";
    const normalUserId = "user-normal";

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: "user-owner", co_organizer_id: "user-co-org" },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return { select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) };
        }
        return {} as any;
      }),
    } as any;

    await expect(
      inviteParticipantHelper(supabase, normalUserId, { tripId, email: "new@krew.travel" })
    ).rejects.toThrow("seul l'organisateur ou co-organisateur peut inviter des participants");
  });

  it("autorise le co-organisateur à supprimer un participant", async () => {
    const tripId = "trip-123";
    const coOrgId = "user-co-org";
    const partId = "part-abc";

    const partMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: partId, trip_id: tripId },
      error: null,
    });
    const tripMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: "user-owner", co_organizer_id: coOrgId },
      error: null,
    });
    const deleteMock = vi.fn().mockResolvedValue({ error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trip_participants") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: partMaybeSingleMock }) }),
            delete: () => ({ eq: deleteMock }),
          };
        }
        if (table === "trips") {
          return { select: () => ({ eq: () => ({ maybeSingle: tripMaybeSingleMock }) }) };
        }
        return {} as any;
      }),
    } as any;

    const res = await removeParticipantHelper(supabase, coOrgId, { participantId: partId });
    expect(res).toEqual({ ok: true });
  });

  it("interdit à un participant normal de supprimer un autre participant", async () => {
    const tripId = "trip-123";
    const normalUserId = "user-normal";
    const partId = "part-abc";

    const partMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: partId, trip_id: tripId },
      error: null,
    });
    const tripMaybeSingleMock = vi.fn().mockResolvedValue({
      data: { id: tripId, owner_id: "user-owner", co_organizer_id: "user-co-org" },
      error: null,
    });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "trip_participants") {
          return { select: () => ({ eq: () => ({ maybeSingle: partMaybeSingleMock }) }) };
        }
        if (table === "trips") {
          return { select: () => ({ eq: () => ({ maybeSingle: tripMaybeSingleMock }) }) };
        }
        return {} as any;
      }),
    } as any;

    await expect(
      removeParticipantHelper(supabase, normalUserId, { participantId: partId })
    ).rejects.toThrow("seul l'organisateur ou co-organisateur peut retirer des participants");
  });
});
