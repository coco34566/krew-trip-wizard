import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openWhatsAppShare } from "../share";

describe("openWhatsAppShare", () => {
  const originalUserAgent = navigator.userAgent;
  let windowOpenMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    windowOpenMock = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  it("desktop: opens wa.me link in a new window", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      writable: true,
      configurable: true,
    });

    openWhatsAppShare("Hello Krew!");

    expect(windowOpenMock).toHaveBeenCalledWith(
      "https://wa.me/?text=Hello%20Krew!",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("mobile: creates invisible iframe with whatsapp:// scheme without changing window.location or calling window.open", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      writable: true,
      configurable: true,
    });

    const initialLocation = window.location.href;
    openWhatsAppShare("Hello Krew Mobile!");

    // Check iframe created
    const iframes = Array.from(document.querySelectorAll("iframe"));
    expect(iframes.length).toBe(1);
    expect(iframes[0]?.src).toBe("whatsapp://send?text=Hello%20Krew%20Mobile!");
    expect(iframes[0]?.style.display).toBe("none");

    // Location must NOT have changed
    expect(window.location.href).toBe(initialLocation);

    // window.open must NEVER be called on mobile
    expect(windowOpenMock).not.toHaveBeenCalled();

    // Fast-forward timers
    vi.advanceTimersByTime(1600);

    // Iframe should be removed from DOM
    expect(document.querySelectorAll("iframe").length).toBe(0);

    // window.open still not called on mobile
    expect(windowOpenMock).not.toHaveBeenCalled();
  });
});
