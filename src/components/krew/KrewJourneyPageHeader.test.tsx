// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KrewJourneyPageHeader } from "./KrewJourneyPageHeader";

describe("KrewJourneyPageHeader", () => {
  it("keeps the shared journey identity and canonical intro rhythm", () => {
    const { container } = render(
      <KrewJourneyPageHeader
        tripName="Test 1"
        title="Disponibilités"
        otterSrc="/brand/otter-states/availability.png"
      >
        <p>Contenu du chapitre</p>
      </KrewJourneyPageHeader>,
    );

    expect(container.querySelector("[data-krew-journey-header]")).toBeInTheDocument();
    expect(container.querySelector("[data-krew-journey-intro]")).toBeInTheDocument();
    expect(container.querySelector("[data-krew-journey-title]")).toBeInTheDocument();
    expect(container.querySelector("[data-krew-journey-otter-slot]")).toBeInTheDocument();
    expect(screen.getByText("Test 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Disponibilités" })).toBeInTheDocument();
    expect(screen.getByText("Contenu du chapitre")).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/otter-states/availability.png"]')).toBeInTheDocument();
    expect(container.querySelector('[data-krew-journey-intro]')).toHaveClass(
      "leading-[var(--krew-journey-intro-leading)]",
    );
  });

  it("renders optional branded title details without making them mandatory", () => {
    const { rerender } = render(
      <KrewJourneyPageHeader
        tripName="Test 1"
        title="Planning"
        otterSrc="/brand/otter-states/planning.png"
        titleTrailing={<span>Jour par jour</span>}
        annotation={<span>Annotation KREW</span>}
      />,
    );

    expect(screen.getByText("Jour par jour")).toBeInTheDocument();
    expect(screen.getByText("Annotation KREW")).toBeInTheDocument();

    rerender(
      <KrewJourneyPageHeader
        tripName="Test 1"
        title="Planning"
        otterSrc="/brand/otter-states/planning.png"
      />,
    );

    expect(screen.queryByText("Jour par jour")).not.toBeInTheDocument();
    expect(screen.queryByText("Annotation KREW")).not.toBeInTheDocument();
  });
});
