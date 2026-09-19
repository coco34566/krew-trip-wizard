import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTrip: vi.fn(),
  navigate: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: any) => config,
  Link: ({ children, to, params: _params, search: _search, ...rest }: any) => (
    <a href={typeof to === "string" ? to : "#"} {...rest}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-start")>();
  return {
    ...actual,
    useServerFn: () => mocks.createTrip,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { NewTripPage } from "../trips.new";

describe("new trip validation", () => {
  beforeEach(() => {
    mocks.createTrip.mockReset();
    mocks.navigate.mockReset();
    mocks.invalidateQueries.mockReset();
  });

  it("keeps invalid submission in error state and never calls createTrip", async () => {
    render(<NewTripPage />);

    fireEvent.click(screen.getByRole("button", { name: "Créer et inviter la Krew" }));

    const nameError = await screen.findByText("Donne un nom au voyage (2 caractères minimum).");
    expect(nameError.getAttribute("role")).toBe("alert");
    expect(screen.queryByText("Voyage créé")).toBeNull();
    expect(mocks.createTrip).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    });
  });
});
