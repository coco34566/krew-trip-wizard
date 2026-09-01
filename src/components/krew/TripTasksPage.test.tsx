// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  isAdmin: false,
  userId: "participant-user",
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: any) => <a href="#">{children}</a>,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: any) => {
    if (queryKey[0] === "trip") {
      return {
        isLoading: false,
        isError: false,
        data: {
          isOwner: state.isAdmin,
          userId: state.userId,
          trip: {
            participants_count: 3,
            group_itinerary: { days: [{ day: 1, slots: [] }] },
          },
          participants: [
            { id: "p1", user_id: "owner", display_name: "Org", status: "accepte" },
            { id: "p2", user_id: "participant-user", display_name: "Pat", status: "accepte" },
            { id: "p3", user_id: null, display_name: "À inviter", status: "invite" },
          ],
        },
      };
    }
    return {
      isLoading: false,
      isError: false,
      data: [
        {
          id: "task-1",
          title: "Réserver le restaurant",
          status: "todo",
          assigned_participant_id: "p2",
          assigned_participant: {
            id: "p2",
            user_id: "participant-user",
            display_name: "Pat",
          },
        },
      ],
    };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/trips.functions", () => ({
  generateTasksForTrip: vi.fn(),
  getTripDetail: vi.fn(),
}));
vi.mock("@/lib/task-permissions.functions", () => ({
  reassignTaskSecure: vi.fn(),
  sanitizeTaskAssignments: vi.fn(),
  updateTaskStatusSecure: vi.fn(),
}));

import { TripTasksPage } from "./TripTasksPage";

describe("TripTasksPage role wording", () => {
  beforeEach(() => {
    state.isAdmin = false;
    state.userId = "participant-user";
  });

  it("shows organizer task-management wording and invite CTA to an admin", () => {
    state.isAdmin = true;
    state.userId = "owner";
    render(<TripTasksPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.getByRole("heading", { name: "Répartir les tâches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inviter le groupe" })).toBeInTheDocument();
  });

  it("shows consultation wording to a participant and no organizer invitation CTA", () => {
    render(<TripTasksPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.getByRole("heading", { name: "Les tâches du groupe" })).toBeInTheDocument();
    expect(screen.getByText(/uniquement celles qui te sont attribuées/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inviter le groupe" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Invite-les avant/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Réserver le restaurant").length).toBeGreaterThan(0);
  });

  it("does not expose an unclaimed invite as an assignable participant", () => {
    state.isAdmin = true;
    state.userId = "owner";
    render(<TripTasksPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.queryByRole("option", { name: "À inviter" })).not.toBeInTheDocument();
  });
});