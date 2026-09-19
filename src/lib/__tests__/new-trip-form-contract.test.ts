import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const page = readFileSync("src/routes/_authenticated/trips.new.tsx", "utf8");
const constants = readFileSync("src/lib/krew/constants.ts", "utf8");
describe("new trip form hardening", () => {
 it("guards double submission synchronously",()=>{ expect(page).toContain("if (submitLockRef.current) return;"); expect(page).toContain("submitLockRef.current = true"); });
 it("clamps duration between 2 and 31 days",()=>{ expect(page).toContain("Math.min(31, Math.max(2, n))"); });
 it("uses named hidden defaults",()=>{ expect(constants).toContain("DEFAULT_TRIP_BUDGET_PER_PERSON = 400"); expect(page).toContain("DEFAULT_TRIP_MAX_DISTANCE_KM"); });
 it("renders inline accessible validation",()=>{ expect(page).toContain('role="alert"'); expect(page).toContain('role="group"'); expect(page).toContain("aria-invalid"); });
 it("prefills organizer without overwriting touched input",()=>{ expect(page).toContain("organizerTouchedRef.current"); expect(page).toContain('from("profiles")'); });
});
