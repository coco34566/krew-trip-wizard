// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryState = vi.hoisted(() => ({
  loading: true,
  trip: {
    name: "Voyage test",
    duration_nights: 2,
    participants_count: 3,
    dates_locked: false,
    start_date: null as string | null,
    end_date: null as string | null,
  },
  availability: {
    expected: 3,
    answered: 0,
    windows: [] as Array<unknown>,
    trip: {
      datesLocked: false,
      lockedStart: null as string | null,
      lockedEnd: null as string | null,
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => vi.fn(),
  createMiddleware: () => ({ server: (handler: unknown) => handler }),
  createServerFn: () => {
    type ServerFnChain = {
      middleware: () => ServerFnChain;
      inputValidator: () => ServerFnChain;
      handler: (handler: unknown) => unknown;
    };
    const chain = {} as ServerFnChain;
    chain.middleware = () => chain;
    chain.inputValidator = () => chain;
    chain.handler = (handler: unknown) => handler;
    return chain;
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const common = {
      isLoading: queryState.loading,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    };
    if (queryKey[0] === "trip") {
      return {
        ...common,
        data: queryState.loading ? undefined : { isOwner: true, trip: queryState.trip },
      };
    }
    return {
      ...common,
      data: queryState.loading ? undefined : queryState.availability,
    };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/availability.functions", () => ({
  calculateTripDateRange: vi.fn(),
  chooseTripDates: vi.fn(),
  getTripAvailability: vi.fn(),
  unlockTripDates: vi.fn(),
}));
vi.mock("@/lib/trips.functions", () => ({ getTripDetail: vi.fn() }));

import { TripDatesPage } from "./TripDatesPage";

describe("TripDatesPage", () => {
  beforeEach(() => {
    queryState.loading = true;
    queryState.trip.dates_locked = false;
    queryState.trip.start_date = null;
    queryState.trip.end_date = null;
    queryState.availability.answered = 0;
    queryState.availability.windows = [];
    queryState.availability.trip.datesLocked = false;
    queryState.availability.trip.lockedStart = null;
    queryState.availability.trip.lockedEnd = null;
  });

  it("renders the canonical Dates page after its loading queries resolve", () => {
    const view = render(<TripDatesPage tripId="00000000-0000-4000-8000-000000000099" />);
    expect(screen.getByText("Chargement des dates du groupe…")).toBeInTheDocument();

    queryState.loading = false;
    view.rerender(<TripDatesPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.getByRole("heading", { name: "Dates du groupe" })).toBeInTheDocument();
    expect(screen.getByText(/Aucune date commune pour le moment/)).toBeInTheDocument();
  });

  it("renders a trip whose dates are already locked", () => {
    queryState.loading = false;
    queryState.trip.dates_locked = true;
    queryState.trip.start_date = "2026-10-10";
    queryState.trip.end_date = "2026-10-12";

    render(<TripDatesPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.getByRole("heading", { name: "Dates du groupe" })).toBeInTheDocument();
    expect(screen.getByText("Dates confirmées")).toBeInTheDocument();
  });

  it("renders the ranked windows of an unlocked trip", () => {
    queryState.loading = false;
    queryState.availability.answered = 2;
    queryState.availability.windows = [
      {
        start: "2026-11-06",
        end: "2026-11-08",
        covered: 2,
        total: 3,
        coverageRatio: 2 / 3,
        availablePeople: [{ name: "Alex" }, { name: "Sam" }],
        unavailablePeople: [{ name: "Lou" }],
      },
    ];

    render(<TripDatesPage tripId="00000000-0000-4000-8000-000000000099" />);

    expect(screen.getByRole("heading", { name: "Dates du groupe" })).toBeInTheDocument();
    expect(screen.getByText(/2\/3 disponibles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choisir ces dates" })).toBeInTheDocument();
  });
});
