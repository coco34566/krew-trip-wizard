import { expect, test } from "@playwright/test";
import { isTestTripName, TEST_TRIP_PREFIXES, testTripName } from "./test-trip-constants";

test("E2E cleanup only recognizes the reserved trip prefixes", () => {
  for (const prefix of TEST_TRIP_PREFIXES) {
    const name = testTripName(prefix);
    expect(name.startsWith(prefix)).toBe(true);
    expect(isTestTripName(name)).toBe(true);
  }

  expect(isTestTripName("Weekend Lisbonne")).toBe(false);
  expect(isTestTripName("E2E-autre-format")).toBe(false);
  expect(isTestTripName("VISUAL-OTHER-123")).toBe(false);
});
