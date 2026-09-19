import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consent = readFileSync("src/components/krew/CookieConsent.tsx", "utf8");
const link = readFileSync("src/components/krew/CookieSettingsLink.tsx", "utf8");
const tracker = readFileSync("src/components/krew/AffiliateClickTracker.tsx", "utf8");

describe("cookie consent", () => {
  it("rouvre directement les réglages", () => {
    expect(consent).toContain('OPEN_SETTINGS_EVENT = "krew:cookie-consent-open"');
    expect(consent).toContain("setShowCustomize(true)");
    expect(link).toContain("openCookieSettings");
  });
  it("expire après 183 jours", () => {
    expect(consent).toContain("183 * 24 * 60 * 60 * 1000");
    expect(consent).toContain("Date.now() - consentDate > CONSENT_MAX_AGE_MS");
  });
  it("tout accepter n’active que l’affiliation", () => {
    expect(consent).toContain("...emptyOptionalConsent()");
    expect(consent).toContain("affiliate: true");
  });
  it("refuse le tracking partenaire sans consentement affiliate", () => {
    expect(tracker).toContain("if (!hasAffiliateConsent()) return;");
    expect(tracker).toContain("return parsed.affiliate === true;");
  });
});
