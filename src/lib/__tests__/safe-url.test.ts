import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, safeExternalUrl } from "../safe-url";

describe("safeExternalUrl", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "vbscript:msgbox(1)",
    "java\nscript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "https://user:pass@example.com/path",
    "/relative/path",
    "",
  ])("refuse %s", (value) => {
    expect(safeExternalUrl(value)).toBeNull();
    expect(isSafeExternalUrl(value)).toBe(false);
  });

  it("refuse les valeurs non-string", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(42)).toBeNull();
  });

  it("refuse une URL trop longue", () => {
    expect(safeExternalUrl(`https://example.com/${"a".repeat(2040)}`)).toBeNull();
  });

  it("normalise une URL HTTPS valide", () => {
    expect(safeExternalUrl("  https://example.com/path?q=1  ")).toBe("https://example.com/path?q=1");
    expect(isSafeExternalUrl("https://example.com")).toBe(true);
  });
});
