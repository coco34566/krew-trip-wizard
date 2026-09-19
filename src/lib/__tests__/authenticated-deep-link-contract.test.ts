import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("authenticated deep links", () => {
  const route = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
  const auth = readFileSync("src/routes/auth.tsx", "utf8");

  it("conserve chemin, query et hash vers auth", () => {
    expect(route).toContain("beforeLoad: async ({ location })");
    expect(route).toContain('search: { next: location.href }');
    expect(route).toContain("supabase.auth.getSession()");
  });

  it("restaure safeNext sans perdre sa query", () => {
    expect(auth).toContain("window.location.replace(safeNext)");
    expect(auth).toContain('next.startsWith("/") && !next.startsWith("//")');
  });
});
