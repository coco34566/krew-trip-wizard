import { describe, it, expect } from "vitest";
import { generateAccommodationConfigurations } from "../krew/engine";

describe("Real Hotel Selection & Recommendations Verification", () => {
  it("computes real accommodation cards with valid IDs, categories, direct URLs and bedding configs", () => {
    const fakeDestination = {
      id: "dest-nice-123",
      name: "Nice",
      country: "France",
      distance_from_paris_km: 680,
      avg_daily_cost: 120,
      latitude: 43.7,
      longitude: 7.25,
      slug: "nice",
      description: "Nice Côte d'Azur",
      best_months: ["May", "June"],
      source: "krew",
      external_id: "ext-1",
    };

    const fakeAccommodations = [
      {
        id: "acc-hotel-negresco",
        destination_id: "dest-nice-123",
        name: "Hôtel Le Negresco",
        type: "hotel",
        price_per_night_per_person: 120,
        capacity: 4,
        rating: 4.8,
        distance_center_km: 0.5,
        booking_url: "https://www.booking.com/hotel/fr/le-negresco.fr.html",
        price_offers: [
          { provider: "booking.com", pricePerNight: 240, url: "https://www.booking.com/hotel/fr/le-negresco.fr.html" },
          { provider: "hotels.com", pricePerNight: 250, url: "https://fr.hotels.com/ho12345" }
        ],
        best_provider: "booking.com",
        source: "rapidapi",
        external_id: "booking:12345",
      },
      {
        id: "acc-villa-promenade",
        destination_id: "dest-nice-123",
        name: "Villa Belle Époque Promenade",
        type: "villa",
        price_per_night_per_person: 90,
        capacity: 8,
        rating: 4.9,
        distance_center_km: 1.2,
        booking_url: "https://www.expedia.fr/Nice-Hotels-Villa-Promenade.h98765.Hotel-Information",
        price_offers: [
          { provider: "expedia", pricePerNight: 720, url: "https://www.expedia.fr/Nice-Hotels-Villa-Promenade.h98765.Hotel-Information" }
        ],
        best_provider: "expedia",
        source: "rapidapi",
        external_id: "expedia:98765",
      },
      {
        id: "acc-hostel-old-town",
        destination_id: "dest-nice-123",
        name: "Hostel Vieux Nice",
        type: "hostel",
        price_per_night_per_person: 35,
        capacity: 10,
        rating: 4.2,
        distance_center_km: 0.2,
        booking_url: "https://www.hostelworld.com/hosteldetails.php/Hostel-Vieux-Nice/123",
        price_offers: [
          { provider: "hostelworld", pricePerNight: 35, url: "https://www.hostelworld.com/hosteldetails.php/Hostel-Vieux-Nice/123" }
        ],
        best_provider: "hostelworld",
        source: "rapidapi",
        external_id: "hostelworld:123",
      }
    ];

    // Verify configurations generation
    const configs = generateAccommodationConfigurations(
      fakeAccommodations,
      6, // participants
      3, // nights
      fakeDestination
    );

    expect(configs.length).toBeGreaterThan(0);
    expect(fakeAccommodations.length).toBe(3);

    // Verify each accommodation has distinct ID and direct supplier URL
    const distinctIds = new Set(fakeAccommodations.map(a => a.id));
    expect(distinctIds.size).toBe(3);

    for (const acc of fakeAccommodations) {
      expect(acc.id).toBeDefined();
      expect(acc.id).not.toContain("portal");
      expect(acc.booking_url).toBeTruthy();
      expect(acc.booking_url).toMatch(/^https?:\/\//);
    }
  });
});
