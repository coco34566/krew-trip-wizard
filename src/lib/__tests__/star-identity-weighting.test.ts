import { describe, expect, it } from "vitest";
import { aggregateParticipantPreferences } from "../krew/trip-service";
import {
  buildProposals,
  type DestinationRecord,
  type ScoringContext,
  type TravelCatalog,
} from "../krew/engine";

const participantRow = (userId: string, ambiances: string[] = []) => ({
  user_id: userId,
  ambiances,
  activity_categories: [],
  budget_max: 600,
  budget_priority: "nice_to_have",
  date_flex_days: 0,
  required_amenities: [],
  min_accommodation_rating: null,
  travel_pace: "equilibre",
  duration_nights_min: 1,
  duration_nights_max: 4,
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
  transport_mode_accepted: ["train"],
  max_travel_duration_hours: 8,
  blackout_dates: [],
  group_age_range: "25-35",
  wanted_env_type: null,
  weather_preference: 1,
  free_text: null,
  local_mobility: null,
  accommodation_role: null,
});

function supabaseFor(rows: any[], trip: any, star: any) {
  return {
    from(table: string) {
      const data =
        table === "trip_participant_preferences"
          ? rows
          : table === "trips"
            ? trip
            : table === "trip_star_preferences"
              ? star
              : [];
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data, error: null }),
        single: async () => ({ data, error: null }),
        then: (resolve: (value: any) => void) => resolve({ data, error: null }),
      };
      return chain;
    },
  };
}

const trip = (overrides: Record<string, unknown> = {}) => ({
  event_type: "evg",
  celebrated_person: "Léa",
  has_star: true,
  star_user_id: "star-user",
  owner_id: "owner-user",
  co_organizer_id: null,
  ...overrides,
});
const starPrefs = (overrides: Record<string, unknown> = {}) => ({
  user_id: "owner-user",
  ambiances: ["detente"],
  wanted_activities: ["spa"],
  deal_breakers: [],
  desired_destination: "calme",
  wanted_env_type: "Nature / pleine nature",
  ...overrides,
});

const destination = (id: string, fete: number, detente: number): DestinationRecord => ({
  id,
  slug: id,
  name: id,
  country: "France",
  description: null,
  image_url: null,
  avg_daily_cost: 70,
  distance_from_paris_km: 100,
  popularity: 0.8,
  rating: 4.5,
  best_months: [6],
  score_fete: fete,
  score_aventure: 0.5,
  score_detente: detente,
  score_luxe: 0.5,
  score_insolite: 0.5,
  score_sportif: 0.5,
  score_culturel: 0.5,
});

async function aggregate(rows: any[], tripData: any, starData: any) {
  return aggregateParticipantPreferences(supabaseFor(rows, tripData, starData) as any, "trip-id");
}

describe("single-source Star identity and weighting", () => {
  it("recognizes and weights a Star with an account", async () => {
    const result = await aggregate(
      [participantRow("owner-user", ["fete"]), participantRow("star-user")],
      trip(),
      starPrefs(),
    );
    const stars = result.individualPreferences.filter((pref: any) => pref.isStar);
    expect(stars).toHaveLength(1);
    expect(stars[0]).toMatchObject({ weight: 3.2, activityCategories: ["spa"] });
    expect(result.participantsCount).toBe(2);
  });

  it("explicitly recognizes and weights a virtual/secret Star", async () => {
    const result = await aggregate(
      [participantRow("owner-user", ["fete"])],
      trip({ star_user_id: null }),
      starPrefs(),
    );
    expect(result.individualPreferences).toHaveLength(2);
    expect(result.individualPreferences.find((pref: any) => pref.isStar)).toMatchObject({
      weight: 3.2,
      wantedEnvType: "Nature / pleine nature",
    });
    expect(result.individualPreferences.find((pref: any) => pref.isStar)?.isStar).toBe(true);
  });

  it("lets the virtual Star materially influence the nine-profile aggregation", async () => {
    const weighted = await aggregate(
      [participantRow("owner-user", ["fete"])],
      trip({ star_user_id: null }),
      starPrefs(),
    );
    expect(weighted.stayProfileAffinities!).toHaveLength(9);
    expect(
      weighted.stayProfileAffinities!.find((profile: any) => profile.id === "nature_disconnect")!
        .score,
    ).toBeGreaterThan(
      weighted.stayProfileAffinities!.find((profile: any) => profile.id === "city_lively")!.score,
    );
  });

  it("propagates virtual Star weight into final individual satisfaction", async () => {
    const aggregated = await aggregate(
      [participantRow("owner-user", ["fete"])],
      trip({ star_user_id: null }),
      starPrefs(),
    );
    const destinations = [destination("calme", 0.1, 1)];
    const catalog: TravelCatalog = { destinations, activities: [], accommodations: [] };
    const base: ScoringContext = {
      participants: 2,
      budgetPerPerson: 800,
      nights: 2,
      letKrewDecide: true,
      needsCityCenter: false,
      startMonth: 6,
      ambiances: [],
      activityCategories: [],
      maxDistanceKm: 1000,
      excludedCountries: [],
      individualPreferences: aggregated.individualPreferences as any,
    };
    const weighted = buildProposals(catalog, base, 1)[0]!;
    const unweighted = buildProposals(
      catalog,
      {
        ...base,
        individualPreferences: aggregated.individualPreferences.map((pref: any) => ({
          ...pref,
          isStar: false,
          weight: 1,
        })),
      },
      1,
    )[0]!;
    expect(weighted.consensusScore).toBeGreaterThan(unweighted.consensusScore);
  });

  it("merges participant and Star-specific preferences without double counting", async () => {
    const result = await aggregate(
      [participantRow("owner-user"), participantRow("star-user", ["fete"])],
      trip(),
      starPrefs({ user_id: "star-user", ambiances: ["detente"] }),
    );
    expect(result.individualPreferences).toHaveLength(2);
    const star = result.individualPreferences.find((pref: any) => pref.isStar)!;
    expect(star.ambiances).toEqual(expect.arrayContaining(["fete", "detente"]));
  });

  it("does not confuse an organizer with a different Star", async () => {
    const result = await aggregate(
      [participantRow("owner-user"), participantRow("star-user")],
      trip(),
      starPrefs(),
    );
    expect(result.individualPreferences.find((pref: any) => pref.isStar)?.weight).toBe(3.2);
    expect(result.individualPreferences.find((pref: any) => !pref.isStar)?.weight).toBe(1);
  });

  it("recognizes the organizer when explicitly declared as Star", async () => {
    const result = await aggregate(
      [participantRow("owner-user")],
      trip({ star_user_id: "owner-user" }),
      starPrefs(),
    );
    expect(result.individualPreferences).toHaveLength(1);
    expect(result.individualPreferences[0]).toMatchObject({ isStar: true, weight: 3.2 });
  });

  it("keeps an explicit Star deal-breaker blocking", async () => {
    const result = await aggregate(
      [participantRow("owner-user")],
      trip({ star_user_id: null }),
      starPrefs({ deal_breakers: ["fete"] }),
    );
    const catalog: TravelCatalog = {
      destinations: [destination("party", 1, 0.1)],
      activities: [],
      accommodations: [],
    };
    const ctx: ScoringContext = {
      participants: 2,
      budgetPerPerson: 800,
      nights: 2,
      letKrewDecide: true,
      needsCityCenter: false,
      startMonth: 6,
      ambiances: [],
      activityCategories: [],
      maxDistanceKm: 1000,
      excludedCountries: [],
      dealBreakerAmbiances: result.dealBreakerAmbiances,
      individualPreferences: result.individualPreferences as any,
    };
    expect(buildProposals(catalog, ctx, 1)).toHaveLength(0);
  });

  it("does not mark anyone as Star on a trip without a Star", async () => {
    const result = await aggregate(
      [participantRow("owner-user")],
      trip({ event_type: "weekend", celebrated_person: null, has_star: false, star_user_id: null }),
      null,
    );
    expect(result.individualPreferences).toHaveLength(1);
    expect(result.individualPreferences[0]).toMatchObject({ isStar: false, weight: 1 });
  });
});
