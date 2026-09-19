// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeExternalLink } from "@/components/krew/SafeExternalLink";

describe("SafeExternalLink", () => {
  it("ne rend pas un lien javascript:", () => {
    render(<SafeExternalLink href="javascript:alert(1)">Dangereux</SafeExternalLink>);
    expect(screen.queryByRole("link", { name: "Dangereux" })).toBeNull();
  });

  it("rend une URL HTTPS sûre", () => {
    render(<SafeExternalLink href="https://example.com/path">Sûr</SafeExternalLink>);
    expect(screen.getByRole("link", { name: "Sûr" }).getAttribute("href")).toBe("https://example.com/path");
  });
});
