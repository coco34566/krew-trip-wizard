import { describe, expect, it } from "vitest";

import { getExternalSearchParticipantsCount } from "@/lib/krew/external-group-size";

describe("getExternalSearchParticipantsCount", () => {
  it("keeps uninvited planned places in the declared group size", () => {
    expect(
      getExternalSearchParticipantsCount(
        { participants_count: 10 },
        [{ status: "accepte" }, { status: "invite" }, { status: "accepte" }],
      ),
    ).toBe(10);
  });

  it("removes known absent and refused participants from external searches", () => {
    expect(
      getExternalSearchParticipantsCount(
        { participants_count: 10 },
        [
          { status: "accepte" },
          { status: "accepte" },
          { status: "absent" },
          { status: "refuse" },
        ],
      ),
    ).toBe(8);
  });

  it("never goes below the number of known active participant rows", () => {
    expect(
      getExternalSearchParticipantsCount(
        { participants_count: 2 },
        [
          { status: "accepte" },
          { status: "invite" },
          { status: "accepte" },
          { status: "absent" },
        ],
      ),
    ).toBe(3);
  });

  it("falls back to at least one traveller when data is incomplete", () => {
    expect(getExternalSearchParticipantsCount({ participants_count: 0 }, [])).toBe(1);
    expect(getExternalSearchParticipantsCount(null, null)).toBe(1);
  });
});
