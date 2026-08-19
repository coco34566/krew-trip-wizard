import { describe, expect, it } from "vitest";
import {
  aggregateParticipantPreferences,
  assessGenerationReadiness,
} from "../trip-service";

describe("Trip Profile & Test 13 Regression", () => {
  it("computes stayConcepts and readiness with 5 expected participants, organizer answers, secret star preferences, and empty initial DB concepts", async () => {
    const mockTrip = {
      id: "trip-test-13",
      participants_count: 5,
      event_type: "evjf",
      celebrated_person: "Titi",
      has_star: true,
      star_user_id: null,
      owner_id: "owner-uid-1",
      co_organizer_id: null,
      dates_locked: false,
      start_date: null,
      end_date: null,
      provisional_start_date: null,
      provisional_end_date: null,
      stay_concepts_calculated: [],
      stay_concepts_selected: [],
      stay_profile_validated_at: null,
      budget_per_person: 400,
    };

    const mockParticipants = [
      { id: "part-1", user_id: "owner-uid-1", email: "orga@krew.fr", display_name: "Organisatrice", status: "accepte" },
    ];

    const mockParticipantPrefs = [
      {
        user_id: "owner-uid-1",
        ambiances: ["fete", "detente"],
        activity_categories: ["spa", "soiree"],
        budget_max: 350,
        budget_priority: "nice_to_have",
        date_flex_days: 0,
        required_amenities: [],
        min_accommodation_rating: 4,
        travel_pace: "equilibre",
        duration_nights_min: 2,
        duration_nights_max: 2,
        desired_destination: null,
        departure_city: "Paris",
        excluded_destinations: [],
        deal_breaker_ambiances: [],
        accepts_shared_room: true,
        room_type_preference: "peu_importe",
        preferred_time_slots: [],
        dietary_constraints: [],
        mobility_notes: null,
        accessibility_needs: false,
        departure_airport_or_station: null,
        transport_mode_accepted: ["train", "avion"],
        max_travel_duration_hours: 4,
        blackout_dates: [],
        wanted_env_type: "Bord de mer",
        weather_preference: 2,
        local_mobility: "walk_transit",
        accommodation_role: "part_of_stay",
      },
    ];

    const mockStarPrefs = {
      trip_id: "trip-test-13",
      user_id: "owner-uid-1", // filled_by owner
      ambiances: ["fete", "luxe"],
      wanted_activities: ["spa", "plage", "soiree"],
      excluded_destinations: ["Ibiza"],
      deal_breakers: ["camping"],
      desired_destination: "Lisbonne",
      wanted_env_type: "Bord de mer",
      departure_city: "Paris",
      local_mobility: "walk_transit",
      accommodation_role: "centerpiece",
      submitted_at: new Date().toISOString(),
    };

    const mockSupabase: any = {
      from: (table: string) => {
        return {
          select: (cols?: string) => {
            const chain = {
              eq: (col: string, val: any) => {
                const subChain = {
                  eq: (col2: string, val2: any) => {
                    if (table === "recommendations") return Promise.resolve({ data: [], error: null });
                    return subChain;
                  },
                  single: () => {
                    if (table === "trips") return Promise.resolve({ data: mockTrip, error: null });
                    return Promise.resolve({ data: null, error: null });
                  },
                  maybeSingle: () => {
                    if (table === "trips") return Promise.resolve({ data: mockTrip, error: null });
                    if (table === "trip_star_preferences") return Promise.resolve({ data: mockStarPrefs, error: null });
                    return Promise.resolve({ data: null, error: null });
                  },
                  then: (resolve: any) => {
                    if (table === "trip_participant_preferences") return resolve({ data: mockParticipantPrefs, error: null });
                    if (table === "trip_participants") return resolve({ data: mockParticipants, error: null });
                    if (table === "trip_availability") return resolve({ data: [], error: null });
                    if (table === "recommendations") return resolve({ data: [], error: null });
                    return resolve({ data: [], error: null });
                  },
                };
                return subChain;
              },
              then: (resolve: any) => resolve({ data: [], error: null }),
            };
            return chain;
          },
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      },
    };

    const aggregated = await aggregateParticipantPreferences(mockSupabase, "trip-test-13");

    // 1. Secret star counted exactly once
    const starPreferences = aggregated.individualPreferences.filter((p: any) => p.isStar);
    expect(starPreferences.length).toBe(1);
    expect(starPreferences[0].isStar).toBe(true);

    // 2. Star weight applied (EVJF = 3.2)
    expect(starPreferences[0].weight).toBe(3.2);

    // 3. stayConcepts produced > 0
    expect(aggregated.stayConcepts.length).toBeGreaterThan(0);

    // 4. assessGenerationReadiness produces calculatedConcepts even with empty DB persisted concepts
    const readiness = await assessGenerationReadiness(mockSupabase, "trip-test-13");
    expect(readiness.profile.questionnairesReady).toBe(true);
    expect(readiness.profile.calculatedConcepts.length).toBeGreaterThan(0);
  });
});
