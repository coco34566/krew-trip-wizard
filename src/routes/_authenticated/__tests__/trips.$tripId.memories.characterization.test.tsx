// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  sha256File: vi.fn().mockResolvedValue("hash-123"),
  createPhotosZip: vi.fn().mockResolvedValue(new Blob(["zip"])),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  authGetUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
  participantMaybeSingle: vi.fn().mockResolvedValue({ data: { display_name: "Alice" }, error: null }),
  duplicateMaybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  photoInsert: vi.fn().mockResolvedValue({ error: null }),
  photoUpdateEq: vi.fn().mockResolvedValue({ error: null }),
  storageUpload: vi.fn().mockResolvedValue({ error: null }),
  storageRemove: vi.fn().mockResolvedValue({ error: null }),
  storageCreateSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
  rpc: vi.fn().mockResolvedValue({ error: null }),
}));

const existingPhoto = {
  id: "photo-1",
  trip_id: "trip-123",
  url: "https://example.test/photo.jpg",
  author: "Alice",
  likes: 0,
  likedByMe: false,
  created_at: "2026-09-01T12:00:00.000Z",
  storage_path: "trip-123/user-1/photo-1.jpg",
  owner_user_id: "user-1",
  original_filename: "souvenir.jpg",
};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: any) => ({
    options,
    useParams: () => ({ tripId: "trip-123" }),
  }),
  Link: ({ children, to, params, ...props }: any) => (
    <a href={String(to).replace("$tripId", params?.tripId ?? "")} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useQuery: ({ queryKey }: any) => {
    if (queryKey?.[0] === "trip-photos") {
      return {
        data: [existingPhoto],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey?.[0] === "trip-recap-source") {
      return { data: undefined, isLoading: false, isError: false };
    }
    return { data: undefined, isLoading: false, isError: false };
  },
  useMutation: ({ mutationFn, onSuccess, onError }: any) => ({
    isPending: false,
    mutate: (value: any) => {
      Promise.resolve(mutationFn(value)).then(onSuccess).catch(onError);
    },
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const participantChain: any = {
    select: vi.fn(() => participantChain),
    eq: vi.fn(() => participantChain),
    maybeSingle: mocks.participantMaybeSingle,
  };
  const duplicateChain: any = {
    select: vi.fn(() => duplicateChain),
    eq: vi.fn(() => duplicateChain),
    is: vi.fn(() => duplicateChain),
    maybeSingle: mocks.duplicateMaybeSingle,
    insert: mocks.photoInsert,
    update: vi.fn(() => ({ eq: mocks.photoUpdateEq })),
  };
  const genericChain: any = {
    select: vi.fn(() => genericChain),
    eq: vi.fn(() => genericChain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    supabase: {
      auth: { getUser: mocks.authGetUser },
      from: vi.fn((table: string) => {
        if (table === "trip_participants") return participantChain;
        if (table === "trip_photos") return duplicateChain;
        return genericChain;
      }),
      storage: {
        from: vi.fn(() => ({
          upload: mocks.storageUpload,
          remove: mocks.storageRemove,
          createSignedUrls: mocks.storageCreateSignedUrls,
        })),
      },
      rpc: mocks.rpc,
    },
  };
});

vi.mock("@/lib/souvenirs-photo-upload", () => ({ sha256File: mocks.sha256File }));
vi.mock("@/lib/souvenirs-download", () => ({ createPhotosZip: mocks.createPhotosZip }));
vi.mock("@/lib/krew/trip-recap", () => ({ buildTripRecap: vi.fn(() => null) }));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/krew/KrewRecapCard", () => ({ KrewRecapCard: () => null }));
vi.mock("@/components/krew/KrewThinkingState", () => ({ KrewThinkingState: () => <div>loading</div> }));
vi.mock("@/components/krew/KrewPageShell", () => ({
  KrewPageShell: ({ children, ...props }: any) => <main {...props}>{children}</main>,
}));
vi.mock("@/components/krew/visual-language", () => ({
  KrewIcon: () => <span data-testid="krew-icon" />,
  KrewMark: () => <span data-testid="krew-mark" />,
  KrewNote: ({ children }: any) => <span>{children}</span>,
  KrewOrganicBlob: () => <span data-testid="krew-blob" />,
}));

import { Route } from "../trips.$tripId.memories";

function renderMemories() {
  const Component = (Route as any).options.component;
  return render(<Component />);
}

describe("Memories route characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.authGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.participantMaybeSingle.mockResolvedValue({ data: { display_name: "Alice" }, error: null });
    mocks.duplicateMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.photoInsert.mockResolvedValue({ error: null });
    mocks.photoUpdateEq.mockResolvedValue({ error: null });
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.createPhotosZip.mockResolvedValue(new Blob(["zip"]));
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "new-photo-id") });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:memories") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("keeps the back navigation pointing to the current trip", () => {
    renderMemories();
    expect(screen.getByRole("link", { name: /Retour au voyage/i })).toHaveAttribute("href", "/trips/trip-123");
  });

  it("persists the current photo-import permission choice in localStorage", async () => {
    const user = userEvent.setup();
    renderMemories();

    await user.click(screen.getByRole("button", { name: "Choisir des photos" }));
    expect(screen.getByRole("dialog", { name: /Autoriser l’import de photos/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refuser" }));
    expect(localStorage.getItem("krew_photo_permission")).toBe("denied");
    expect(screen.queryByRole("dialog", { name: /Autoriser l’import de photos/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réinitialiser l’autorisation d’import de photos/i })).toBeInTheDocument();
  });

  it("uploads an accepted image to Storage then inserts its trip_photos row", async () => {
    const { container } = renderMemories();
    await waitFor(() => expect(mocks.authGetUser).toHaveBeenCalled());
    await waitFor(() => expect(mocks.participantMaybeSingle).toHaveBeenCalled());

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["photo-bytes"], "weekend.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mocks.sha256File).toHaveBeenCalledWith(file));
    await waitFor(() =>
      expect(mocks.storageUpload).toHaveBeenCalledWith(
        "trip-123/user-1/new-photo-id.png",
        file,
        { contentType: "image/png", upsert: false },
      ),
    );
    await waitFor(() =>
      expect(mocks.photoInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-photo-id",
          trip_id: "trip-123",
          owner_user_id: "user-1",
          storage_path: "trip-123/user-1/new-photo-id.png",
          author: "Alice",
          content_hash: "hash-123",
          original_filename: "weekend.png",
          mime_type: "image/png",
          file_size_bytes: file.size,
        }),
      ),
    );
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("1 photo ajoutée à l’album"));
  });

  it("deletes the owned Storage object before soft-deleting the database row", async () => {
    const user = userEvent.setup();
    renderMemories();
    await waitFor(() => expect(screen.getByRole("button", { name: "Supprimer la photo" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Supprimer la photo" }));

    await waitFor(() => expect(mocks.storageRemove).toHaveBeenCalledWith(["trip-123/user-1/photo-1.jpg"]));
    await waitFor(() => expect(mocks.photoUpdateEq).toHaveBeenCalledWith("id", "photo-1"));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Photo supprimée"));
  });

  it("downloads the current full album as the existing zip payload", async () => {
    const user = userEvent.setup();
    renderMemories();

    await user.click(screen.getByRole("button", { name: "Toutes (1)" }));

    await waitFor(() =>
      expect(mocks.createPhotosZip).toHaveBeenCalledWith([
        { name: "souvenir.jpg", url: "https://example.test/photo.jpg" },
      ]),
    );
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("1 photo prête à télécharger"));
  });
});
