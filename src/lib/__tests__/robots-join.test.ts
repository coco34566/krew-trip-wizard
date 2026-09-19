import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("robots invitation links", () => {
  it("allows crawlers to fetch join previews while keeping other private routes blocked", () => {
    const robots = readFileSync("public/robots.txt", "utf8");
    expect(robots).not.toContain("Disallow: /join/");
    expect(robots).toContain("Disallow: /trips/");
    expect(robots).toContain("Disallow: /auth");
  });
});
