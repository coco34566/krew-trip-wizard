import { describe, expect, it } from "vitest";
import { rankDateWindows } from "../krew/availability";
import { generateAccommodationConfigurations, buildProposals } from "../krew/engine";

describe("E2E Coherence & Pipeline Integration Test", () => {
  it("executes the end-to-end pipeline with full coherence across all 6 areas", () => {
    // 1. Participant Questionnaire & Star setup
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
        departureCity: "Lyon",
        transportModesAccepted: ["train"],
        maxTravelDurationHours: 3,
        acceptsSharedRoom: false, // Star wants solo room!
        roomTypePreference: "individuelle",
        travelPace: "equilibre",
        preferredTimeSlots: ["matin", "soiree"],
        freeText: "Ambiance spa et visites culturelles",
      },
      {
        userId: "user-3",
        departureCity: "Paris",
        transportModesAccepted: ["train"],
        maxTravelDurationHours: 4,
        acceptsSharedRoom: true,
        roomTypePreference: "partagee",
        travelPace: "equilibre",
        preferredTimeSlots: ["soiree"],
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
    const bestDateWindow = rankedDates[0];
    expect(bestDateWindow.start).toBe("2025-08-11");
    expect(bestDateWindow.end).toBe("2025-08-13");
    expect(bestDateWindow.nights).toBe(2);

    // 3. Accommodations: Mixed configuration (1 solo for Star + 1 shared room for 2 participants)
    const mockAccommodation = {
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

    const mockDestination = {
      id: "dest-1",
      slug: "bruxelles",
      name: "Bruxelles",
      country: "Belgique",
      description: "Capitale culturelle et gourmande",
      image_url: "https://example.com/bruxelles.jpg",
      ambiances: ["festif", "culture"],
      daily_cost_avg: 80,
      avg_daily_cost: 80,
      dist_paris_km: 300,
      distance_from_paris_km: 300,
      best_months: [8],
      has_airport: true,
      has_train_station: true,
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
      [mockAccommodation as any],
      participants.length,
      requestedNights,
      mockDestination as any,
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

    // 4. Scoring & Recommendations
    const catalog = {
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
      ],
    };

    const ctx = {
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
      individualPreferences: participants,
      excludedCountries: [],
      dealBreakerDestinations: [],
      dealBreakerAmbiances: [],
      startMonth: 8,
      maxDistanceKm: 2000,
    };

    const proposals = buildProposals(catalog as any, ctx as any);
    expect(proposals.length).toBeGreaterThan(0);
    const topProposal = proposals[0];

    expect(topProposal.destination.name).toBe("Bruxelles");
    expect(topProposal.score).toBeGreaterThan(0);
    expect(topProposal.itinerary).toBeDefined();
    expect(topProposal.budget.totalPerPerson).toBeGreaterThan(0);
  });
});
