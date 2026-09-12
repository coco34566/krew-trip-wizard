#!/usr/bin/env bash
set -euo pipefail

npx tsc --noEmit --pretty false > /tmp/tsc-before.log 2>&1 || true

cat > src/lib/__tests__/memories-service.integration.test.ts <<'EOF'
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
  const photoChain: Record<string, unknown> = {};
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
    expect(mocks.storageUpload.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.photoInsert.mock.invocationCallOrder[0],
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
    expect(mocks.storageRemove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.photoUpdateEq.mock.invocationCallOrder[0],
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
EOF

python3 <<'PY'
from pathlib import Path
p = Path('src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx')
s = p.read_text()
old = '  rpc: vi.fn().mockResolvedValue({ error: null }),\n}));'
new = '  rpc: vi.fn().mockResolvedValue({ error: null }),\n  photoQueryLoading: false,\n}));'
assert old in s
s = s.replace(old, new, 1)
old = '''      return {\n        data: [existingPhoto],\n        isLoading: false,\n        isError: false,\n        refetch: vi.fn(),\n      };'''
new = '''      return {\n        data: mocks.photoQueryLoading ? [] : [existingPhoto],\n        isLoading: mocks.photoQueryLoading,\n        isError: false,\n        refetch: vi.fn(),\n      };'''
assert old in s
s = s.replace(old, new, 1)
old = 'vi.mock("@/components/krew/KrewThinkingState", () => ({ KrewThinkingState: () => <div>loading</div> }));'
new = 'vi.mock("@/components/krew/KrewThinkingState", () => ({ KrewThinkingState: ({ customMessage }: any) => <div role="status">{customMessage}</div> }));'
assert old in s
s = s.replace(old, new, 1)
old = '''    mocks.storageRemove.mockResolvedValue({ error: null });\n    mocks.createPhotosZip.mockResolvedValue(new Blob(["zip"]));'''
new = '''    mocks.storageRemove.mockResolvedValue({ error: null });\n    mocks.createPhotosZip.mockResolvedValue(new Blob(["zip"]));\n    mocks.photoQueryLoading = false;'''
assert old in s
s = s.replace(old, new, 1)
needle = '''  it("uploads an accepted image to Storage then inserts its trip_photos row", async () => {'''
test = '''  it("keeps the page shell and primary actions visible while photos load progressively", () => {\n    mocks.photoQueryLoading = true;\n    renderMemories();\n\n    expect(screen.getByRole("heading", { name: "L'album du voyage" })).toBeInTheDocument();\n    expect(screen.getByRole("button", { name: "Choisir des photos" })).toBeInTheDocument();\n    expect(screen.getByRole("status")).toHaveTextContent("Chargement des souvenirs…");\n  });\n\n'''
assert needle in s
s = s.replace(needle, test + needle, 1)
p.write_text(s)
PY

cat > /tmp/memories_visual_test.txt <<'EOF'
test("Memories remains pixel-identical at the three reference viewports", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  expect(CURRENT_URL, "KREW_E2E_BASE_URL must be configured").not.toBe("");
  expect(BEFORE_URL, "KREW_E2E_BEFORE_URL must be configured for Memories Phase 5 proof").not.toBe("");
  const current = await openAuthenticatedPage(browser, CURRENT_URL);
  const tripId = await firstTripId(current.page);
  const before = await openAuthenticatedPage(browser, BEFORE_URL);

  try {
    for (const viewport of VIEWPORTS) {
      const path = `/trips/${tripId}/memories`;
      const currentScreenshot = await captureJourneySurface(current.page, path, viewport);
      const beforeScreenshot = await captureJourneySurface(before.page, path, viewport);
      const expectedWidth = viewport.name === "desktop" ? 1024 : viewport.width;

      expect(await renderedPageShellWidth(current.page)).toBe(expectedWidth);
      expect(await renderedPageShellWidth(before.page)).toBe(expectedWidth);
      await expect(current.page.locator('main[data-krew-page-shell][data-krew-story-page="memories"]')).toHaveCount(1);
      await expect(before.page.locator('main[data-krew-page-shell][data-krew-story-page="memories"]')).toHaveCount(1);

      const snapshotName = `runtime-before-${viewport.name}-memories-phase5.png`;
      const snapshotPath = testInfo.snapshotPath(snapshotName);
      mkdirSync(dirname(snapshotPath), { recursive: true });
      writeFileSync(snapshotPath, beforeScreenshot);
      expect(currentScreenshot).toMatchSnapshot(snapshotName, {
        threshold: 0,
        maxDiffPixels: 0,
      });

      await testInfo.attach(`after-${viewport.name}-memories-phase5`, {
        body: currentScreenshot,
        contentType: "image/png",
      });
      await testInfo.attach(`before-${viewport.name}-memories-phase5`, {
        body: beforeScreenshot,
        contentType: "image/png",
      });
    }
  } finally {
    await current.context.close();
    await before.context.close();
  }
});
EOF

python3 <<'PY'
from pathlib import Path
p = Path('tests/e2e/design-system-migration-visual.spec.ts')
s = p.read_text()
start = s.index('test("Memories matches the approved D5 story-shell contract"')
replacement = Path('/tmp/memories_visual_test.txt').read_text().rstrip() + '\n'
p.write_text(s[:start] + replacement)
PY

git diff --check
changed="$(git status --short -uall | sed -E 's/^.. //' | sort)"
expected="$(printf '%s\n' \
  'src/lib/__tests__/memories-service.integration.test.ts' \
  'src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx' \
  'tests/e2e/design-system-migration-visual.spec.ts' | sort)"
echo "$changed"
test "$changed" = "$expected"

npx vitest run \
  'src/lib/__tests__/memories-service.integration.test.ts' \
  'src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx' \
  'src/hooks/__tests__/use-memories-photo-permission.test.ts'

npx tsc --noEmit --pretty false > /tmp/tsc-after.log 2>&1 || true
python3 <<'PY'
import re
from collections import Counter
from pathlib import Path

def errs(path):
    out=[]
    for line in Path(path).read_text().splitlines():
        line=line.strip()
        if re.search(r'\berror TS\d+:', line):
            line=re.sub(r'^(.*?)(?:\(\d+,\d+\))(: error TS\d+:)', r'\1\2', line)
            out.append(line)
    return Counter(out)

before=errs('/tmp/tsc-before.log')
after=errs('/tmp/tsc-after.log')
added=list((after-before).elements())
print(f'before={sum(before.values())} after={sum(after.values())} added={len(added)}')
for line in sorted(added): print('ADD '+line)
if added: raise SystemExit(1)
PY

npm run build

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add \
  src/lib/__tests__/memories-service.integration.test.ts \
  'src/routes/_authenticated/__tests__/trips.$tripId.memories.characterization.test.tsx' \
  tests/e2e/design-system-migration-visual.spec.ts
git commit -m 'test(memories): lock integration and visual contracts'
git push origin HEAD:refactor/memories-architecture-phased
