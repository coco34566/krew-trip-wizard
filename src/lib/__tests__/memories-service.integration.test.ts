// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  duplicateMaybeSingle: vi.fn(),
  photoInsert: vi.fn(),
  photoOrder: vi.fn(),
  photoUpdateEq: vi.fn(),
  storageUpload: vi.fn(),
  storageRemove: vi.fn(),
  storageCreateSignedUrls: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const photoChain: any = {};
  photoChain.select = vi.fn(() => photoChain);
  photoChain.eq = vi.fn(() => photoChain);
  photoChain.is = vi.fn(() => photoChain);
  photoChain.order = mocks.photoOrder;
  photoChain.maybeSingle = mocks.duplicateMaybeSingle;
  photoChain.insert = mocks.photoInsert;
  photoChain.update = vi.fn(() => ({ eq: mocks.photoUpdateEq }));

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "trip_photos") return photoChain;
        throw new Error(`Unexpected table in Memories service integration test: ${table}`);
      }),
      storage: {
        from: vi.fn((bucket: string) => {
          if (bucket !== "trip-photos") throw new Error(`Unexpected bucket: ${bucket}`);
          return {
            upload: mocks.storageUpload,
            remove: mocks.storageRemove,
            createSignedUrls: mocks.storageCreateSignedUrls,
          };
        }),
      },
    },
  };
});

import { listTripPhotos, removeTripPhoto, uploadTripPhoto, type Photo } from "../memories-service";

const storedPhoto = {
  author: "Alice",
  captured_at: null,
  content_hash: "hash-photo-1",
  created_at: "2026-09-01T12:00:00.000Z",
  deleted_at: null,
  file_size_bytes: 123,
  height: null,
  id: "photo-1",
  likes: 2,
  mime_type: "image/jpeg",
  original_filename: "weekend.jpg",
  owner_user_id: "user-1",
  perceptual_hash: null,
  storage_path: "trip-123/user-1/photo-1.jpg",
  trip_id: "trip-123",
  url: null,
  width: null,
  trip_photo_likes: [{ user_id: "user-1" }],
};

function photoForDelete(): Photo {
  const { trip_photo_likes: _likes, ...row } = storedPhoto;
  return { ...row, url: "https://signed.test/photo-1", likedByMe: true };
}

describe("Memories service integration boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.duplicateMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.photoInsert.mockResolvedValue({ error: null });
    mocks.photoUpdateEq.mockResolvedValue({ error: null });
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.storageRemove.mockResolvedValue({ error: null });
    mocks.photoOrder.mockResolvedValue({ data: [], error: null });
    mocks.storageCreateSignedUrls.mockResolvedValue({ data: [], error: null });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "new-photo-id") });
  });

  it("uploads to Storage then persists the trip_photos row", async () => {
    const file = new File(["photo-bytes"], "weekend.PNG", { type: "image/png" });

    await expect(
      uploadTripPhoto({
        tripId: "trip-123",
        userId: "user-1",
        userName: "Alice",
        file,
        hash: "hash-123",
      }),
    ).resolves.toEqual({ duplicate: false });

    expect(mocks.storageUpload).toHaveBeenCalledWith(
      "trip-123/user-1/new-photo-id.png",
      file,
      { contentType: "image/png", upsert: false },
    );
    expect(mocks.photoInsert).toHaveBeenCalledWith({
      id: "new-photo-id",
      trip_id: "trip-123",
      owner_user_id: "user-1",
      storage_path: "trip-123/user-1/new-photo-id.png",
      author: "Alice",
      likes: 0,
      content_hash: "hash-123",
      original_filename: "weekend.PNG",
      mime_type: "image/png",
      file_size_bytes: file.size,
    });
    expect(mocks.storageUpload.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.photoInsert.mock.invocationCallOrder[0]!,
    );
  });

  it("stops on a Storage network failure without inserting a database row", async () => {
    const networkError = new Error("storage network unavailable");
    mocks.storageUpload.mockResolvedValue({ error: networkError });
    const file = new File(["photo-bytes"], "weekend.jpg", { type: "image/jpeg" });

    await expect(
      uploadTripPhoto({
        tripId: "trip-123",
        userId: "user-1",
        userName: "Alice",
        file,
        hash: "hash-123",
      }),
    ).rejects.toBe(networkError);

    expect(mocks.photoInsert).not.toHaveBeenCalled();
  });

  it("removes the Storage object before soft-deleting its row", async () => {
    await removeTripPhoto(photoForDelete());

    expect(mocks.storageRemove).toHaveBeenCalledWith(["trip-123/user-1/photo-1.jpg"]);
    expect(mocks.photoUpdateEq).toHaveBeenCalledWith("id", "photo-1");
    expect(mocks.storageRemove.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.photoUpdateEq.mock.invocationCallOrder[0]!,
    );
  });

  it("resolves the signed URL used by the album download flow", async () => {
    mocks.photoOrder.mockResolvedValue({ data: [storedPhoto], error: null });
    mocks.storageCreateSignedUrls.mockResolvedValue({
      data: [
        {
          path: "trip-123/user-1/photo-1.jpg",
          signedUrl: "https://signed.test/photo-1",
        },
      ],
      error: null,
    });

    const photos = await listTripPhotos("trip-123");

    expect(mocks.storageCreateSignedUrls).toHaveBeenCalledWith(
      ["trip-123/user-1/photo-1.jpg"],
      3600,
    );
    expect(photos).toHaveLength(1);
    expect(photos[0]).toEqual(
      expect.objectContaining({
        id: "photo-1",
        url: "https://signed.test/photo-1",
        likedByMe: true,
      }),
    );
  });
});
