import { describe, expect, it } from "vitest";

import { safeInternalPath } from "../safe-redirect";

describe("safeInternalPath", () => {
  it.each([
    ["/", "/"],
    ["/dashboard", "/dashboard"],
    ["/trips/abc?section=recap#x", "/trips/abc?section=recap#x"],
    ["/join/abc?token=xyz", "/join/abc?token=xyz"],
  ])("accepte %s", (input, expected) => {
    expect(safeInternalPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\\\evil.com",
    "\\/evil.com",
    "/\tevil.com",
    "/\nevil.com",
    "  //evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "",
  ])("rejette %j", (input) => {
    expect(safeInternalPath(input)).toBeNull();
  });

  it("rejette les valeurs non string", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(42)).toBeNull();
    expect(safeInternalPath({})).toBeNull();
  });

  it("rejette les chaînes de plus de 2048 caractères", () => {
    expect(safeInternalPath("/" + "a".repeat(2048))).toBeNull();
  });
});
