import { describe, it, expect, vi } from "vitest";
import { createTripHelper } from "../trips.functions";

describe("createTripHelper", () => {
  it("uses the correct fallback chain when wantsStar is true and fails fullPayload", async () => {
    let inserts: any[] = [];
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            insert: vi.fn((payload: any) => {
              inserts.push(payload);
              if (payload.start_date !== undefined) {
                // simulated failure on fullPayload
                return {
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: { message: "start_date schema mismatch" } }),
                  }),
                };
              }
              // succeed on starMidPayload
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: "trip-uuid-123" }, error: null }),
                }),
              };
            }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }),
    } as any;

    const data = {
      name: "EVJF de Camille",
      eventType: "evjf" as const,
      participants: 6,
      organizerFirstName: "Juliet",
      celebratedPerson: "Camille",
      budgetPerPerson: 400,
      departureCity: "Paris",
      ambiances: [],
      activityCategories: [],
      letKrewDecide: true,
      maxDistanceKm: 2000,
      excludedCountries: [],
      durationNights: 2,
      needsCityCenter: true,
      dietaryConstraints: [],
    };

    const result = await createTripHelper(supabaseMock, "user-organizer-uuid", "juliet@example.com", data);

    expect(result).toEqual({ tripId: "trip-uuid-123" });
    expect(inserts).toHaveLength(2);
    // fullPayload tried first
    expect(inserts[0].has_star).toBe(true);
    expect(inserts[0].celebrated_person).toBe("Camille");
    expect(inserts[0].start_date).toBeNull();
    // starMidPayload fallback tried second and succeeded, keeping Star fields
    expect(inserts[1].has_star).toBe(true);
    expect(inserts[1].celebrated_person).toBe("Camille");
    expect(inserts[1].start_date).toBeUndefined(); // starMidPayload omits start_date
  });

  it("throws immediately on starMinimalPayload failure instead of falling back to unsafe non-star payload", async () => {
    let inserts: any[] = [];
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            insert: vi.fn((payload: any) => {
              inserts.push(payload);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: "Database insert error" } }),
                }),
              };
            }),
          };
        }
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }),
    } as any;

    const data = {
      name: "EVJF de Camille",
      eventType: "evjf" as const,
      participants: 6,
      organizerFirstName: "Juliet",
      celebratedPerson: "Camille",
      budgetPerPerson: 400,
      departureCity: "Paris",
      ambiances: [],
      activityCategories: [],
      letKrewDecide: true,
      maxDistanceKm: 2000,
      excludedCountries: [],
      durationNights: 2,
      needsCityCenter: true,
      dietaryConstraints: [],
    };

    // Call and check that it throws the database error without falling back to non-star minimal payload
    await expect(
      createTripHelper(supabaseMock, "user-organizer-uuid", "juliet@example.com", data)
    ).rejects.toThrow(/Création voyage impossible \(type Star\)/);

    expect(inserts).toHaveLength(3); // Tried fullPayload -> starMidPayload -> starMinimalPayload
    expect(inserts.every((p) => p.has_star === true)).toBe(true);
    expect(inserts.every((p) => p.celebrated_person === "Camille")).toBe(true);
  });
});
