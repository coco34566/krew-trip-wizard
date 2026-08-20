import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock tanstack router components / hooks
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: any) => ({ options }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: any) => fn,
}));

vi.mock("@/lib/trips.functions", () => ({
  createTrip: vi.fn().mockResolvedValue({ id: "trip-123", tripId: "trip-123" }),
}));

// Import page component
import { Route } from "../trips.new";

describe("NewTripPage - Creation Screen Typologies", () => {
  function renderPage() {
    const Component = (Route as any).options.component;
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={qc}>
        <Component />
      </QueryClientProvider>,
    );
  }

  it("renders active typologies as selectable buttons", () => {
    renderPage();

    // Check active ones are present
    const evgBtn = screen.getByRole("button", { name: /EVG/i });
    const evjfBtn = screen.getByRole("button", { name: /EVJF/i });
    const anniBtn = screen.getByRole("button", { name: /Anniversaire/i });
    const weekendBtn = screen.getByRole("button", { name: /Week-end entre amis/i });

    expect(evgBtn).toBeInTheDocument();
    expect(evjfBtn).toBeInTheDocument();
    expect(anniBtn).toBeInTheDocument();
    expect(weekendBtn).toBeInTheDocument();
  });

  it("renders upcoming typologies as non-selectable disabled elements in 'À venir' section", () => {
    renderPage();

    expect(screen.getByText("À venir")).toBeInTheDocument();

    const voyageGroupe = screen.getByText("Voyage de groupe");
    const voyageFamille = screen.getByText("Voyage famille");
    const seminaire = screen.getByText("Séminaire");
    const retraite = screen.getByText("Départ à la retraite");

    expect(voyageGroupe).toBeInTheDocument();
    expect(voyageFamille).toBeInTheDocument();
    expect(seminaire).toBeInTheDocument();
    expect(retraite).toBeInTheDocument();

    // They should NOT be buttons
    expect(screen.queryByRole("button", { name: /Voyage de groupe/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Voyage famille/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Séminaire/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Départ à la retraite/i })).toBeNull();
  });

  it("does not render 'Autre'", () => {
    renderPage();
    expect(screen.queryByText("Autre")).toBeNull();
  });

  it("toggles Star input when selecting EVG, EVJF, or Anniversaire, but not for Week-end entre amis", async () => {
    const user = userEvent.setup();
    renderPage();

    // Initially "weekend" is selected by default -> no Star input
    expect(screen.queryByText(/Personne principale \(Star\)/i)).toBeNull();

    // Select EVG -> Star input should appear
    await user.click(screen.getByRole("button", { name: /EVG/i }));
    expect(screen.getByText(/Personne principale \(Star\)/i)).toBeInTheDocument();

    // Select EVJF -> Star input remains
    await user.click(screen.getByRole("button", { name: /EVJF/i }));
    expect(screen.getByText(/Personne principale \(Star\)/i)).toBeInTheDocument();

    // Select Anniversaire -> Star input remains
    await user.click(screen.getByRole("button", { name: /Anniversaire/i }));
    expect(screen.getByText(/Personne principale \(Star\)/i)).toBeInTheDocument();

    // Select Week-end entre amis -> Star input disappears
    await user.click(screen.getByRole("button", { name: /Week-end entre amis/i }));
    expect(screen.queryByText(/Personne principale \(Star\)/i)).toBeNull();
  });
});
