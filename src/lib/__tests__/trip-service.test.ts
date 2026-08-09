import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assessGenerationReadiness, generateRecommendationsForTrip } from "../krew/trip-service";
import { assertNotRateLimited } from "../krew/rate-limit.server";
import { appendAffiliateParam, buildOriginDeepLinks } from "../krew/deep-links";

describe("Trip Service & Readiness (trip-service.ts)", () => {
  it("autorise la génération même si aucune préférence n'est renseignée (prefsOk reste true)", async () => {
    const tripId = "trip-123";
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { participants_count: 3, dates_locked: true, start_date: "2026-08-01", end_date: "2026-08-03" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "trip_participants") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", user_id: "u1" },
                    { id: "p2", user_id: "u2" },
                    { id: "p3", user_id: null },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_participant_preferences") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [], // Aucune réponse ! -> prefsOk reste true
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_availability") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1" },
                    { user_id: "u2" },
                  ], // 2 dispos -> availabilityOk reste true
                  error: null,
                }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      }),
    } as any;

    const readiness = await assessGenerationReadiness(supabaseMock, tripId);
    expect(readiness.canGenerate).toBe(true);
    expect(readiness.checklist.prefsOk).toBe(true);
    expect(readiness.checklist.availabilityOk).toBe(true);
    expect(readiness.checklist.datesLocked).toBe(true);
  });

  it("autorise la génération même si aucune disponibilité n'est renseignée (availabilityOk reste true)", async () => {
    const tripId = "trip-123";
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { participants_count: 3, dates_locked: true, start_date: "2026-08-01", end_date: "2026-08-03" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "trip_participants") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", user_id: "u1" },
                    { id: "p2", user_id: "u2" },
                    { id: "p3", user_id: null },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_participant_preferences") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1", ambiances: ["fete"] },
                    { user_id: "u2", ambiances: ["detente"] },
                  ], // 2 réponses -> prefsOk reste true
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_availability") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [], // Aucune dispo ! -> availabilityOk reste true
                  error: null,
                }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      }),
    } as any;

    const readiness = await assessGenerationReadiness(supabaseMock, tripId);
    expect(readiness.canGenerate).toBe(true);
    expect(readiness.checklist.prefsOk).toBe(true);
    expect(readiness.checklist.availabilityOk).toBe(true);
    expect(readiness.checklist.datesLocked).toBe(true);
  });

  it("bloque la génération si datesLocked est faux", async () => {
    const tripId = "trip-123";
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { participants_count: 3, dates_locked: false }, // Dates non validées !
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "trip_participants") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", user_id: "u1" },
                    { id: "p2", user_id: "u2" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_participant_preferences") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1" },
                    { user_id: "u2" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_availability") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1" },
                    { user_id: "u2" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      }),
    } as any;

    const readiness = await assessGenerationReadiness(supabaseMock, tripId);
    expect(readiness.canGenerate).toBe(false);
    expect(readiness.checklist.datesLocked).toBe(false);
  });

  it("autorise la génération dans le cas nominal (canGenerate = true)", async () => {
    const tripId = "trip-123";
    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "trips") {
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { participants_count: 2, dates_locked: true, start_date: "2026-08-01", end_date: "2026-08-03" },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === "trip_participants") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { id: "p1", user_id: "u1" },
                    { id: "p2", user_id: "u2" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_participant_preferences") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1", ambiances: ["fete"] },
                    { user_id: "u2", ambiances: ["detente"] },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === "trip_availability") {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    { user_id: "u1" },
                    { user_id: "u2" },
                  ],
                  error: null,
                }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        };
      }),
    } as any;

    const readiness = await assessGenerationReadiness(supabaseMock, tripId);
    expect(readiness.canGenerate).toBe(true);
    expect(readiness.checklist.prefsOk).toBe(true);
    expect(readiness.checklist.availabilityOk).toBe(true);
    expect(readiness.checklist.datesLocked).toBe(true);
  });
});

describe("Rate Limiting (rate-limit.server.ts)", () => {
  it("autorise le premier appel, bloque le second, autorise de nouveau après expiration", async () => {
    const tripId = "trip-123";
    const userId = "user-123";
    const kind = "recommendations";

    let rateLimitsDb: any[] = [];

    // Chaine de mock récursive robuste
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      gt: () => chain,
      order: () => Promise.resolve({ data: rateLimitsDb, error: null }),
      insert: (payload: any) => {
        rateLimitsDb.push({
          created_at: new Date().toISOString(),
          ...payload,
        });
        return Promise.resolve({ error: null });
      },
    };

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "generation_rate_limits") {
          return chain;
        }
        return {} as any;
      }),
    } as any;

    // 1er appel : valide, doit insérer en base
    await assertNotRateLimited(supabaseMock, {
      tripId,
      userId,
      kind,
      windowSeconds: 300,
      maxCalls: 1,
    });

    expect(rateLimitsDb).toHaveLength(1);

    // 2e appel immédiat : bloqué par le rate limit
    await expect(
      assertNotRateLimited(supabaseMock, {
        tripId,
        userId,
        kind,
        windowSeconds: 300,
        maxCalls: 1,
      })
    ).rejects.toThrow(/Une génération est déjà en cours/);

    // 3e appel en simulant l'expiration de la fenêtre (on vide ou on décale les dates de la DB factice)
    rateLimitsDb = []; // Équivaut à une expiration de fenêtre ou fenêtre vide
    await assertNotRateLimited(supabaseMock, {
      tripId,
      userId,
      kind,
      windowSeconds: 300,
      maxCalls: 1,
    });

    expect(rateLimitsDb).toHaveLength(1);
  });
});

describe("Affiliation deep-links (deep-links.ts)", () => {
  afterEach(() => {
    delete process.env.KAYAK_AFFILIATE_ID;
    delete process.env.BOOKING_AFFILIATE_ID;
    delete process.env.OMIO_AFFILIATE_ID;
    delete process.env.GYG_AFFILIATE_ID;
  });

  it("ajoute le tag d'affiliation si la variable d'env est définie", () => {
    process.env.KAYAK_AFFILIATE_ID = "kayak123";
    process.env.BOOKING_AFFILIATE_ID = "booking456";
    process.env.OMIO_AFFILIATE_ID = "omio789";
    process.env.GYG_AFFILIATE_ID = "gyg012";

    const baseKayak = "https://www.kayak.fr/flights/PAR-BCN/2026-08-01/2026-08-04?adults=1";
    const resultKayak = appendAffiliateParam(baseKayak, "a", "KAYAK_AFFILIATE_ID");
    expect(resultKayak).toContain("a=kayak123");

    const links = buildOriginDeepLinks({
      originCity: "Paris",
      destinationCity: "Barcelone",
      departDate: "2026-08-01",
      returnDate: "2026-08-04",
      adults: 1,
    });

    expect(links.kayak).toContain("a=kayak123");
    expect(links.booking).toContain("aid=booking456");
    expect(links.getYourGuide).toContain("partner_id=gyg012");
  });

  it("ne modifie pas l'URL d'origine si la variable d'env est absente ou vide", () => {
    delete process.env.KAYAK_AFFILIATE_ID;
    process.env.BOOKING_AFFILIATE_ID = " ";

    const baseKayak = "https://www.kayak.fr/flights/PAR-BCN/2026-08-01/2026-08-04?adults=1";
    const resultKayak = appendAffiliateParam(baseKayak, "a", "KAYAK_AFFILIATE_ID");
    expect(resultKayak).toBe(baseKayak); // Inchangé

    const links = buildOriginDeepLinks({
      originCity: "Paris",
      destinationCity: "Barcelone",
      departDate: "2026-08-01",
      returnDate: "2026-08-04",
      adults: 1,
    });

    expect(links.kayak).not.toContain("a=");
    expect(links.booking).not.toContain("aid=");
  });
});
