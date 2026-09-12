import { afterEach, describe, expect, it, vi } from "vitest";

import { reportServerError } from "@/lib/server-error-reporting.server";

// CI retrigger after test-only visual gate stabilization.
describe("reportServerError", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("redacts sensitive data before logging or sending the webhook payload", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://example.test/webhook");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportServerError(new Error("Failure for alice@example.com token=super-secret"), {
      tripId: "trip-alice@example.com",
      provider: "provider-alice@example.com",
      kind: "kind-alice@example.com",
      nested: {
        fullName: "Alice Martin",
        details: {
          email: "alice@example.com",
          note: "Call Alice Martin at alice@example.com",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(request.body);

    expect(body).not.toContain("alice@example.com");
    expect(body).not.toContain("super-secret");
    expect(body).not.toContain("Alice Martin");
    expect(body).toContain("[Redacted email]");
    expect(body).toContain("token=[Redacted]");

    const loggedPayload = String(consoleError.mock.calls[0]?.[0]);
    expect(loggedPayload).not.toContain("alice@example.com");
    expect(loggedPayload).not.toContain("super-secret");
    expect(loggedPayload).not.toContain("Alice Martin");
    expect(loggedPayload).toContain('"fullName": "[Redacted]"');
    expect(loggedPayload).toContain('"email": "[Redacted]"');
    expect(loggedPayload).toContain('"note": "[Redacted]"');
  });
});
