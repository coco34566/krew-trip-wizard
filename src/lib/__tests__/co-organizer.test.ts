import { describe, it, expect } from "vitest";
import { isTripAdmin } from "../krew/engine";

describe("Co-organisateur (engine.ts)", () => {
  it("autorise l'organisateur principal (isTripAdmin)", () => {
    const trip = {
      id: "trip-1",
      owner_id: "user-owner",
      co_organizer_id: null,
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "other-user")).toBe(false);
  });

  it("autorise le co-organisateur (isTripAdmin)", () => {
    const trip = {
      id: "trip-1",
      owner_id: "user-owner",
      co_organizer_id: "user-co-org",
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "user-co-org")).toBe(true);
    expect(isTripAdmin(trip, "other-user")).toBe(false);
  });

  it("gère les clés camelCase et snake_case", () => {
    const trip = {
      id: "trip-1",
      ownerId: "user-owner",
      coOrganizerId: "user-co-org",
    };
    expect(isTripAdmin(trip, "user-owner")).toBe(true);
    expect(isTripAdmin(trip, "user-co-org")).toBe(true);
  });
});
