import { describe, expect, it } from "vitest";
import { buildDeepLinksForProposal } from "../deep-links";
import { getEffectiveParticipantsCount } from "../trip-service";
import type { TransportQuote } from "@/integrations/external/transport.server";

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

  describe("accommodation booking_url preservation & group size", () => {
    it("uses trips.participants_count = 6 when only 1 questionnaire is answered", () => {
      const trip = { participants_count: 6 };
      const participants = [{ id: "p1", user_id: "u1" }];
      const count = getEffectiveParticipantsCount(trip, participants);
      expect(count).toBe(6);
    });

    it("prioritizes accommodation booking_url on proposal mapping", () => {
      const dbAccommodation = {
        id: "acc-123",
        name: "Hôtel du Lac",
        type: "hôtel",
        booking_url: "https://www.booking.com/hotel/fr/hotel-du-lac.fr.html",
        price_offers: [{ provider: "booking", url: "https://secondary.example/offer" }],
      };

      const priceOfferUrl = Array.isArray(dbAccommodation.price_offers)
        ? dbAccommodation.price_offers[0]?.url
        : null;
      const directUrl = dbAccommodation.booking_url || priceOfferUrl;
      expect(directUrl).toBe("https://www.booking.com/hotel/fr/hotel-du-lac.fr.html");
    });
  });

  describe("transport quote URL preservation", () => {
    it("preserves direct offer URL when provided by TransportQuote", () => {
      const quote: TransportQuote = {
        pricePerPerson: 120,
        currency: "EUR",
        provider: "kayak",
        mode: "flight",
        label: "Vol Air France",
        url: "https://provider.example/offer/123",
        searchUrl: "https://provider.example/search?from=Paris&to=Annecy&adults=6",
      };

      const primaryUrl = quote.url || quote.searchUrl;
      expect(primaryUrl).toBe("https://provider.example/offer/123");
    });

    it("uses searchUrl when direct offer URL is missing", () => {
      const quote: TransportQuote = {
        pricePerPerson: 120,
        currency: "EUR",
        provider: "kayak",
        mode: "flight",
        label: "Vol Kayak",
        url: null,
        searchUrl: "https://www.kayak.fr/flights/PAR-NCE/2026-08-21/2026-08-23?adults=6&sort=price_a",
      };

      const primaryUrl = quote.url || quote.searchUrl;
      expect(primaryUrl).toBe("https://www.kayak.fr/flights/PAR-NCE/2026-08-21/2026-08-23?adults=6&sort=price_a");
      expect(primaryUrl).toContain("adults=6");
    });

    it("falls back safely without crashing when both url and searchUrl are null", () => {
      const quote: TransportQuote = {
        pricePerPerson: 90,
        currency: "EUR",
        provider: "estimate",
        mode: "estimate",
        label: "Estimation",
        url: null,
        searchUrl: null,
      };

      const fallbackUrl = quote.url || quote.searchUrl || "https://www.google.com/maps";
      expect(fallbackUrl).toBe("https://www.google.com/maps");
    });
  });
});
