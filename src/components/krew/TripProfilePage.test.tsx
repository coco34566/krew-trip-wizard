// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileConceptCard } from "./TripProfilePage";

function renderCard(overrides: Partial<React.ComponentProps<typeof ProfileConceptCard>> = {}) {
  const onToggle = vi.fn();
  render(
    <ProfileConceptCard
      conceptId="city_trip_discovery"
      label="City trip découverte"
      rationale="Un séjour urbain pour explorer la ville."
      selected={false}
      disabled={false}
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return onToggle;
}

describe("ProfileConceptCard accessibility", () => {
  it("exposes the profile label exactly once as the accessible name", () => {
    renderCard();
    const card = screen.getByRole("button", { name: "City trip découverte" });
    expect(card).toHaveAccessibleName("City trip découverte");
    expect(card).not.toHaveAccessibleName("City trip découverte City trip découverte");
  });

  it("keeps decorative marks out of the accessible name when selected", () => {
    renderCard({ selected: true });
    expect(screen.getByRole("button", { name: "City trip découverte" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("remains keyboard-usable when editable", async () => {
    const user = userEvent.setup();
    const onToggle = renderCard();
    const card = screen.getByRole("button", { name: "City trip découverte" });
    await user.tab();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("exposes the disabled read-only state without changing the accessible name", () => {
    renderCard({ disabled: true });
    const card = screen.getByRole("button", { name: "City trip découverte" });
    expect(card).toBeDisabled();
    expect(card).toHaveAccessibleName("City trip découverte");
  });
});
