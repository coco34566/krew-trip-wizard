import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consent = readFileSync("src/components/krew/CookieConsent.tsx", "utf8");
const tracker = readFileSync("src/components/krew/AffiliateClickTracker.tsx", "utf8");
const landing = readFileSync("src/routes/index.tsx", "utf8");

describe("cookie consent contracts", () => {
  it("reopens settings and expires consent after 183 days", () => {
    expect(consent).toContain('krew:cookie-consent-open');
    expect(consent).toContain("183 * 24 * 60 * 60 * 1000");
    expect(consent).toContain('aria-label="Choix de cookies"');
  });
  it("only exposes affiliation as optional active category", () => {
    expect(consent).toContain('title="Partenaires & affiliation"');
    expect(consent).not.toContain('title="Mesure & amélioration"');
    expect(consent).not.toContain('title="Personnalisation & publicité"');
    expect(consent).toContain("saveConsent({ ...emptyOptionalConsent(), affiliate: true })");
  });
  it("keeps affiliate tracking gated by consent", () => {
    expect(tracker).toContain("if (!hasAffiliateConsent()) return;");
  });
  it("exposes cookie settings from landing footer", () => {
    expect(landing).toContain("<CookieSettingsLink />");
  });
});
