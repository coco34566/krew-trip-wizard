import { describe, expect, it } from "vitest";
import { buildProposals, type DestinationRecord, type ScoringContext } from "../krew/engine";
import { resolveRecommendationDates } from "../krew/trip-service";

const destination: DestinationRecord = {
  id: "perche",
  slug: "perche",
  name: "Perche",
  country: "France",
  description: null,
  image_url: null,
  avg_daily_cost: 80,
  distance_from_paris_km: 160,
  popularity: 0.6,
  rating: 4,
  best_months: [5, 6, 7],
  score_fete: 0.4,
  score_aventure: 0.6,
  score_detente: 0.9,
  score_luxe: 0.6,
  score_insolite: 0.7,
  score_sportif: 0.5,
  score_culturel: 0.6,
};

const context: ScoringContext = {
  participants: 10,
  budgetPerPerson: 800,
  nights: 2,
  letKrewDecide: true,
  needsCityCenter: false,
  startMonth: 6,
  ambiances: [],
  activityCategories: [],
  maxDistanceKm: 1000,
  excludedCountries: [],
};

describe("discovery data reliability boundary", () => {
  it("does not manufacture real dates for an undated trip", () => {
    expect(resolveRecommendationDates({ start_date: null, end_date: null })).toEqual({
      startDate: null,
      endDate: null,
      verifiedForDates: false,
    });
  });

  it("recognizes only a complete real date range as date-verified", () => {
    expect(
      resolveRecommendationDates({ start_date: "2026-10-02", end_date: "2026-10-04" }),
    ).toEqual({
      startDate: "2026-10-02",
      endDate: "2026-10-04",
      verifiedForDates: true,
    });
  });

  it("keeps season and weather neutral when dates are unknown", () => {
    const proposal = buildProposals(
      { destinations: [destination], activities: [], accommodations: [] },
      { ...context, datesVerified: false },
      1,
    )[0]!;
    expect(proposal.subScores.sSeason).toBe(1);
    expect(proposal.subScores.sWeather).toBe(1);
  });

  it("does not let an estimated lodging prove a budget veto", () => {
    expect(
      buildProposals(
        { destinations: [destination], activities: [], accommodations: [] },
        { ...context, hasBudgetVeto: true, vetoBudgetMax: 800 },
        3,
      ),
    ).toHaveLength(0);
  });

  it("never presents an unverified web property as the selected accommodation", () => {
    const proposals = buildProposals(
      {
        destinations: [destination],
        activities: [],
        accommodations: [
          {
            id: "web-property",
            destination_id: destination.id,
            name: "Domaine découvert sur le web",
            type: "property_web",
            description: null,
            price_per_night_per_person: 10,
            capacity: 12,
            rating: 5,
            distance_center_km: 0,
            image_url: null,
            source: "property_web:example.org",
            price_verified: false,
            availability_verified: false,
            verification_state: "inferred",
          },
        ],
      },
      context,
      3,
    );
    expect(proposals[0]?.accommodation).toBeNull();
    expect(proposals[0]?.budget.priceSource?.accommodation).toBe("unknown");
  });

  it("preserves web provenance for a confirmed web property", () => {
    const proposals = buildProposals(
      {
        destinations: [destination],
        activities: [],
        accommodations: [
          {
            id: "verified-web-property",
            destination_id: destination.id,
            name: "Domaine vérifié",
            type: "property_web",
            description: null,
            price_per_night_per_person: 90,
            capacity: 12,
            rating: 4.6,
            distance_center_km: 0,
            image_url: null,
            source: "property_web:example.org",
            price_verified: true,
            availability_verified: true,
            verification_state: "confirmed",
          },
        ],
      },
      context,
      3,
    );
    expect(proposals[0]?.accommodation?.id).toBe("verified-web-property");
    expect(proposals[0]?.budget.priceSource?.accommodation).toBe("web");
  });
});
