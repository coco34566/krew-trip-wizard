import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => {
  const createServerFn = () => {
    let validator: any = null;
    const chain: any = {
      middleware: () => chain,
      inputValidator: (nextValidator: any) => {
        validator = nextValidator;
        return chain;
      },
      handler: (handlerFn: any) => {
        return async (args: any) => {
          let data = args?.data;
          if (validator) {
            data = typeof validator === "function" ? validator(data) : validator.parse(data);
          }
          return handlerFn({ data, context: args?.context });
        };
      },
    };
    return chain;
  };

  return { createServerFn };
});

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

const getCurrentBriefFingerprint = vi.fn();

vi.mock("@/lib/krew/trip-service", async () => {
  const { z } = await import("zod");
  return {
    aggregateParticipantPreferences: vi.fn(),
    generateRecommendationsForTrip: vi.fn(),
    canServeFromCandidatePool: vi.fn(),
    getCurrentBriefFingerprint,
    tripInputSchema: z.object({ tripId: z.string() }),
  };
});

describe("destination candidate pool selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentBriefFingerprint.mockResolvedValue("fingerprint-current");
  });

  it("selectRecommendation ne marque selected que la destination du fingerprint actif", async () => {
    const tripId = "00000000-0000-4000-8000-000000000001";
    const recommendationId = "00000000-0000-4000-8000-000000000002";
    const poolRows = [
      {
        trip_id: tripId,
        brief_fingerprint: "fingerprint-current",
        destination_key: "nice",
        status: "shown",
        selected_at: null,
      },
      {
        trip_id: tripId,
        brief_fingerprint: "fingerprint-old",
        destination_key: "nice",
        status: "shown",
        selected_at: null,
      },
    ];

    const supabase = {
      from: (table: string) => {
        if (table === "recommendations") {
          return {
            update: (_payload: any) => ({
              eq: (_field1: string, _value1: any) => ({
                eq: async (_field2: string, _value2: any) => ({ data: null, error: null }),
              }),
            }),
            select: (_columns: string) => ({
              eq: (_field1: string, _value1: any) => ({
                eq: (_field2: string, _value2: any) => ({
                  maybeSingle: async () => ({
                    data: { destinations: { name: "Nice" } },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "trip_preferences") {
          return {
            upsert: async (_payload: any, _options: any) => ({ data: null, error: null }),
          };
        }

        if (table === "destination_candidate_pool") {
          return {
            update: (payload: any) => ({
              eq: (field1: string, value1: any) => ({
                eq: (field2: string, value2: any) => ({
                  eq: async (field3: string, value3: any) => {
                    for (const row of poolRows) {
                      if (
                        (row as any)[field1] === value1 &&
                        (row as any)[field2] === value2 &&
                        (row as any)[field3] === value3
                      ) {
                        Object.assign(row, payload);
                      }
                    }
                    return { data: null, error: null };
                  },
                }),
              }),
            }),
          };
        }

        if (table === "trips") {
          return {
            update: (_payload: any) => ({
              eq: async (_field: string, _value: any) => ({ data: null, error: null }),
            }),
          };
        }

        throw new Error(`Unexpected table in test: ${table}`);
      },
    };

    const { selectRecommendation } = await import("../trips.functions");
    await (selectRecommendation as any)({
      data: { tripId, recommendationId },
      context: { supabase },
    });

    expect(getCurrentBriefFingerprint).toHaveBeenCalledWith(supabase, tripId);

    const current = poolRows.find((row) => row.brief_fingerprint === "fingerprint-current");
    const old = poolRows.find((row) => row.brief_fingerprint === "fingerprint-old");

    expect(current?.status).toBe("selected");
    expect(current?.selected_at).toBeTruthy();
    expect(old?.status).toBe("shown");
    expect(old?.selected_at).toBeNull();
  });
});
