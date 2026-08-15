import { describe, expect, it } from "vitest";
import { buildDeepLinksForProposal } from "../deep-links";
import { buildScoringContext, getEffectiveParticipantsCount } from "../trip-service";
import { buildProposals, type ScoringContext, type TravelCatalog } from "../engine";
import type { TransportQuote } from "@/integrations/external/transport.server";

describe("pipeline accommodation and transport offers tests", () => {
  it("A. ensures two different hotels retain distinct URLs (Hotel A URL !== Hotel B URL)", () => {
    const hotelA = {
      id: "acc-a",
      name: "Hôtel Rivage",
      type: "hôtel",
      booking_url: "https://www.booking.com/hotel/fr/hotel-rivage.fr.html",
      price_offers: [{ provider: "booking", url: "https://www.booking.com/hotel/fr/hotel-rivage.fr.html" }],
    };

    const hotelB = {
      id: "acc-b",
      name: "Villa Belle Vue",
      type: "villa",
      booking_url: "https://www.booking.com/hotel/fr/villa-belle-vue.fr.html",
      price_offers: [{ provider: "booking", url: "https://www.booking.com/hotel/fr/villa-belle-vue.fr.html" }],
    };

    const resolveUrl = (h: typeof hotelA) => h.booking_url || h.price_offers?.[0]?.url;

    const urlA = resolveUrl(hotelA);
    const urlB = resolveUrl(hotelB);

    expect(urlA).toBe("https://www.booking.com/hotel/fr/hotel-rivage.fr.html");
    expect(urlB).toBe("https://www.booking.com/hotel/fr/villa-belle-vue.fr.html");
    expect(urlA).not.toEqual(urlB);
  });

  it("B. ensures two different transport offers retain distinct URLs (Offer A URL !== Offer B URL)", () => {
    const offerA: TransportQuote = {
      pricePerPerson: 120,
      currency: "EUR",
      provider: "kayak",
      mode: "flight",
      label: "Vol Air France AF123",
      url: "https://provider.example/flights/af123",
      searchUrl: "https://www.kayak.fr/flights/PAR-NCE/2026-08-21/2026-08-23?adults=6",
    };

    const offerB: TransportQuote = {
      pricePerPerson: 85,
      currency: "EUR",
      provider: "kiwi",
      mode: "flight",
      label: "Vol EasyJet U2456",
      url: "https://provider.example/flights/u2456",
      searchUrl: "https://www.kayak.fr/flights/PAR-NCE/2026-08-21/2026-08-23?adults=6",
    };

    const resolveTransportUrl = (o: TransportQuote) => o.url || o.searchUrl;

    const urlA = resolveTransportUrl(offerA);
    const urlB = resolveTransportUrl(offerB);

    expect(urlA).toBe("https://provider.example/flights/af123");
    expect(urlB).toBe("https://provider.example/flights/u2456");
    expect(urlA).not.toEqual(urlB);
  });

  it("C. incomplete group: participants_count = 6 with 1 questionnaire builds search with 6 travelers", () => {
    const trip = { participants_count: 6, celebrated_person: null };
    const participants = [{ id: "p1", user_id: "u1", display_name: "Alice" }];

    const count = getEffectiveParticipantsCount(trip, participants);
    expect(count).toBe(6);

    const links = buildDeepLinksForProposal({
      destinationCity: "Annecy",
      origins: [],
      departDate: "2026-08-21",
      returnDate: "2026-08-23",
      groupAdults: count,
    });

    expect(links.bookingGroup).toContain("group_adults=6");
    expect(links.bookingGroup).toContain("no_rooms=3");
    expect(links.origins[0]?.kayak).toContain("adults=6");
  });

  it("D. strict fallback hierarchy: supplier URL -> searchUrl -> generic fallback", () => {
    const offerWithDirectUrl: TransportQuote = {
      pricePerPerson: 100,
      currency: "EUR",
      provider: "kayak",
      mode: "flight",
      label: "Vol Direct",
      url: "https://supplier.example/direct-deal",
      searchUrl: "https://search.example/search-exact",
    };

    const offerWithSearchUrlOnly: TransportQuote = {
      pricePerPerson: 100,
      currency: "EUR",
      provider: "kayak",
      mode: "flight",
      label: "Vol Recherche Exacte",
      url: null,
      searchUrl: "https://search.example/search-exact",
    };

    const offerWithNoUrls: TransportQuote = {
      pricePerPerson: 100,
      currency: "EUR",
      provider: "estimate",
      mode: "estimate",
      label: "Estimation",
      url: null,
      searchUrl: null,
    };

    const resolveHierarchy = (o: TransportQuote, genericFallback: string) => {
      return o.url || o.searchUrl || genericFallback;
    };

    const generic = "https://www.google.com/travel/flights";

    expect(resolveHierarchy(offerWithDirectUrl, generic)).toBe("https://supplier.example/direct-deal");
    expect(resolveHierarchy(offerWithSearchUrlOnly, generic)).toBe("https://search.example/search-exact");
    expect(resolveHierarchy(offerWithNoUrls, generic)).toBe(generic);
  });

  it("E. non-regression: theme proposals generation (buildProposals) generates themed proposals cleanly", () => {
    const catalog: TravelCatalog = {
      destinations: [
        {
          id: "dest-1",
          slug: "annecy",
          name: "Annecy",
          country: "France",
          distance_from_paris_km: 550,
          avg_daily_cost: 80,
          best_months: [6, 7, 8, 9],
          score_fete: 0.7,
          score_detente: 0.9,
          score_culturel: 0.6,
          score_aventure: 0.8,
          score_luxe: 0.5,
          score_insolite: 0.6,
          score_sportif: 0.8,
          rating: 4.5,
          popularity: 0.8,
        },
      ],
      activities: [],
      accommodations: [],
    };

    const ctx = buildScoringContext(
      {
        participants_count: 6,
        budget_per_person: 400,
        start_date: "2026-08-01",
        event_type: "evg",
      } as any,
      {
        ambiances: ["fete", "detente"],
        activity_categories: ["plein_air"],
        max_distance_km: 1000,
        individual_preferences: [
          {
            ambiances: ["fete"],
            activityCategories: ["plein_air"],
            budgetMax: 400,
            dealBreakerAmbiances: [],
            dealBreakerDestinations: [],
          },
        ],
      },
    );

    const proposals = buildProposals(catalog, ctx, 3);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.destination.name).toBe("Annecy");
    expect(proposals[0]?.score).toBeGreaterThan(0);
  });

  it("F. single origin with transport offers retains transportByOrigin and offer URLs", () => {
    const catalog: TravelCatalog = {
      destinations: [
        {
          id: "dest-1",
          slug: "annecy",
          name: "Annecy",
          country: "France",
          distance_from_paris_km: 550,
          avg_daily_cost: 80,
          best_months: [6, 7, 8, 9],
          score_fete: 0.7,
          score_detente: 0.9,
          score_culturel: 0.6,
          score_aventure: 0.8,
          score_luxe: 0.5,
          score_insolite: 0.6,
          score_sportif: 0.8,
          rating: 4.5,
          popularity: 0.8,
        },
      ],
      activities: [],
      accommodations: [],
    };

    const ctx = buildScoringContext(
      { participants_count: 6, budget_per_person: 400, start_date: "2026-08-01", event_type: "evg" } as any,
      { ambiances: ["fete"] },
    );

    ctx.transportOriginsByDestinationId = {
      "dest-1": [
        {
          city: "Paris",
          count: 6,
          pricePerPerson: 120,
          provider: "kayak",
          mode: "flight",
          label: "Vol Direct A",
          url: "https://provider.example/deal/flight-a",
          searchUrl: "https://www.kayak.fr/flights/PAR-GVA/2026-08-01/2026-08-03?adults=6",
        },
      ],
    };

    const proposals = buildProposals(catalog, ctx, 1);
    expect(proposals).toHaveLength(1);

    const budget = proposals[0]?.budget as any;
    expect(budget.transportByOrigin).toBeDefined();
    expect(budget.transportByOrigin).toHaveLength(1);
    expect(budget.transportByOrigin[0].city).toBe("Paris");
    expect(budget.transportByOrigin[0].url).toBe("https://provider.example/deal/flight-a");
    expect(budget.transportByOrigin[0].searchUrl).toContain("adults=6");
  });
});
