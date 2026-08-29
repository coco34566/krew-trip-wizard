import { test } from "@playwright/test";
import { signIn } from "./helpers";
import { assertNoDisposableTripsOnDashboard } from "./test-lifecycle";

// Safety-net only. Disposable trips should normally be deleted by the test that created them.
test("dashboard contains no leaked disposable KREW E2E trips", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Leak guard only needs to run once.");
  await signIn(page);
  await assertNoDisposableTripsOnDashboard(page);
});
