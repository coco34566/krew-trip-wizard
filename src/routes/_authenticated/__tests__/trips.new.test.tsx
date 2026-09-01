import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

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
    expect(screen.getByRole("button", { name: /EVG/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /EVJF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anniversaire/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Week-end entre amis/i })).toBeInTheDocument();
  });

  it("renders upcoming typologies as non-selectable labels in the 'Bientôt' list", () => {
    renderPage();
    expect(screen.getByText("Bientôt :")).toBeInTheDocument();
    for (const label of ["Voyage de groupe", "Voyage famille", "Séminaire", "Départ à la retraite"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: new RegExp(label, "i") })).toBeNull();
    }
  });

  it("does not render 'Autre'", () => {
    renderPage();
    expect(screen.queryByText("Autre")).toBeNull();
  });

  it("shows before submit that the organizer first name is required", () => {
    renderPage();
    const firstNameInput = screen.getByRole("textbox", { name: /Ton prénom/i });
    expect(firstNameInput).toBeRequired();
    expect(firstNameInput).toHaveAttribute("aria-required", "true");
    expect(screen.getByText(/Pour que le groupe sache qui organise et te reconnaisse dans les réponses/i)).toBeInTheDocument();
  });

  it("toggles Star input when selecting EVG, EVJF, or Anniversaire, but not for Week-end entre amis", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText(/Qui est la Star/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: /EVG/i }));
    expect(screen.getByText(/Qui est la Star/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /EVJF/i }));
    expect(screen.getByText(/Qui est la Star/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Anniversaire/i }));
    expect(screen.getByText(/Qui est la Star/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Week-end entre amis/i }));
    expect(screen.queryByText(/Qui est la Star/i)).toBeNull();
  });
});