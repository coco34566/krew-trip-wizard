import { describe, expect, it } from "vitest";
import {
  evaluateParticipantTravelConstraint,
  hasDeclaredTravelConstraint,
} from "../krew/travel-constraints";

describe("per-participant destination travel constraints", () => {
  const star = {
    userId: "star",
    displayName: "Star",
    departureCity: "Lyon",
    transportModes: ["train", "voiture"],
    maxTravelHours: 4,
  };

  it("does not reject Test 12 when nobody declared a travel constraint", () => {
    const unconstrainedStar = {
      ...star,
      transportModes: ["peu importe"],
      maxTravelHours: null,
    };
    expect(hasDeclaredTravelConstraint(unconstrainedStar)).toBe(false);
    expect(
      evaluateParticipantTravelConstraint({
        participant: unconstrainedStar,
        distanceKm: 2096,
        candidateTransport: {
          plausibleModes: ["flight"],
          plausibility: "likely",
        },
      }),
    ).toBeNull();
  });

  it.each([
    ["Catane", 1230],
    ["Naples", 936],
    ["Athènes", 1780],
  ])("rejects %s for the Lyon Star when flight is refused and max is 4h", (_name, distanceKm) => {
    const rejection = evaluateParticipantTravelConstraint({
      participant: star,
      distanceKm,
      candidateTransport: {
        plausibleModes: ["flight"],
        plausibility: "likely",
      },
    });
    expect(rejection?.reason).toContain("inatteignable pour Star depuis Lyon");
    expect(rejection?.reason).toContain("avion refusé");
  });

  it("rejects an unlikely route for a participant who declared a constraint", () => {
    const rejection = evaluateParticipantTravelConstraint({
      participant: star,
      distanceKm: 500,
      candidateTransport: {
        plausibleModes: ["train"],
        plausibility: "unlikely",
      },
    });
    expect(rejection?.reason).toContain("trajet jugé peu plausible");
  });

  it("uses the participant max duration against accepted plausible modes", () => {
    const rejection = evaluateParticipantTravelConstraint({
      participant: {
        ...star,
        transportModes: ["train"],
      },
      distanceKm: 1000,
      candidateTransport: {
        plausibleModes: ["train", "flight"],
        plausibility: "likely",
      },
    });
    expect(rejection?.reason).toContain("plus de 4 h");
  });
});
