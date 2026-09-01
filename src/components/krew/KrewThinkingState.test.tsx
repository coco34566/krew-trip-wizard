// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KrewThinkingState } from "./KrewThinkingState";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("KrewThinkingState", () => {
  it("renders immediately for initial page loading", () => {
    render(<KrewThinkingState customMessage="Chargement de la page…" delayMs={0} />);
    expect(screen.getByRole("status").textContent).toContain("Chargement de la page…");
  });

  it("reserves its layout before delayed long-action feedback", () => {
    vi.useFakeTimers();
    const { container } = render(<KrewThinkingState context="planning" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.className).toContain("min-h-[116px]");

    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByRole("status").textContent).toContain("KREW prépare le planning");
  });
});
