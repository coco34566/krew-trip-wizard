import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/_authenticated/trips.new.tsx", "utf8");
const constants = readFileSync("src/lib/krew/constants.ts", "utf8");
const schema = readFileSync("src/lib/krew/trip-service-legacy.ts", "utf8");

describe("new trip creation hardening", () => {
  it("guards against double submission synchronously", () => {
    expect(route).toContain("if (submitGuardRef.current) return");
    expect(route).toContain("submitGuardRef.current = true");
  });

  it("clamps duration to 2-31 days and schema to 1-30 nights", () => {
    expect(route).toContain("Math.min(31, Math.max(2, n))");
    expect(schema).toContain("durationNights: z.number().int().min(1).max(30)");
  });

  it("keeps participant bounds in the creation schema", () => {
    expect(schema).toContain("participants: z.number().int().min(2).max(25)");
  });

  it("moves hidden defaults to named constants", () => {
    expect(constants).toContain("DEFAULT_TRIP_BUDGET_PER_PERSON = 400");
    expect(constants).toContain("DEFAULT_TRIP_MAX_DISTANCE_KM = 2000");
    expect(constants).toContain("DEFAULT_TRIP_NEEDS_CITY_CENTER = true");
    expect(constants).toContain("DEFAULT_TRIP_LET_KREW_DECIDE = true");
    expect(route).toContain("budgetPerPerson: DEFAULT_TRIP_BUDGET_PER_PERSON");
  });

  it("renders inline validation and accessible age group", () => {
    expect(route).toContain('role="alert"');
    expect(route).toContain('role="group"');
    expect(route).toContain('aria-labelledby="group-age-label"');
  });

  it("prefills organizer name without overwriting edits", () => {
    expect(route).toContain("organizerDirtyRef.current");
    expect(route).toContain('select("full_name")');
    expect(route).toContain('provider && provider !== "email"');
  });
});
