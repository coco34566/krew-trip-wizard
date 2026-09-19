import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("hygiène des migrations", () => {
  const names = readdirSync("supabase/migrations").filter((name) => /^\d/.test(name));
  it("n’a pas de migration .sql.", () => {
    expect(names.some((name) => name.endsWith(".sql."))).toBe(false);
  });
  it("a des timestamps de 14 chiffres uniques pour les migrations horodatées", () => {
    const stamps = names.map((name) => name.match(/^(\d{14})_/)?.[1]).filter(Boolean);
    expect(new Set(stamps).size).toBe(stamps.length);
  });
});
