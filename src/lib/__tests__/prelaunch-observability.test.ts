import { afterEach, describe, expect, it, vi } from "vitest";

import { captureProductionError, scrubMonitoringContext } from "../error-monitoring";
import { isProductAnalyticsEnabled, trackProductEvent } from "../product-analytics";

describe("prelaunch observability privacy guards", () => {
  const previousDsn = process.env.SENTRY_DSN;

  afterEach(() => {
    if (previousDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = previousDsn;
    vi.restoreAllMocks();
  });

  it("redacts sensitive monitoring fields and secrets embedded in URLs", () => {
    const scrubbed = scrubMonitoringContext({
      email: "person@example.com",
      displayName: "Alice",
      operation: "planning",
      nested: {
        token: "top-secret",
        note: "private free text",
        safeValue: 42,
      },
      url: "https://example.test/path?token=secret-value&step=planning",
    });

    expect(scrubbed.email).toBe("[Redacted]");
    expect(scrubbed.displayName).toBe("[Redacted]");
    expect(scrubbed.operation).toBe("planning");
    expect(scrubbed.nested).toEqual({
      token: "[Redacted]",
      note: "[Redacted]",
      safeValue: 42,
    });
    expect(scrubbed.url).toBe(
      "https://example.test/path?token=[Redacted]&step=planning",
    );
  });

  it("does not emit monitoring or analytics network calls when not configured/consented", async () => {
    delete process.env.SENTRY_DSN;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(isProductAnalyticsEnabled()).toBe(false);
    await expect(trackProductEvent("trip_completed", { trip_id: "test-trip" })).resolves.toBe(false);
    await expect(
      captureProductionError(new Error("test failure"), { operation: "unit-test" }),
    ).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
