import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/krew-design-tokens.css", "utf8");

describe("KREW design token contract", () => {
  it("keeps the approved D3 form and wide gutter hierarchy", () => {
    expect(tokens).toContain("--krew-page-padding-x-form: 16px;");
    expect(tokens).toContain("--krew-page-padding-x-wide: 16px;");
    expect(tokens).toMatch(
      /@media \(min-width: 640px\)[\s\S]*--krew-page-padding-x-form: 24px;[\s\S]*--krew-page-padding-x-wide: 24px;/,
    );
    expect(tokens).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*--krew-page-padding-x-form: 32px;[\s\S]*--krew-page-padding-x-wide: 40px;/,
    );
  });

  it("keeps the approved D2 compact and overview rhythms", () => {
    expect(tokens).toContain("--krew-content-gap: 32px;");
    expect(tokens).toContain("--krew-overview-content-gap: 32px;");
    expect(tokens).toMatch(
      /@media \(min-width: 640px\)[\s\S]*--krew-overview-content-gap: 48px;/,
    );
  });

  it("keeps the approved D1 hero and chapter title scales", () => {
    expect(tokens).toContain("--krew-title-hero: 42px;");
    expect(tokens).toContain("--krew-title-chapter: 30px;");
    expect(tokens).toMatch(
      /@media \(min-width: 640px\)[\s\S]*--krew-title-chapter: 34px;[\s\S]*--krew-title-hero: 50px;/,
    );
    expect(tokens).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*--krew-title-hero: 56px;/,
    );
  });

  it("keeps the approved D4 title rhythm by semantic role", () => {
    expect(tokens).toContain("--krew-title-hero-leading: .94;");
    expect(tokens).toContain("--krew-title-hero-tracking: -.025em;");
    expect(tokens).toContain("--krew-title-leading: .98;");
    expect(tokens).toContain("--krew-title-tracking: -.02em;");
  });
});
