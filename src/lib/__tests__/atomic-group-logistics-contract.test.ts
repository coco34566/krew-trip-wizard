import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getTripDetail as routedGetTripDetail,
  pickTransport as routedPickTransport,
  voteHotel as routedVoteHotel,
} from "@/lib/trips.functions";
import {
  getTripDetail as legacyGetTripDetail,
  pickTransport as legacyPickTransport,
  voteHotel as legacyVoteHotel,
} from "../trips.functions";
import {
  pickTransportAtomic,
  voteHotelAtomic,
} from "../trips-logistics-atomic.functions";

describe("atomic group_logistics wiring", () => {
  it("overrides only hotel votes and transport picks", () => {
    expect(routedVoteHotel).toBe(voteHotelAtomic);
    expect(routedPickTransport).toBe(pickTransportAtomic);
    expect(routedVoteHotel).not.toBe(legacyVoteHotel);
    expect(routedPickTransport).not.toBe(legacyPickTransport);
    expect(routedGetTripDetail).toBe(legacyGetTripDetail);
  });

  it("keeps the RPCs row-locked and service-role-only", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260830193000_atomic_group_logistics_mutations.sql",
      ),
      "utf8",
    );

    expect(migration.match(/for update;/gi)?.length).toBe(2);
    expect(migration).toContain(
      "revoke all on function public.krew_vote_hotel_atomic(uuid, uuid, text) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "revoke all on function public.krew_pick_transport_atomic(uuid, uuid, jsonb) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.krew_vote_hotel_atomic(uuid, uuid, text) to service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.krew_pick_transport_atomic(uuid, uuid, jsonb) to service_role;",
    );
  });
});
