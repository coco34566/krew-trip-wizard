import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export const qa = {
  email: (process.env.KREW_E2E_EMAIL ?? "").trim(),
  password: (process.env.KREW_E2E_PASSWORD ?? "").trim(),
  existingTripId: (process.env.KREW_E2E_EXISTING_TRIP_ID ?? "").trim(),
};

export function requireQaCredentials() {
  expect(qa.email, "KREW_E2E_EMAIL must be configured").not.toBe("");
  expect(qa