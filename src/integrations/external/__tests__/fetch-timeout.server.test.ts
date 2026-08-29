import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExternal } from "../fetch-timeout.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchExternal", () => {
  it("keeps a normal provider response unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchExternal("https://provider.example/search", {
      headers: { Accept: "application/json" },
    }, 50);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts a provider call that never settles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }),
      ),
    );

    await expect(fetchExternal("https://provider.example/hang", {}, 5)).rejects.toThrow(
      "Fournisseur externe indisponible après 5 ms",
    );
  });
});
