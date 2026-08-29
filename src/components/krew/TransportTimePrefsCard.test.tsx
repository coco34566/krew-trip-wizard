// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ savePrefs: vi.fn(), toastError: vi.fn(), getUser: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.savePrefs }));
vi.mock("@/lib/trips.functions", () => ({ setMyTransportTimePrefs: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
import { TransportTimePrefsCard } from "./TransportTimePrefsCard";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function tableChain(table: string) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => table === "trip_participants"
    ? { data: { id: "participant-1" } }
    : { data: { earliest_departure_time: "09:00", latest_return_time: "18:00" } });
  return chain;
}

describe("TransportTimePrefsCard stateful mutation", () => {
  it("awaits the mutation once and shows inline success", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.from.mockImplementation((table: string) => tableChain(table));
    mocks.savePrefs.mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><TransportTimePrefsCard tripId="trip-1" /></QueryClientProvider>);
    await screen.findByDisplayValue("09:00");
    fireEvent.change(screen.getByDisplayValue("09:00"), { target: { value: "08:30" } });
    fireEvent.change(screen.getByDisplayValue("18:00"), { target: { value: "19:15" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(mocks.savePrefs).toHaveBeenCalledTimes(1));
    expect(mocks.savePrefs).toHaveBeenCalledWith({ data: { tripId: "trip-1", earliestDepartureTime: "08:30", latestReturnTime: "19:15" } });
    const successButton = await screen.findByRole("button", { name: "Enregistré" });
    expect(successButton.getAttribute("data-stateful-status")).toBe("success");
  });
});
