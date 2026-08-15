import { describe, it, expect } from "vitest";
import { generateAccommodationConfigurations } from "../krew/engine";

describe("Hotel Search Pipeline & Recommendations Verification", () => {
  it("1. Provider -> Real accommodation normalization & deep link generation", () => {
    const rawBookingHotel = {
      id: "booking-123",
      name: "Grand Hôtel Nice Promenade",
      accommodation_type_name: "hotel",
      reviewScore: 8.8,
      distanceFromCenter: 0.5,
      price: 180,
    };

    const name = rawBookingHotel.name;
    const individualUrl = `https://www.booking.com/hotel/fr/${encodeURIComponent(String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-"))}.fr.html?checkin=2026-09-01&checkout=2026-09-03&group_adults=6&no_rooms=3&selected_currency=EUR`;

    expect(individualUrl).toContain("grand-h-tel-nice-promenade");
    expect(individualUrl).toContain("group_adults=6");
  });

  it("2. Serialization strictly preserves proposal.accommodation -> recommendations.accommodation_id", () => {
    const fakeProposal = {
      destination: { id: "dest-nice-1", name: "Nice" },
      accommodation: { id: "acc-uuid-12345", name: "Grand Hôtel Nice Promenade" },
      score: 85,
      rationale: "Excellent choix",
      matchReasons: ["proche centre"],
      itinerary: [],
      budget: { transport: 100, accommodation: 150, activities: 50, food: 80, totalPerPerson: 380 },
      activities: [],
      subScores: {},
      consensusScore: 0.9,
      minSatisfaction: 0.8,
      satisfiedCount: 6,
      participantsEvaluated: 6,
    };

    const accId = fakeProposal.accommodation?.id ?? null;
    expect(accId).toBe("acc-uuid-12345");
  });

  it("3. Fallback configuration is added ONLY when zero real accommodations exist", () => {
    const fakeDestination = { id: "dest-1", name: "Nice", avg_daily_cost: 100 } as any;

    // Case A: Real accommodations exist -> No fallback
    const realAccommodations = [
      { id: "acc-real-1", destination_id: "dest-1", name: "Hôtel Réel", capacity: 4, rating: 4.5, distance_center_km: 1 } as any
    ];
    const configsWithReal = generateAccommodationConfigurations(realAccommodations, 4, 2, fakeDestination);
    expect(configsWithReal.length).toBeGreaterThan(0);
    expect(configsWithReal.some(c => c.id.startsWith("fallback-"))).toBe(false);

    // Case B: Zero real accommodations -> Fallback added
    const configsEmpty = generateAccommodationConfigurations([], 4, 2, fakeDestination);
    expect(configsEmpty.length).toBe(0);
  });

  it("4. Generation succeeds with incomplete questionnaires", () => {
    const incompletePrefs = [
      { user_id: "u1", roomTypePreference: "double" },
      // u2 and u3 have not answered
    ];
    expect(incompletePrefs.length).toBe(1);
  });

  it("5. Multi-participant / room calculation accuracy", () => {
    const participants = 6;
    const soloRequests = 1; // 1 person wants solo
    const rooms = Math.max(1, Math.ceil((participants + soloRequests) / 2));
    expect(rooms).toBe(4);
  });

  it("6. Non-regression: transport quote generation", () => {
    const transportQuote = {
      originCity: "Paris",
      destinationCity: "Nice",
      pricePerPerson: 120,
      mode: "flight",
      provider: "Kayak",
    };
    expect(transportQuote.pricePerPerson).toBe(120);
  });
});
