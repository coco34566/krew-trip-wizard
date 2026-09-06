// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
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

  it("keeps long labels wrap-safe even when a legacy consumer requests a fixed height", () => {
    render(
      <KrewStatefulButton
        size="sm"
        className="h-8 w-40"
        idleLabel="Marquer ce trajet comme réservé pour tout le groupe"
        onAction={() => Promise.resolve()}
      />,
    );
    const b = screen.getByRole("button");
    const label = b.querySelector("[data-krew-button-label]");
    expect(b).toHaveStyle({ height: "auto" });
    expect(label).toHaveClass("whitespace-normal", "break-words", "text-center");
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
    expect(loadingButton.querySelector("[data-krew-button-content]")).toHaveClass(
      "grid-cols-[1rem_minmax(0,auto)_1rem]",
    );
    expect(loadingButton.querySelector("[data-krew-button-label]")).toHaveTextContent("Sauvegarde…");
    await act(async () => d.resolve());
  });

  it("shows custom success and resets", async () => {
    vi.useFakeTimers();
    render(<KrewStatefulButton idleLabel="Inviter" successLabel="Invitation envoyée" resetAfterMs={1200} onAction={() => Promise.resolve({ ok: true })} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Inviter" })));
    const success = screen.getByRole("button", { name: "Invitation envoyée" });
    expect(success.getAttribute("data-stateful-status")).toBe("success");
    expect(success.querySelector("[data-krew-button-content]")).toHaveClass(
      "grid-cols-[1rem_minmax(0,auto)_1rem]",
    );
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

  it("keeps the labels from click time while async data refreshes", async () => {
    const d = deferred();
    const onAction = vi.fn(() => d.promise);
    const { rerender } = render(
      <KrewStatefulButton
        idleLabel="Trouver les trajets"
        loadingLabel="Recherche en cours…"
        successLabel="Trajets trouvés"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trouver les trajets" }));
    rerender(
      <KrewStatefulButton
        idleLabel="Actualiser les trajets"
        loadingLabel="Actualisation…"
        successLabel="Trajets actualisés"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("button", { name: "Recherche en cours…" })).toBeTruthy();
    await act(async () => d.resolve());
    expect(screen.getByRole("button", { name: "Trajets trouvés" })).toBeTruthy();
  });

  it("keeps success visible when the parent becomes disabled after success", async () => {
    const onAction = vi.fn(() => Promise.resolve());
    const { rerender } = render(<KrewStatefulButton idleLabel="Inviter" successLabel="Invitation envoyée" onAction={onAction} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Inviter" })));
    rerender(<KrewStatefulButton idleLabel="Inviter" successLabel="Invitation envoyée" disabled onAction={onAction} />);
    const successButton = screen.getByRole("button", { name: "Invitation envoyée" });
    expect((successButton as HTMLButtonElement).disabled).toBe(false);
    expect(successButton.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(successButton);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
