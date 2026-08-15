import { describe, expect, it } from "vitest";
import { buildDeepLinksForProposal } from "../deep-links";

describe("group-aware accommodation and transport links", () => {
  it("uses the declared group size for accommodation fallback links", () => {
    const links = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [{ city: "Paris", count: 1 }],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    expect(links.bookingGroup).toContain("group_adults=6");
    expect(links.bookingGroup).toContain("no_rooms=3");
  });

  it("does not invent six known transport participants from a single known origin", () => {
    const links = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [{ city: "Paris", count: 1 }],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    expect(links.origins).toHaveLength(1);
    expect(links.origins[0]?.adults).toBe(1);
    expect(links.origins[0]?.kayak).toContain("adults=1");
  });

  it("uses the whole group only when no individual origin is known", () => {
    const links = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: 6,
    });

    expect(links.origins).toHaveLength(1);
    expect(links.origins[0]?.adults).toBe(6);
    expect(links.origins[0]?.kayak).toContain("adults=6");
  });
});
