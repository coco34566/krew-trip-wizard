import { describe, expect, it } from "vitest";
import { rankDateWindows } from "../krew/availability";
import {
  generateAccommodationConfigurations,
  buildProposals,
  type TravelCatalog,
  type ScoringContext,
  type DestinationRecord,
  type AccommodationRecord,
  type ActivityRecord,
} from "../krew/engine";

describe("E2E Coherence & Pipeline Integration Test", () => {
  it("executes end-to-end pipeline cleanly with multi-city departures, Star weighting, and mixed accommodations", () => {
    const starUserId = "user-star-123";
    const celebratedPerson = "Julie";

    const participants = [
      {
        userId: "user-organizer",
        departureCity: "Paris",
        transportModesAccepted: ["train", "plane"],
        maxTravelDurationHours: 4,
        acceptsSharedRoom: true,
        roomTypePreference: "partagee",
        travelPace: "equilibre",
        preferredTimeSlots: ["apres_midi", "soiree"],
        freeText: "J'adore la gastronomie locale",
      },
      {
        userId: starUserId,
        isStar: true,
        weight: 3.2,
        departureCity: "Lyon",
        transportModesAccepted: ["train"],
        maxTravelDurationHours: 3,
        acceptsSharedRoom: false, // Star wants solo room
        roomTypePreference: "individuelle",
        travelPace: "equilibre",
        preferredTimeSlots: ["matin", "soiree"],
        freeText: "Ambiance spa et visites culturelles",
      },
      {
        userId: "user-3",
        departureCity: "Marseille",
        transportModesAccepted: ["plane", "train"],
        maxTravelDurationHours: 5,
        acceptsSharedRoom: true,
        roomTypePreference: "partagee",
        travelPace: "equilibre",
        preferredTimeSlots: ["soiree"],
        freeText: "Fan de soleil et plages",
      },
    ];

    // 2. Dates / Duration: 3 days requested (= 2 nights)
    const requestedDays = 3;
    const requestedNights = requestedDays - 1; // 2 nights

    const participantAvailabilities = [
      { userId: "user-organizer", availableDates: ["2025-08-10", "2025-08-11", "2025-08-12", "2025-08-13"], blockedDates: [] },
      { userId: starUserId, availableDates: ["2025-08-11", "2025-08-12", "2025-08-13", "2025-08-14"], blockedDates: [] },
      { userId: "user-3", availableDates: ["2025-08-11", "2025-08-12", "2025-08-13"], blockedDates: [] },
    ];

    const rankedDates = rankDateWindows(
      participantAvailabilities.map((a) => ({
        userId: a.userId,
        availableDates: a.availableDates,
        blockedDates: a.blockedDates,
      })),
      requestedNights,
    );

    expect(rankedDates.length).toBeGreaterThan(0);
    const bestDateWindow = rankedDates[0]!;
    expect(bestDateWindow.start).toBe("2025-08-11");
    expect(bestDateWindow.end).toBe("2025-08-13");
    expect(bestDateWindow.nights).toBe(2);

    // 3. Accommodations: Mixed configuration
    const mockAccommodation: AccommodationRecord = {
      id: "acc-1",
      destination_id: "dest-1",
      name: "Grand Hôtel Spa",
      type: "hôtel",
      price_per_night: 200,
      price_per_night_per_person: 60,
      rating: 4.8,
      capacity: 10,
      bedrooms: 4,
      amenities: ["wifi", "pool", "spa"],
    };

    const mockDestination: DestinationRecord = {
      id: "dest-1",
      slug: "bruxelles",
      name: "Bruxelles",
      country: "Belgique",
      description: "Capitale culturelle et gourmande",
      image_url: "https://example.com/bruxelles.jpg",
      ambiances: ["festif", "culture"],
      avg_daily_cost: 80,
      distance_from_paris_km: 300,
      best_months: [8],
      rating: 4.5,
      popularity: 0.8,
      score_fete: 0.8,
      score_aventure: 0.5,
      score_detente: 0.7,
      score_luxe: 0.6,
      score_insolite: 0.5,
      score_sportif: 0.4,
      score_culturel: 0.9,
    };

    const lodgingConfigs = generateAccommodationConfigurations(
      [mockAccommodation],
      participants.length,
      requestedNights,
      mockDestination,
      null,
      [
        { userId: starUserId, roomTypePreference: "individuelle", acceptsSharedRoom: false },
        { userId: "user-organizer", roomTypePreference: "partagee", acceptsSharedRoom: true },
        { userId: "user-3", roomTypePreference: "partagee", acceptsSharedRoom: true },
      ],
    );

    expect(lodgingConfigs.length).toBeGreaterThan(0);
    const mixedConfig = lodgingConfigs.find((c) => c.isMixed || c.name.includes("individuelle"));
    expect(mixedConfig).toBeDefined();

    // 4. Catalog and Context setup
    const catalog: TravelCatalog = {
      destinations: [mockDestination],
      accommodations: [mockAccommodation],
      activities: [
        {
          id: "act-1",
          destination_id: "dest-1",
          name: "Visite guidée et Dégustation",
          category: "culture",
          price_per_person: 25,
          rating: 4.9,
        },
        {
          id: "act-2",
          destination_id: "dest-1",
          name: "Soirée Grand-Place & Bars",
          category: "bars_clubs",
          price_per_person: 20,
          rating: 4.7,
        },
      ] as ActivityRecord[],
    };

    const ctx: ScoringContext = {
      participants: 3,
      nights: requestedNights,
      travelPace: "equilibre",
      preferredTimeSlots: ["soiree", "matin"],
      ambiances: ["festif", "culture"],
      activityCategories: ["culture", "bars_clubs"],
      budgetPerPerson: 350,
      departureCity: "Paris",
      starWantedActivities: ["spa"],
      starWeight: 3.2,
      celebratedPerson,
      individualPreferences: participants as any,
      excludedCountries: [],
      dealBreakerDestinations: [],
      dealBreakerAmbiances: [],
      startMonth: 8,
      maxDistanceKm: 2000,
    };

    const proposals = buildProposals(catalog, ctx);
    expect(proposals.length).toBeGreaterThan(0);
    const topProposal = proposals[0]!;

    expect(topProposal.destination.name).toBe("Bruxelles");
    expect(Number.isNaN(topProposal.score)).toBe(false);
    expect(topProposal.score).toBeGreaterThan(0);
    expect(topProposal.itinerary).toBeDefined();
    expect(topProposal.budget.totalPerPerson).toBeGreaterThan(0);
  });

  it("handles multi-city transport compatibility without hard vetoing the entire group when one participant has restrictive limits", () => {
    const mockDestination: DestinationRecord = {
      id: "dest-2",
      slug: "lisbonne",
      name: "Lisbonne",
      country: "Portugal",
      description: "Ville côtière ensoleillée",
      image_url: null,
      ambiances: ["festif", "farniente"],
      avg_daily_cost: 70,
      distance_from_paris_km: 1450,
      best_months: [8],
      rating: 4.7,
      popularity: 0.9,
      score_fete: 0.9,
      score_aventure: 0.6,
      score_detente: 0.8,
      score_luxe: 0.5,
      score_insolite: 0.6,
      score_sportif: 0.5,
      score_culturel: 0.8,
    };

    const mockAccommodation: AccommodationRecord = {
      id: "acc-2",
      destination_id: "dest-2",
      name: "Lisbon Sun Hostel",
      type: "hôtel",
      price_per_night: 150,
      price_per_night_per_person: 40,
      rating: 4.6,
      capacity: 8,
      bedrooms: 3,
      amenities: ["wifi"],
    };

    const catalog: TravelCatalog = {
      destinations: [mockDestination],
      accommodations: [mockAccommodation],
      activities: [],
    };

    // Participant A from Paris accepts flight (Paris->Lisbon flight ~ 2.5h -> highly compatible)
    // Participant B from Lyon accepts train only with max 3h (Lyon->Lisbon train ~ 15h -> incompatible for B)
    const ctx: ScoringContext = {
      participants: 2,
      nights: 2,
      travelPace: "equilibre",
      ambiances: ["festif"],
      activityCategories: ["soirees"],
      budgetPerPerson: 400,
      departureCity: "Paris",
      individualPreferences: [
        {
          userId: "user-paris",
          departureCity: "Paris",
          transportModes: ["flight"],
          maxTravelHours: 4,
          budgetPriority: "nice_to_have",
        },
        {
          userId: "user-lyon-restrictive",
          departureCity: "Lyon",
          transportModes: ["train"],
          maxTravelHours: 3,
          budgetPriority: "nice_to_have",
        },
      ] as any,
      excludedCountries: [],
      dealBreakerDestinations: [],
      dealBreakerAmbiances: [],
      startMonth: 8,
      maxDistanceKm: 2500,
    };

    const proposals = buildProposals(catalog, ctx);
    expect(proposals.length).toBeGreaterThan(0);
    const proposal = proposals[0]!;

    // Individual transport mismatch for participant B reduces satisfaction score without eliminating Lisbonne for the group
    expect(proposal.destination.name).toBe("Lisbonne");
    expect(proposal.score).toBeGreaterThan(0);
    expect(Number.isNaN(proposal.score)).toBe(false);
  });
});
