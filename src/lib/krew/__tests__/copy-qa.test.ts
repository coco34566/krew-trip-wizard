import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("copy QA publique", () => {
  it("utilise les erreurs françaises et les polices du design system", () => {
    const root = read("src/routes/__root.tsx");
    const styles = read("src/styles.css");
    expect(root).toContain("Page introuvable");
    expect(root).not.toContain("@Lovable");
    expect(styles).toContain('"Instrument Serif"');
    expect(styles).toContain('"Plus Jakarta Sans"');
    expect(styles).toContain('"Space Mono"');
  });

  it("ne rend plus les détails de score sur le hub et le récapitulatif", () => {
    const hub = read("src/routes/_authenticated/trips.$tripId.index.tsx");
    const recap = read("src/routes/_authenticated/trips.$tripId.recap.tsx");
    expect(hub).not.toContain("budget OK pour");
    expect(hub).not.toContain("Math.round(reco.score)");
    expect(recap).not.toContain("ProposalScoreRadar");
  });

  it("bloque la route StayAPI de diagnostic en production avant tout appel", () => {
    const route = read("src/routes/stayapi-test.ts");
    expect(route.indexOf('process.env["NODE_ENV"]')).toBeLessThan(
      route.indexOf("resolveStayApiDestination(destinationQuery)"),
    );
    expect(route).toContain('new Response("Not found", { status: 404 })');
  });
});
