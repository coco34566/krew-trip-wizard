from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def must_replace(text: str, old: str, new: str, label: str, count: int = 1) -> str:
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{label}: expected {count}, found {actual}")
    return text.replace(old, new, count)


def must_regex(text: str, pattern: str, repl: str, label: str, count: int = 1) -> str:
    updated, actual = re.subn(pattern, repl, text, count=count, flags=re.S)
    if actual != count:
        raise SystemExit(f"{label}: expected {count}, found {actual}")
    return updated


# Shared contract: mutateAsync can resolve a payload, not only void.
p = "src/components/krew/KrewStatefulButton.tsx"
s = read(p)
s = must_replace(
    s,
    '  onAction: () => void | Promise<void>;',
    '  onAction: () => void | Promise<unknown>;',
    "stateful Promise contract",
)
write(p, s)

# A. Transport time preferences.
p = "src/components/krew/TransportTimePrefsCard.tsx"
s = read(p)
s = must_replace(s, 'import { Loader2 } from "lucide-react";\n', "", "transport loader import")
s = must_replace(
    s,
    'import { Button } from "@/components/ui/button";\n',
    'import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";\n',
    "transport stateful import",
)
s = must_replace(
    s,
    'import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";\n',
    "",
    "transport icon import",
)
s = must_replace(s, '      toast.success("Horaires de transport enregistrés !");\n', "", "transport success toast")
s = must_regex(
    s,
    r'<Button size="sm" onClick=\{\(\) => saveMutation\.mutate\(\)\} disabled=\{saveMutation\.isPending \|\| isMyPrefsLoading\} className="w-full sm:w-auto">.*?</Button>',
    '''<KrewStatefulButton
          size="sm"
          className="w-full sm:w-auto"
          idleLabel="Enregistrer"
          loadingLabel="Enregistrement…"
          successLabel="Enregistré"
          errorLabel="Réessayer"
          disabled={isMyPrefsLoading}
          onAction={() => saveMutation.mutateAsync()}
        />''',
    "transport save button",
)
write(p, s)

# B. Invitation by email.
p = "src/routes/_authenticated/trips.$tripId.invite.tsx"
s = read(p)
s = must_replace(s, '      toast.success("Invitation ajoutée");\n', "", "invite success toast")
s = must_regex(
    s,
    r'''              <Button\n                disabled=\{!email\.trim\(\) \|\| inviteMutation\.isPending\}\n                onClick=\{\(\) => inviteMutation\.mutate\(\)\}\n                className="w-full shrink-0 sm:w-auto"\n              >\n                \{inviteMutation\.isPending \? <Loader2 className="animate-spin" /> : <KrewIcon name="invite" tone="cream" size="sm" className="size-4" />\}\n                Inviter\n              </Button>''',
    '''              <KrewStatefulButton
                className="w-full shrink-0 sm:w-auto"
                idleLabel="Inviter"
                loadingLabel="Invitation…"
                successLabel="Invitation envoyée"
                errorLabel="Réessayer"
                disabled={!email.trim()}
                onAction={() => inviteMutation.mutateAsync()}
              />''',
    "invite email button",
)
write(p, s)

# C. Star setup only; full questionnaire still navigates.
p = "src/routes/_authenticated/trips.$tripId.star.tsx"
s = read(p)
s = must_replace(
    s,
    'import { KrewThinkingState } from "@/components/krew/KrewThinkingState";\n',
    'import { KrewThinkingState } from "@/components/krew/KrewThinkingState";\nimport { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";\n',
    "star stateful import",
)
s = must_replace(
    s,
    '    onSuccess: () => { toast.success("Choix de la Star enregistrés"); queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] }); queryClient.invalidateQueries({ queryKey: ["trip", tripId] }); },',
    '    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["star-prefs", tripId] }); queryClient.invalidateQueries({ queryKey: ["trip", tripId] }); },',
    "star success toast",
)
s = must_regex(
    s,
    r'''\{data\.trip\.isOwner \? <Button variant="outline" onClick=\{\(\) => setupMutation\.mutate\(\)\} disabled=\{setupMutation\.isPending\} className="w-full sm:w-auto">\{setupMutation\.isPending \? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="check" tone="sage" size="sm" className="size-4" />\}Enregistrer ces choix</Button> : null\}''',
    '''{data.trip.isOwner ? <KrewStatefulButton variant="outline" className="w-full sm:w-auto" idleLabel="Enregistrer ces choix" loadingLabel="Enregistrement…" successLabel="Choix enregistrés" errorLabel="Réessayer" onAction={() => setupMutation.mutateAsync()} /> : null}''',
    "star setup button",
)
write(p, s)

# D-H. Main trip surface.
p = "src/routes/_authenticated/trips.$tripId.index.tsx"
s = read(p)
s = must_replace(
    s,
    'import { KrewThinkingState } from "@/components/krew/KrewThinkingState";\n',
    'import { KrewThinkingState } from "@/components/krew/KrewThinkingState";\nimport { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";\n',
    "trip stateful import",
)

s = must_regex(
    s,
    r'''                <Button\n                  variant="outline"\n                  className="w-full sm:w-auto"\n                  onClick=\{\(\) => regenerateMutation\.mutate\(undefined\)\}\n                  disabled=\{\n                    regenerateMutation\.isPending \|\| \(readiness \? !readiness\.canGenerate : false\)\n                  \}\n                  title=\{\n                    readiness && !readiness\.canGenerate\n                      \? \(readiness\.message \?\? "Questionnaires incomplets"\)\n                      : undefined\n                  \}\n                >\n                  \{regenerateMutation\.isPending \? \(\n                    <Loader2 className="animate-spin size-4 shrink-0" />\n                  \) : \(\n                    <KrewIcon name="destination" tone="plum" size="sm" className="size-4 shrink-0" />\n                  \)\}\n                  \{recommendations\.length \? "Voir d’autres propositions" : "Générer les propositions"\}\n                </Button>''',
    '''                <KrewStatefulButton
                  variant="outline"
                  className="w-full sm:w-auto"
                  idleLabel={recommendations.length ? "Voir d’autres propositions" : "Générer les propositions"}
                  loadingLabel="Recherche en cours…"
                  successLabel="Propositions actualisées"
                  errorLabel="Réessayer"
                  resetAfterMs={1400}
                  onAction={() => regenerateMutation.mutateAsync(undefined)}
                  disabled={readiness ? !readiness.canGenerate : false}
                  title={readiness && !readiness.canGenerate ? (readiness.message ?? "Questionnaires incomplets") : undefined}
                />''',
    "destination stateful button",
)

s = must_regex(
    s,
    r'''              <Button\n                className="w-full sm:w-auto"\n                disabled=\{hotelLogisticsMutation\.isPending\}\n                onClick=\{\(\) => hotelLogisticsMutation\.mutate\(\)\}\n              >\n                \{hotelLogisticsMutation\.isPending \? \(\n                  <Loader2 className="animate-spin size-4 shrink-0" />\n                \) : \(\n                  <KrewIcon name="accommodation" tone="plum" size="sm" className="size-4 shrink-0" />\n                \)\}\n                \{\(trip as any\)\.group_logistics\?\.hotels\?\.length\n                  \? "Actualiser les offres"\n                  : "Rechercher des hébergements"\}\n              </Button>''',
    '''              <KrewStatefulButton
                className="w-full sm:w-auto"
                idleLabel={(trip as any).group_logistics?.hotels?.length ? "Actualiser les offres" : "Rechercher des hébergements"}
                loadingLabel="Recherche en cours…"
                successLabel="Hébergements actualisés"
                errorLabel="Réessayer"
                resetAfterMs={1400}
                onAction={() => hotelLogisticsMutation.mutateAsync()}
              />''',
    "accommodation stateful button",
)

s = must_regex(
    s,
    r'''              <Button disabled=\{logisticsMutation\.isPending\} onClick=\{\(\) => logisticsMutation\.mutate\(\)\} className="w-full sm:w-auto">\n                \{logisticsMutation\.isPending \? <Loader2 className="size-4 animate-spin" /> : <KrewIcon name="transport" tone="plum" size="sm" className="size-4" />\}\n                \{\(trip as any\)\.group_logistics\?\.transports\?\.length \? "Actualiser les trajets" : "Trouver les trajets"\}\n              </Button>''',
    '''              <KrewStatefulButton
                className="w-full sm:w-auto"
                idleLabel={(trip as any).group_logistics?.transports?.length ? "Actualiser les trajets" : "Trouver les trajets"}
                loadingLabel={(trip as any).group_logistics?.transports?.length ? "Actualisation…" : "Recherche en cours…"}
                successLabel={(trip as any).group_logistics?.transports?.length ? "Trajets actualisés" : "Trajets trouvés"}
                errorLabel="Réessayer"
                resetAfterMs={1400}
                onAction={() => logisticsMutation.mutateAsync()}
              />''',
    "transport stateful button",
)

s = must_regex(
    s,
    r'''              <Button\n                className="w-full sm:w-auto"\n                disabled=\{itineraryMutation\.isPending\}\n                onClick=\{\(\) => itineraryMutation\.mutate\(\)\}\n              >\n                \{itineraryMutation\.isPending \? \(\n                  <Loader2 className="animate-spin size-4 shrink-0" />\n                \) : \(\n                  <KrewIcon name="planning" tone="plum" size="sm" className="size-4 shrink-0" />\n                \)\}\n                \{\(trip as any\)\.group_itinerary\?\.days\?\.length\n                  \? "Revoir le planning"\n                  : "Préparer le planning"\}\n              </Button>''',
    '''              <KrewStatefulButton
                className="w-full sm:w-auto"
                idleLabel={(trip as any).group_itinerary?.days?.length ? "Revoir le planning" : "Préparer le planning"}
                loadingLabel={(trip as any).group_itinerary?.days?.length ? "Mise à jour…" : "Préparation…"}
                successLabel={(trip as any).group_itinerary?.days?.length ? "Planning actualisé" : "Planning prêt"}
                errorLabel="Réessayer"
                resetAfterMs={1400}
                onAction={() => itineraryMutation.mutateAsync()}
              />''',
    "planning stateful button",
)

s = must_regex(
    s,
    r'''                <Button\n                  onClick=\{\(\) => generateTasksMutation\.mutate\(\)\}\n                  className="mt-4 w-full sm:w-auto"\n                  disabled=\{generateTasksMutation\.isPending\}\n                >\n                  \{generateTasksMutation\.isPending \? \(\n                    <Loader2 className="animate-spin size-4" />\n                  \) : \(\n                    <Sparkles className="size-4" />\n                  \)\}\n                  Préparer les tâches\n                </Button>''',
    '''                <KrewStatefulButton
                  className="mt-4 w-full sm:w-auto"
                  idleLabel="Préparer les tâches"
                  loadingLabel="Préparation…"
                  successLabel="Tâches prêtes"
                  errorLabel="Réessayer"
                  resetAfterMs={1400}
                  onAction={() => generateTasksMutation.mutateAsync()}
                />''',
    "tasks stateful button",
)
write(p, s)

# Component tests.
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
    expect(b).toHaveAttribute("data-stateful-status", "idle");
    expect(b).toHaveAttribute("data-variant", "outline");
    expect(b).toHaveAttribute("data-size", "sm");
    expect(b).toHaveClass("w-full", "test-hook");
  });

  it("shows custom loading and blocks double click", async () => {
    const d = deferred(); const onAction = vi.fn(() => d.promise);
    render(<KrewStatefulButton idleLabel="Sauvegarder" loadingLabel="Sauvegarde…" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder" }));
    fireEvent.click(screen.getByRole("button", { name: "Sauvegarde…" }));
    const b = screen.getByRole("button", { name: "Sauvegarde…" });
    expect(onAction).toHaveBeenCalledTimes(1); expect(b).toBeDisabled(); expect(b).toHaveAttribute("aria-busy", "true");
    await act(async () => d.resolve());
  });

  it("shows custom success and resets", async () => {
    vi.useFakeTimers();
    render(<KrewStatefulButton idleLabel="Inviter" successLabel="Invitation envoyée" resetAfterMs={1200} onAction={() => Promise.resolve({ ok: true })} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Inviter" })));
    expect(screen.getByRole("button", { name: "Invitation envoyée" })).toHaveAttribute("data-stateful-status", "success");
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole("button", { name: "Inviter" })).toHaveAttribute("data-stateful-status", "idle");
  });

  it("shows error and can retry", async () => {
    const onAction = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    render(<KrewStatefulButton idleLabel="Exporter" errorLabel="Réessayer" successLabel="Exporté" onAction={onAction} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Exporter" })));
    expect(screen.getByRole("button", { name: "Réessayer" })).toHaveAttribute("data-stateful-status", "error");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Réessayer" })));
    expect(screen.getByRole("button", { name: "Exporté" })).toHaveAttribute("data-stateful-status", "success");
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("honors disabled", () => {
    const onAction = vi.fn(); render(<KrewStatefulButton idleLabel="Enregistrer" disabled onAction={onAction} />);
    const b = screen.getByRole("button", { name: "Enregistrer" }); expect(b).toBeDisabled(); fireEvent.click(b); expect(onAction).not.toHaveBeenCalled();
  });

  it("uses custom loading and success labels", async () => {
    const d = deferred(); render(<KrewStatefulButton idleLabel="Préparer" loadingLabel="Préparation…" successLabel="Planning prêt" onAction={() => d.promise} />);
    fireEvent.click(screen.getByRole("button", { name: "Préparer" })); expect(screen.getByRole("button", { name: "Préparation…" })).toBeInTheDocument();
    await act(async () => d.resolve()); expect(screen.getByRole("button", { name: "Planning prêt" })).toBeInTheDocument();
  });
});
''')

# Integration test on a real converted React Query mutation.
Path("src/components/krew/TransportTimePrefsCard.test.tsx").write_text(r'''// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ savePrefs: vi.fn(), toastError: vi.fn(), getUser: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.savePrefs }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
import { TransportTimePrefsCard } from "./TransportTimePrefsCard";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function tableChain(table: string) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain); chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => table === "trip_participants" ? { data: { id: "participant-1" } } : { data: { earliest_departure_time: "09:00", latest_return_time: "18:00" } });
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
    expect(await screen.findByRole("button", { name: "Enregistré" })).toHaveAttribute("data-stateful-status", "success");
  });
});
''')

# Explicit non-conversion guardrails.
index = read("src/routes/_authenticated/trips.$tripId.index.tsx")
star = read("src/routes/_authenticated/trips.$tripId.star.tsx")
invite = read("src/routes/_authenticated/trips.$tripId.invite.tsx")
availability = read("src/routes/_authenticated/trips.$tripId.availability.tsx")
new_trip = read("src/routes/_authenticated/trips.new.tsx")
assert "mutation.mutate()" in star, "Star full questionnaire submit should remain non-stateful"
assert "inviteMutation.mutateAsync()" in invite
assert "shareOnWhatsApp" in invite
assert "Enregistrer mes disponibilités" in availability or "Mettre à jour mes disponibilités" in availability
assert "<form" in new_trip and "onSubmit" in new_trip
assert "cancelMutation.mutate(false)" in index and "cancelMutation.mutate(true)" in index
assert "transportPickMutation.mutate({" in index
assert "hotelVoteMutation.mutate(h.id)" in index
assert "navigator.clipboard" not in index and "Copier le lien" not in invite
