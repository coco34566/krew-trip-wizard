import { describe, expect, it } from "vitest";

import { canArchiveTrip } from "@/lib/trip-cancel-owner.functions";

describe("trip archive permissions", () => {
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const coOrganizerId = "00000000-0000-4000-8000-000000000002";

  it("allows the organizer to archive", () => {
    expect(canArchiveTrip({ owner_id: ownerId }, ownerId)).toBe(true);
  });

  it("does not allow the co-organizer to archive", () => {
    expect(canArchiveTrip({ owner_id: ownerId }, coOrganizerId)).toBe(false);
  });
});
