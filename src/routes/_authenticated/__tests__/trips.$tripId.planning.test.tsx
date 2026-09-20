// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ tripId: "trip-123" }),
  }),
}));

vi.mock("@/components/krew/TripPlanningPage", () => ({
  TripPlanningPage: ({ tripId }: { tripId: string }) => (
    <div data-testid="planning-page">{tripId}</div>
  ),
}));

vi.mock("@/components/krew/PlanningMapSection", () => ({
  PlanningMapSection: ({ tripId }: { tripId: string }) => (
    <div data-testid="planning-map">{tripId}</div>
  ),
}));

import { Route } from "../trips.$tripId.planning";

type RouteOptions = { component: () => JSX.Element };

describe("planning route parity", () => {
  it("keeps the planning map alongside the autonomous planning page", () => {
    const options = (Route as unknown as { options: RouteOptions }).options;
    render(<options.component />);

    expect(screen.getByTestId("planning-page")).toHaveTextContent("trip-123");
    expect(screen.getByTestId("planning-map")).toHaveTextContent("trip-123");
  });
});
