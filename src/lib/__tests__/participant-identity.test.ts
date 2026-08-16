import { describe, it, expect } from "vitest";
import { getParticipantsProgressHelper } from "../participant-preferences.functions";
import { aggregateParticipantPreferences, assessGenerationReadiness } from "../krew/trip-service";
import { getTripAvailabilityHelper } from "../availability.functions";

describe("Participant Identity & Star Resolution Tests", () => {
  it("differentiates two participants with the same first name ('Julie') and correctly identifies Star via star_user_id", async () => {
    const tripId = "trip-same-firstname";
    const starUserId = "user-julie-a";

    const tripsData = {
      id: tripId,
      participants_count: 4,
      celebrated_person: "Julie",
      has_star: true,
      star_user_id: starUserId,
      owner_id: "user-owner",
      co_organizer_id: null,
      group_logistics: { star_mode: "secret" },
    };

    const participantsData = [
      {
        id: "p-owner",
        user_id: "user-owner",
        email: "owner@example.com",
        display_name: "Alex",
        status: "accepte",
      },
      {
        id: "p-julie-a",
        user_id: "user-julie-a",
        email: "julie.a@example.com",
        display_name: "Julie",
        status: "accepte",
      },
      {
        id: "p-julie-b",
        user_id: "user-julie-b",
        email: "julie.b@example.com",
        display_name: "Julie",
        status: "accepte",
      },
    ];

    const prefsData = [
      { user_id: "user-owner", submitted_at: "2026-08-01" },
      { user_id: "user-julie-b", submitted_at: "2026-08-02" },
    ];

    const availData = [{ user_id: "user-julie-b" }];

    const starPrefsData = {
      user_id: starUserId,
      wanted_activities: ["spa", "brunch"],
      submitted_at: "2026-08-03",
    };

    const mockSupabase = {
      from: (table: string) => {
        let data: any = [];
        if (table === "trips") data = tripsData;
        else if (table === "trip_participants") data = participantsData;
        else if (table === "trip_participant_preferences") data = prefsData;
        else if (table === "trip_availability") data = availData;
        else if (table === "trip_star_preferences") data = starPrefsData;

        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data, error: null }),
          maybeSingle: async () => ({ data, error: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return chain as any;
      },
    };

    const progress = await getParticipantsProgressHelper(mockSupabase as any, tripId);

    const julieA = progress.participants.find((p) => p.user_id === "user-julie-a");
    const julieB = progress.participants.find((p) => p.user_id === "user-julie-b");

    expect(julieA).toBeDefined();
    expect(julieB).toBeDefined();

    // Star is strictly Julie A (user-julie-a) because trips.star_user_id === "user-julie-a"
    expect(julieA?.isStar).toBe(true);
    expect(julieB?.isStar).toBe(false);

    // Julie B answered her own prefs, Julie A's prefs come from starPrefs
    expect(julieB?.hasAnswered).toBe(true);
    expect(julieA?.hasAnswered).toBe(true);
  });

  it("differentiates two participants with the same first and last name ('Julie Martin')", async () => {
    const tripId = "trip-same-fullname";
    const starUserId = "user-julie-martin-1";

    const tripsData = {
      id: tripId,
      participants_count: 5,
      celebrated_person: "Julie Martin",
      has_star: true,
      star_user_id: starUserId,
      owner_id: "user-owner",
      co_organizer_id: null,
      group_logistics: { star_mode: "secret" },
    };

    const participantsData = [
      {
        id: "p1",
        user_id: "user-owner",
        email: "orga@example.com",
        display_name: "Paul",
        status: "accepte",
      },
      {
        id: "p2",
        user_id: "user-julie-martin-1",
        email: "julie.m1@example.com",
        display_name: "Julie Martin",
        status: "accepte",
      },
      {
        id: "p3",
        user_id: "user-julie-martin-2",
        email: "julie.m2@example.com",
        display_name: "Julie Martin",
        status: "accepte",
      },
    ];

    const prefsData = [{ user_id: "user-julie-martin-2", ambiances: ["fete"], budget_max: 300 }];

    const starPrefsData = {
      user_id: starUserId,
      wanted_activities: ["escape_game"],
      submitted_at: "2026-08-01",
    };

    const mockSupabase = {
      from: (table: string) => {
        let data: any = [];
        if (table === "trips") data = tripsData;
        else if (table === "trip_participants") data = participantsData;
        else if (table === "trip_participant_preferences") data = prefsData;
        else if (table === "trip_availability") data = [];
        else if (table === "trip_star_preferences") data = starPrefsData;

        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data, error: null }),
          maybeSingle: async () => ({ data, error: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return chain as any;
      },
    };

    const progress = await getParticipantsProgressHelper(mockSupabase as any, tripId);

    const pStar = progress.participants.find((p) => p.user_id === "user-julie-martin-1");
    const pNonStar = progress.participants.find((p) => p.user_id === "user-julie-martin-2");

    expect(pStar).toBeDefined();
    expect(pNonStar).toBeDefined();

    expect(pStar?.isStar).toBe(true);
    expect(pNonStar?.isStar).toBe(false);
  });

  it("verifies that a participant matching celebrated_person name is NOT misidentified as Star when star_user_id points to another participant", async () => {
    const tripId = "trip-name-collision";
    const actualStarUserId = "user-real-star";

    const tripsData = {
      id: tripId,
      participants_count: 3,
      stay_profile_validated_at: "2026-08-01T00:00:00Z",
      celebrated_person: "Julie",
      has_star: true,
      star_user_id: actualStarUserId,
      owner_id: "user-owner",
      event_type: "evg",
    };

    // User "user-impostor" has display_name "Julie", but actual star_user_id is "user-real-star" (display_name "Sarah")
    const participantsData = [
      {
        id: "p-owner",
        user_id: "user-owner",
        email: "owner@example.com",
        display_name: "Marc",
        status: "accepte",
      },
      {
        id: "p-impostor",
        user_id: "user-impostor",
        email: "julie@example.com",
        display_name: "Julie",
        status: "accepte",
      },
      {
        id: "p-real-star",
        user_id: "user-real-star",
        email: "sarah@example.com",
        display_name: "Sarah",
        status: "accepte",
      },
    ];

    const prefsData = [
      { user_id: "user-owner", ambiances: ["detente"] },
      { user_id: "user-impostor", ambiances: ["culturel"] },
      { user_id: "user-real-star", ambiances: ["fete"] },
    ];

    const starPrefsData = {
      user_id: actualStarUserId,
      wanted_activities: ["moth_nightclub"],
      submitted_at: "2026-08-01",
    };

    const mockSupabase = {
      from: (table: string) => {
        let data: any = [];
        if (table === "trips") data = tripsData;
        else if (table === "trip_participants") data = participantsData;
        else if (table === "trip_participant_preferences") data = prefsData;
        else if (table === "trip_availability") data = [];
        else if (table === "trip_star_preferences") data = starPrefsData;

        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data, error: null }),
          maybeSingle: async () => ({ data, error: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return chain as any;
      },
    };

    // 1. Check getParticipantsProgressHelper
    const progress = await getParticipantsProgressHelper(mockSupabase as any, tripId);
    const impostorProgress = progress.participants.find((p) => p.user_id === "user-impostor");
    const realStarProgress = progress.participants.find((p) => p.user_id === "user-real-star");

    expect(impostorProgress?.isStar).toBe(false);
    expect(realStarProgress?.isStar).toBe(true);

    // 2. Check aggregateParticipantPreferences
    const aggregated = await aggregateParticipantPreferences(mockSupabase as any, tripId);
    const impostorPref = aggregated.individualPreferences.find(
      (p) => p.isStar && p.wantedEnvType !== undefined,
    );
    const realStarPref = aggregated.individualPreferences.find((p) => p.isStar);

    // Only one individual preference is flagged as Star, and it corresponds to user-real-star
    const starPrefsInGroup = aggregated.individualPreferences.filter((p) => p.isStar);
    expect(starPrefsInGroup.length).toBe(1);
    expect(starPrefsInGroup[0]?.weight).toBeGreaterThan(2);

    // 3. Check assessGenerationReadiness
    const readiness = await assessGenerationReadiness(mockSupabase as any, tripId);
    expect(readiness.canGenerate).toBe(true);
  });

  it("CAS 3 & 4: Star configured with name 'Camille' displayed as 'Camille' (never 'Participant') and normal participant display name preserved in getTripAvailability", async () => {
    const tripId = "trip-star-camille";
    const starUserId = "user-star-camille";

    const tripsData = {
      id: tripId,
      name: "EVJF de Camille",
      event_type: "evjf",
      celebrated_person: "Camille",
      has_star: true,
      star_user_id: starUserId,
      owner_id: "user-organizer",
      duration_nights: 1,
      participants_count: 3,
    };

    const participantsData = [
      {
        id: "p-orga",
        user_id: "user-organizer",
        email: "orga@example.com",
        display_name: "Juliet",
        status: "accepte",
      },
      {
        id: "p-camille",
        user_id: starUserId,
        email: "camille@example.com",
        display_name: null,
        status: "accepte",
      },
      {
        id: "p-participant",
        user_id: "user-normal",
        email: "sarah@example.com",
        display_name: "Sarah",
        status: "accepte",
      },
    ];

    const availData = [
      {
        user_id: "user-organizer",
        available_dates: ["2026-08-01", "2026-08-02"],
        flex_days: 0,
        duration_nights: 1,
      },
      {
        user_id: starUserId,
        available_dates: ["2026-08-01", "2026-08-02"],
        flex_days: 0,
        duration_nights: 1,
      },
      {
        user_id: "user-normal",
        available_dates: ["2026-08-01", "2026-08-02"],
        flex_days: 0,
        duration_nights: 1,
      },
    ];

    const mockSupabase = {
      from: (table: string) => {
        let data: any = [];
        if (table === "trips") data = tripsData;
        else if (table === "trip_participants") data = participantsData;
        else if (table === "trip_availability") data = availData;
        else if (table === "trip_preferences") data = { duration_nights: 1 };
        else if (table === "trip_star_preferences") data = null;

        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({ data, error: null }),
          maybeSingle: async () => ({ data, error: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return chain as any;
      },
    };

    const result = await getTripAvailabilityHelper(mockSupabase as any, "user-organizer", tripId);

    expect(result.windows.length).toBeGreaterThan(0);
    const topWindow = result.windows[0]!;

    const availableNames = topWindow.availablePeople.map((p) => p.name);
    // Star must be "Camille" and NOT "Participant" or null
    expect(availableNames).toContain("Camille");
    expect(availableNames).not.toContain("Participant");

    // Normal participant "Sarah" and organizer "Juliet" must preserve their names
    expect(availableNames).toContain("Juliet");
    expect(availableNames).toContain("Sarah");
  });
});
