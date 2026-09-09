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
});
