from pathlib import Path

Path("src/components/krew/KrewStatefulButton.test.tsx").write_text(r'''// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KrewStatefulButton } from "./KrewStatefulButton";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("KrewStatefulButton", () => {
  it("renders idle and preserves shared Button variant/classes", () => {
    render(<KrewStatefulButton variant="outline" size="sm" className="w-full test-hook" idleLabel="Enregistrer" onAction={() => Promise.resolve()} />);
    const b = screen.getByRole("button", { name: "Enregistrer" });
    expect(b.getAttribute("data-stateful-status")).toBe("idle");
    expect(b.getAttribute("data-variant")).toBe("outline");
    expect(b.getAttribute("data-size")).toBe("sm");
    expect(b.className).toContain("w-full");
    expect(b.className).toContain("test-hook");
  });

  it("shows custom loading and blocks double click", async () => {
    const d = deferred();
    const onAction = vi.fn(() => d.promise);
    render(<KrewStatefulButton idleLabel="Sauvegarder" loadingLabel="Sauvegarde…" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder" }));
    const loadingButton = screen.getByRole("button", { name: "Sauvegarde…" });
    fireEvent.click(loadingButton);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
    expect(loadingButton.getAttribute("aria-busy")).toBe("true");
    await act(async () => d.resolve());
  });

  it("shows custom success and resets", async () => {
    vi.useFakeTimers();
    render(<KrewStatefulButton idleLabel="Inviter" successLabel="Invitation envoyée" resetAfterMs={1200} onAction={() => Promise.resolve({ ok: true })} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Inviter" })));
    expect(screen.getByRole("button", { name: "Invitation envoyée" }).getAttribute("data-stateful-status")).toBe("success");
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole("button", { name: "Inviter" }).getAttribute("data-stateful-status")).toBe("idle");
  });

  it("shows error and can retry", async () => {
    const onAction = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    render(<KrewStatefulButton idleLabel="Exporter" errorLabel="Réessayer" successLabel="Exporté" onAction={onAction} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Exporter" })));
    expect(screen.getByRole("button", { name: "Réessayer" }).getAttribute("data-stateful-status")).toBe("error");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Réessayer" })));
    expect(screen.getByRole("button", { name: "Exporté" }).getAttribute("data-stateful-status")).toBe("success");
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("honors disabled", () => {
    const onAction = vi.fn();
    render(<KrewStatefulButton idleLabel="Enregistrer" disabled onAction={onAction} />);
    const b = screen.getByRole("button", { name: "Enregistrer" });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(b);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("uses custom loading and success labels", async () => {
    const d = deferred();
    render(<KrewStatefulButton idleLabel="Préparer" loadingLabel="Préparation…" successLabel="Planning prêt" onAction={() => d.promise} />);
    fireEvent.click(screen.getByRole("button", { name: "Préparer" }));
    screen.getByRole("button", { name: "Préparation…" });
    await act(async () => d.resolve());
    screen.getByRole("button", { name: "Planning prêt" });
  });
});
''')

Path("src/components/krew/TransportTimePrefsCard.test.tsx").write_text(r'''// @vitest-environment jsdom
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
''')
