// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  clearMemoriesPhotoPermission,
  readMemoriesPhotoPermission,
  writeMemoriesPhotoPermission,
} from "../use-memories-photo-permission";

describe("Memories photo permission preference", () => {
  it("maps a missing preference to prompt", () => {
    expect(readMemoriesPhotoPermission({ getItem: () => null })).toBe("prompt");
  });

  it("maps a corrupt preference to prompt", () => {
    expect(readMemoriesPhotoPermission({ getItem: () => "unexpected" })).toBe("prompt");
  });

  it.each(["granted", "denied"] as const)("preserves the valid %s value", (value) => {
    expect(readMemoriesPhotoPermission({ getItem: () => value })).toBe(value);
  });

  it("preserves the current storage failure behavior", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("storage disabled", "SecurityError");
      },
    };
    expect(() => readMemoriesPhotoPermission(storage)).toThrow("storage disabled");
  });

  it("writes and clears only the existing KREW permission key", () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    writeMemoriesPhotoPermission("granted", { setItem });
    writeMemoriesPhotoPermission("denied", { setItem });
    clearMemoriesPhotoPermission({ removeItem });
    expect(setItem).toHaveBeenNthCalledWith(1, "krew_photo_permission", "granted");
    expect(setItem).toHaveBeenNthCalledWith(2, "krew_photo_permission", "denied");
    expect(removeItem).toHaveBeenCalledWith("krew_photo_permission");
  });
});
