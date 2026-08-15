import { describe, expect, it } from "vitest";
import { buildDeepLinksForProposal } from "@/lib/krew/deep-links";

describe("deep links group size", () => {
  it("uses the full group size for the accommodation fallback", () => {
    const result = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [{ city: "Paris", count: 1 }],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    const booking = new URL(result.bookingGroup);
    expect(booking.searchParams.get("group_adults")).toBe("6");
    expect(booking.searchParams.get("no_rooms")).toBe("3");
  });

  it("keeps a known origin count separate from the total group size", () => {
    const result = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [{ city: "Paris", count: 1 }],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    expect(result.origins).toHaveLength(1);
    expect(result.origins[0]?.adults).toBe(1);
  });

  it("uses the full group size when no origin is known", () => {
    const result = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    expect(result.origins[0]?.adults).toBe(6);
  });
});
