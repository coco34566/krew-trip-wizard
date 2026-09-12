// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  listPhotos: vi.fn(),
  insertPhoto: vi.fn(),
  updatePhoto: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  createSignedUrls: vi.fn(),
  sha256File: vi.fn(),
  createPhotosZip: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: any) => ({
      ...config,
      useParams: () => ({ tripId: "trip-1" }),
    }),
  Link: ({ children, params }: any) => <a href={`/trips/${params.tripId}`}>{children}</a>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/krew/visual-language", () => ({
  KrewIcon: () => <span data-testid="krew-icon" />,
  KrewMark: () => <span data-testid="krew-mark" />,
  KrewNote: ({ children }: any) => <span>{children}</span>,
  KrewOrganicBlob: () => <span data-testid="krew-blob" />,
}));

vi.mock("@/components/krew/KrewRecapCard", () => ({ KrewRecapCard: () => null }));
vi.mock("@/components/krew/KrewThinkingState", () => ({
  KrewThinkingState: ({ customMessage }: any) => <div>{customMessage}</div>,
}));
vi.mock("@/components/krew/KrewPageShell", () => ({
  KrewPageShell: ({ children, ...props }: any) => <main {...props}>{children}</main>,
}));
vi.mock("@/lib/krew/trip-recap", () => ({ buildTripRecap: () => ({ eligible: false }) }));
vi.mock("@/lib/souvenirs-photo-upload", () => ({ sha256File: mocks.sha256File }));
vi.mock("@/lib/souvenirs-download", () => ({ createPhotosZip: mocks.createPhotosZip }));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

function tripPhotosChain() {
  let selected = "";
  let updating = false;
  const chain: any = {};

  chain.select = vi.fn((columns: string) => {
    selected = columns;
    return chain;
  });
  chain.eq = vi.fn((column: string) => {
    if (updating && column === "id") return Promise.resolve({ error: null });
    return chain;
  });
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => mocks.listPhotos());
  chain.maybeSingle = vi.fn(async () => ({ data: selected === "id" ? null : null, error: null }));
  chain.insert = vi.fn(async (payload: unknown) => {
    mocks.insertPhoto(payload);
    return { error: null };
  });
  chain.update = vi.fn((payload: unknown) => {
    mocks.updatePhoto(payload);
    updating = true;
    return chain;
  });

  return chain;
}

function simpleTableChain(table: string) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data:
      table === "trips"
        ? {
            id: "trip-1",
            name: "Week-end test",
            start_date: "2026-09-01",
            end_date: "2026-09-03",
            participants_count: 2,
            selected_activity_ids: [],
            group_itinerary: null,
            group_logistics: null,
          }
        : null,
    error: null,
  }));
  chain.maybeSingle = vi.fn(async () => ({
    data: table === "trip_participants" ? { display_name: "Alice" } : null,
    error: null,
  }));
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
    storage: {
      from: () => ({
        upload: mocks.storageUpload,
        remove: mocks.storageRemove,
        createSignedUrls: mocks.createSignedUrls,
      }),
    },
  },
}));

import { Route } from "./trips.$tripId.memories";

const existingPhoto = {
  id: "photo-1",
  trip_id: "trip-1",
  url: "",
  author: "Alice",
  likes: 2,
  created_at: "2026-09-02T10:00:00.000Z",
  storage_path: "trip-1/user-1/photo-1.jpg",
  owner_user_id: "user-1",
  original_filename: "plage.jpg",
  trip_photo_likes: [],
};

function renderMemories() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Component = (Route as any).component;
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.from.mockImplementation((table: string) =>
    table === "trip_photos" ? tripPhotosChain() : simpleTableChain(table),
  );
  mocks.listPhotos.mockResolvedValue({ data: [], error: null });
  mocks.storageUpload.mockResolvedValue({ error: null });
  mocks.storageRemove.mockResolvedValue({ error: null });
  mocks.createSignedUrls.mockResolvedValue({
    data: [{ path: existingPhoto.storage_path, signedUrl: "https://signed.test/plage.jpg" }],
    error: null,
  });
  mocks.sha256File.mockResolvedValue("hash-123");
  mocks.createPhotosZip.mockResolvedValue(new Blob(["zip"], { type: "application/zip" }));
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:krew-test"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Memories current behavior characterization", () => {
  it("keeps the progressive-loading shell visible while photos are still loading", async () => {
    mocks.listPhotos.mockReturnValue(new Promise(() => undefined));

    renderMemories();

    expect(await screen.findByRole("heading", { name: "L'album du voyage" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choisir des photos" })).toBeVisible();
    expect(screen.getByText("Chargement des souvenirs…")).toBeVisible();
  });

  it("uploads an image through the current Storage + trip_photos sequence", async () => {
    localStorage.setItem("krew_photo_permission", "granted");
    renderMemories();

    await waitFor(() => expect(mocks.from).toHaveBeenCalledWith("trip_participants"));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["photo"], "weekend.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mocks.storageUpload).toHaveBeenCalledTimes(1));
    const [path, uploadedFile, options] = mocks.storageUpload.mock.calls[0];
    expect(path).toMatch(/^trip-1\/user-1\/[0-9a-f-]+\.jpg$/i);
    expect(uploadedFile).toBe(file);
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
    expect(mocks.insertPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        owner_user_id: "user-1",
        storage_path: path,
        author: "Alice",
        content_hash: "hash-123",
        original_filename: "weekend.jpg",
        mime_type: "image/jpeg",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("1 photo ajoutée à l’album");
  });

  it("deletes an owned photo from Storage before soft-deleting the database row", async () => {
    mocks.listPhotos.mockResolvedValue({ data: [existingPhoto], error: null });
    renderMemories();

    const deleteButton = await screen.findByRole("button", { name: "Supprimer la photo" });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(mocks.storageRemove).toHaveBeenCalledWith([existingPhoto.storage_path]));
    expect(mocks.updatePhoto).toHaveBeenCalledTimes(1);
    expect(mocks.updatePhoto.mock.calls[0][0]).toEqual(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Photo supprimée");
  });

  it("downloads the current full album as a zip using signed photo URLs", async () => {
    mocks.listPhotos.mockResolvedValue({ data: [existingPhoto], error: null });
    renderMemories();

    const downloadButton = await screen.findByRole("button", { name: "Toutes (1)" });
    fireEvent.click(downloadButton);

    await waitFor(() =>
      expect(mocks.createPhotosZip).toHaveBeenCalledWith([
        { name: "plage.jpg", url: "https://signed.test/plage.jpg" },
      ]),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:krew-test");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("1 photo prête à télécharger");
  });

  it("persists and resets the current local photo-import permission preference", async () => {
    renderMemories();

    fireEvent.click(await screen.findByRole("button", { name: "Choisir des photos" }));
    expect(screen.getByRole("dialog", { name: "Autoriser l’import de photos" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Autoriser" }));
    expect(localStorage.getItem("krew_photo_permission")).toBe("granted");

    const resetButton = await screen.findByRole("button", {
      name: "Réinitialiser l’autorisation d’import de photos",
    });
    fireEvent.click(resetButton);
    expect(localStorage.getItem("krew_photo_permission")).toBeNull();
  });

  it("keeps the back navigation pointed at the current trip", async () => {
    renderMemories();

    const backLink = await screen.findByRole("link", { name: "Retour au voyage" });
    expect(backLink).toHaveAttribute("href", "/trips/trip-1");
  });
});
