import { useEffect, useState } from "react";

export type MemoriesPhotoPermission = "granted" | "denied" | "prompt";

const MEMORIES_PHOTO_PERMISSION_KEY = "krew_photo_permission";

export function readMemoriesPhotoPermission(
  storage: Pick<Storage, "getItem"> = localStorage,
): MemoriesPhotoPermission {
  const saved = storage.getItem(MEMORIES_PHOTO_PERMISSION_KEY);
  return saved === "granted" || saved === "denied" ? saved : "prompt";
}

export function writeMemoriesPhotoPermission(
  value: Exclude<MemoriesPhotoPermission, "prompt">,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(MEMORIES_PHOTO_PERMISSION_KEY, value);
}

export function clearMemoriesPhotoPermission(
  storage: Pick<Storage, "removeItem"> = localStorage,
) {
  storage.removeItem(MEMORIES_PHOTO_PERMISSION_KEY);
}

export function useMemoriesPhotoPermission() {
  const [permission, setPermission] = useState<MemoriesPhotoPermission>("prompt");

  useEffect(() => {
    setPermission(readMemoriesPhotoPermission());
  }, []);

  const grantPermission = () => {
    writeMemoriesPhotoPermission("granted");
    setPermission("granted");
  };

  const denyPermission = () => {
    writeMemoriesPhotoPermission("denied");
    setPermission("denied");
  };

  const resetPermission = () => {
    clearMemoriesPhotoPermission();
    setPermission("prompt");
  };

  return { permission, grantPermission, denyPermission, resetPermission };
}
