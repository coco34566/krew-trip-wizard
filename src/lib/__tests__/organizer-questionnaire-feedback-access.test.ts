import { describe, expect, it } from "vitest";
import { isOrganizerFeedbackAdmin } from "../organizer-questionnaire-feedback.functions";

describe("organizer questionnaire feedback access", () => {
  const trip = {
    owner_id: "owner-1",
    co_organizer_id: "coorg-1",
  };

  it("allows the organizer", () => {
    expect(isOrganizerFeedbackAdmin(trip, "owner-1")).toBe(true);
  });

  it("allows the co-organizer", () => {
    expect(isOrganizerFeedbackAdmin(trip, "coorg-1")).toBe(true);
  });

  it("denies a regular participant", () => {
    expect(isOrganizerFeedbackAdmin(trip, "member-1")).toBe(false);
  });
});
