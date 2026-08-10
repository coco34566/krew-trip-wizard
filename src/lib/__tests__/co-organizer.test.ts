import { describe, it, expect, vi } from "vitest";
import { isTripAdmin } from "../krew/engine";
import { setCoOrganizerHelper } from "../trips.functions";

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
