import { describe, expect, it } from "vitest";

import { repairPlanningVerifiedPlaces } from "../trips-planning-resolved.functions";

const realRestaurant = {
  id: "real-cascais-restaurant",
  name: "Casa dos Pescadores",
  category: "catering.restaurant",
  categories: ["catering.restaurant"],
  address: "Avenida Vasco da Gama 133, Cascais, Portugal",
  latitude: 38.69598,
  longitude: -9.42249,
  distanceMeters: 120,
  website: "https://casadospescadores.example",
  source: "geoapify" as const,
  verified: true,
};

describe("planning verified-place repair", () => {
  it("replaces an unresolved AI venue with a real intent-compatible place from the grounded pool", async () => {
    const itinerary = {
      destination: "Côte de Cascais & Sintra",
      usedCandidateIds: [],
      placePools: {
        "restaurant::catering.restaurant": [realRestaurant],
      },
      skeleton: {
        days: [
          {
            day: 1,
            slots: [
              {
                time: "20:00",
                type: "resto",
                category: "repas",
                label: "Dîner festif pour la future mariée",
                searchIntent: "restaurant festif tendance centre Cascais",
                venueFamily: "restaurant",
              },
            ],
          },
        ],
      },
      days: [
        {
          day: 1,
          date: "2026-09-19",
          slots: [
            {
              time: "20:00",
              endTime: "22:00",
              durationMinutes: 120,
              type: "resto",
              category: "repas",
              venueFamily: "restaurant",
              searchIntent: "restaurant festif tendance centre Cascais",
              label: "Restaurant IA inventé",
              detail: "Une table festive.",
              verified: false,
              source: "krew",
              url: "https://www.google.com/maps/search/?api=1&query=generic",
            },
          ],
        },
      ],
    };

    const repaired = await repairPlanningVerifiedPlaces(itinerary, {
      selectCandidate: async ({ candidates }) => candidates[0] ?? null,
      resolveResource: (place) => ({
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address}`)}`,
        resourceKind: "maps",
      }),
    });

    const slot = repaired.days[0].slots[0];
    expect(slot.verified).toBe(true);
    expect(slot.label).toBe("Casa dos Pescadores");
    expect(slot.address).toContain("Cascais");
    expect(slot.url).toContain("Casa%20dos%20Pescadores");
    expect(repaired.usedCandidateIds).toContain("real-cascais-restaurant");
  });

  it("keeps honest activity wording when no real place can be verified", async () => {
    const itinerary = {
      destination: "Côte de Cascais & Sintra",
      usedCandidateIds: [],
      placePools: {
        "restaurant::catering.restaurant": [realRestaurant],
      },
      skeleton: {
        days: [
          {
            day: 1,
            slots: [
              {
                time: "20:00",
                type: "resto",
                category: "repas",
                label: "Dîner convivial au centre",
                searchIntent: "restaurant convivial centre Cascais",
                venueFamily: "restaurant",
              },
            ],
          },
        ],
      },
      days: [
        {
          day: 1,
          date: "2026-09-19",
          slots: [
            {
              time: "20:00",
              type: "resto",
              category: "repas",
              venueFamily: "restaurant",
              searchIntent: "restaurant convivial centre Cascais",
              label: "Nom IA non vérifié",
              verified: false,
              source: "krew",
            },
          ],
        },
      ],
    };

    const repaired = await repairPlanningVerifiedPlaces(itinerary, {
      selectCandidate: async () => null,
      resolveResource: () => ({ url: null, resourceKind: null }),
    });

    const slot = repaired.days[0].slots[0];
    expect(slot.verified).toBe(false);
    expect(slot.label).toBe("Dîner convivial au centre");
    expect(slot.label).not.toBe("Nom IA non vérifié");
    expect(slot.url).toContain("restaurant%20convivial%20centre%20Cascais");
  });

  it("does not touch self-guided or lodging moments", async () => {
    const itinerary = {
      destination: "Cascais",
      usedCandidateIds: [],
      placePools: { "restaurant::catering.restaurant": [realRestaurant] },
      days: [
        {
          day: 1,
          slots: [
            {
              time: "18:30",
              type: "libre",
              label: "Jeu de la mariée",
              verified: false,
              activityMode: "self_guided_group",
              locationContext: "lodging",
            },
          ],
        },
      ],
    };

    const repaired = await repairPlanningVerifiedPlaces(itinerary, {
      selectCandidate: async () => realRestaurant,
    });

    expect(repaired.days[0].slots[0].label).toBe("Jeu de la mariée");
    expect(repaired.days[0].slots[0].verified).toBe(false);
  });
});
