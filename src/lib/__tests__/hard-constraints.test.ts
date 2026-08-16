import { describe, expect, it } from "vitest";
import {
  buildProposals,
  type DestinationRecord,
  type ScoringContext,
  type TravelCatalog,
} from "../krew/engine";

const destination = (overrides: Partial<DestinationRecord> = {}): DestinationRecord => ({
  id: "excellent",
  slug: "excellent",
  name: "Excellent",
  country: "France",
  description: null,
  image_url: null,
  avg_daily_cost: 1,
  distance_from_paris_km: 20,
  popularity: 1,
  rating: 5,
  best_months: [6],
  score_fete: 1,
  score_aventure: 1,
  score_detente: 1,
  score_luxe: 1,
  score_insolite: 1,
  score_sportif: 1,
  score_culturel: 1,
  ...overrides,
});

const catalog = (destinations: DestinationRecord[]): TravelCatalog => ({
  destinations,
  activities: [],
  accommodations: destinations.map((dest) => ({
    id: `acc-${dest.id}`,
    destination_id: dest.id,
    name: "Logement parfait",
    type: "villa",
    description: null,
    price_per_night_per_person: 1,
    capacity: 20,
    rating: 5,
    distance_center_km: 0,
    image_url: null,
  })),
});

const context = (overrides: Partial<ScoringContext> = {}): ScoringContext => ({
  participants: 4,
  budgetPerPerson: 1000,
  nights: 2,
  letKrewDecide: true,
  needsCityCenter: false,
  startMonth: 6,
  ambiances: ["fete"],
  activityCategories: [],
  maxDistanceKm: 5000,
  excludedCountries: [],
  individualPreferences: [],
  ...overrides,
});

describe("hard constraints remain blocking", () => {
  it("excludes an otherwise excellent proposal above an explicit budget veto", () => {
    const proposals = buildProposals(
      catalog([destination()]),
      context({ hasBudgetVeto: true, vetoBudgetMax: 10 }),
      4,
    );
    expect(proposals).toHaveLength(0);
  });

  it("never reintroduces a destination rejected by explicit plane refusal", () => {
    const far = destination({ distance_from_paris_km: 1200 });
    expect(buildProposals(catalog([far]), context({ planeRefused: true }), 4)).toHaveLength(0);
  });

  it("rejects even a nearby destination when flight is the only accepted mode and plane is refused", () => {
    const near = destination({ distance_from_paris_km: 200 });
    expect(
      buildProposals(
        catalog([near]),
        context({ planeRefused: true, transportModes: ["avion"] }),
        4,
      ),
    ).toHaveLength(0);
  });

  it("keeps compatible ground destinations when plane is refused", () => {
    const near = destination({ distance_from_paris_km: 200 });
    expect(
      buildProposals(catalog([near]), context({ planeRefused: true }), 4).every(
        (proposal) => proposal.destination.id === near.id,
      ),
    ).toBe(true);
  });

  it("returns zero when every destination exceeds the maximum travel duration", () => {
    const far = destination({ distance_from_paris_km: 1000 });
    expect(
      buildProposals(
        catalog([far]),
        context({ transportModes: ["voiture"], maxTravelDurationHours: 2 }),
        4,
      ),
    ).toHaveLength(0);
  });
});
