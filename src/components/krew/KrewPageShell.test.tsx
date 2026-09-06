import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KrewJourneyLoadingState } from "@/components/krew/KrewJourneyAsyncState";
import { KrewPageShell } from "@/components/krew/KrewPageShell";

describe("KrewPageShell", () => {
  it.each(["form", "standard", "wide", "site"] as const)(
    "exposes the %s semantic page size without encoding a Tailwind width",
    (size) => {
      render(<KrewPageShell size={size}>Contenu</KrewPageShell>);

      const shell = screen.getByRole("main");
      expect(shell).toHaveAttribute("data-krew-page-shell");
      expect(shell).toHaveAttribute("data-krew-page-size", size);
      expect(shell).toHaveClass("krew-page-shell");
      expect(shell.className).not.toMatch(/max-w-/);
    },
  );

  it("preserves surface-specific classes and data hooks", () => {
    render(
      <KrewPageShell
        size="form"
        data-krew-preferences-page
        className="space-y-8 py-8 sm:py-10"
      >
        Contenu
      </KrewPageShell>,
    );

    const shell = screen.getByRole("main");
    expect(shell).toHaveAttribute("data-krew-preferences-page");
    expect(shell).toHaveClass("space-y-8", "py-8", "sm:py-10");
  });

  it("maps the legacy 820px async state to the semantic form shell", () => {
    render(
      <KrewJourneyLoadingState
        maxWidthClassName="max-w-[820px]"
        message="Chargement…"
      />,
    );

    const shell = screen.getByRole("main");
    expect(shell).toHaveAttribute("data-krew-journey-loading");
    expect(shell).toHaveAttribute("data-krew-page-size", "form");
    expect(shell).toHaveClass("krew-page-shell");
    expect(shell.className).not.toMatch(/max-w-/);
  });
  it("exposes the compact 16px TripHub gutter semantically", () => {
    render(<KrewPageShell size="standard" gutter="compact">Contenu</KrewPageShell>);

    const shell = screen.getByRole("main");
    expect(shell).toHaveAttribute("data-krew-page-size", "standard");
    expect(shell).toHaveAttribute("data-krew-page-gutter", "compact");
  });

});
