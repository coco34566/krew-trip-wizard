import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.KREW_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const origin = new URL(baseURL).origin;
const cookieConsent = JSON.stringify({
  essential: true,
  analytics: false,
  personalization: false,
  advertising: false,
  retargeting: false,
  social: false,
  affiliate: false,
  date: new Date(0).toISOString(),
  version: 1,
});

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // Golden-path tests can call metered external providers. Never retry them automatically:
  // a retry would duplicate Gemini/Tavily calls and make usage measurements misleading.
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // Core journey tests are not cookie-banner tests. Seed the user's legitimate "Tout refuser"
    // choice so every fresh browser context (including invited participants) can exercise KREW
    // without the consent UI covering mobile actions. Cookie UX should be tested separately.
    storageState: {
      cookies: [],
      origins: [
        {
          origin,
          localStorage: [{ name: "krew-cookie-consent", value: cookieConsent }],
        },
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
