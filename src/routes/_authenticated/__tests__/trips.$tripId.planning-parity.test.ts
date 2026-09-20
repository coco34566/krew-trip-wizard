import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("planning autonomous route parity", () => {
  it("keeps the planning map that legacy section URLs rendered", () => {
    const source = readFileSync("src/routes/_authenticated/trips.$tripId.planning.tsx", "utf8");
    expect(source).toContain('import { PlanningMapSection } from "@/components/krew/PlanningMapSection";');
    expect(source).toContain("<PlanningMapSection tripId={tripId} />");
  });
});
