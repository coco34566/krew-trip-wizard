import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFeedback = vi.fn();

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => fetchFeedback,
}));

vi.mock("@/lib/organizer-questionnaire-feedback.functions", () => ({
  getOrganizerQuestionnaireFeedback: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: any) => <a href="#">{children}</a>,
  Navigate: () => <div data-testid="redirect" />,
}));

import { TripParticipantFeedbackPage } from "@/components/krew/TripParticipantFeedbackPage";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TripParticipantFeedbackPage tripId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  );
}

describe("TripParticipantFeedbackPage", () => {
  beforeEach(() => {
    fetchFeedback.mockReset();
  });

  it("renders submitted answers, aggregate summary, pending people and comments", async () => {
    fetchFeedback.mockResolvedValue({
      trip: { id: "trip-1", name: "Test 12", isAdmin: true },
      progress: { answered: 2, total: 4 },
      aggregate: {
        flightAccepted: 1,
        flightDeclared: 2,
        medianBudget: 450,
        budgetDeclared: 1,
        constraintCount: 1,
      },
      submitted: [
        {
          id: "p1",
          name: "Alice",
          isStar: false,
          departureCity: "Paris",
          flightAccepted: true,
          maxTravelHours: 4,
          budgetMax: 450,
          accommodation: {
            role: "base_only",
            lodgingTypes: ["hôtel"],
            roomType: "double",
            acceptsSharedRoom: false,
            requiredAmenities: [],
          },
          constraints: {
            dietary: ["végétarien"],
            excludedDestinations: [],
            dealBreakerAmbiances: [],
            dealBreakers: [],
            accessibility: false,
          },
          wishes: ["culture"],
          ambiances: ["détente"],
          wantedEnvironment: "urbain",
          dates: {
            available: ["2026-11-06"],
            blocked: [],
            flexDays: 1,
          },
        },
      ],
      pending: [{ id: "p2", name: "Bob", isStar: false }],
      unjoinedExpected: 1,
      comments: [
        {
          id: "c1",
          author: "Alice",
          text: "J’aimerais éviter de courir partout.",
          createdAt: "2026-09-20T12:00:00Z",
          kind: "comment",
        },
      ],
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "Retours du groupe" })).toBeTruthy();
    expect(screen.getAllByText("Alice")).toHaveLength(2);
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("Questionnaire non soumis")).toBeTruthy();
    expect(screen.getByText("1/2 l’acceptent")).toBeTruthy();
    expect(screen.getAllByText("450 € / pers.")).toHaveLength(2);
    expect(screen.getByText("J’aimerais éviter de courir partout.")).toBeTruthy();
  });

  it("redirects a non-admin after a 403", async () => {
    fetchFeedback.mockRejectedValue(
      new Error("403 Forbidden: réservé à l’organisateur et au co-organisateur"),
    );

    renderPage();

    expect(await screen.findByTestId("redirect")).toBeTruthy();
  });
});
