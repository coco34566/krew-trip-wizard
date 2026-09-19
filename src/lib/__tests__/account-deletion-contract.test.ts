import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const account = readFileSync("src/routes/_authenticated/account.tsx", "utf8");

describe("suppression de compte", () => {
  it("avertit sur les voyages sans co-organisateur", () => {
    expect(account).toContain("Ils seront supprimés pour tous les participants");
    expect(account).toContain("tripsDeletedWithAccount");
  });
  it("bloque la suppression tant que la case n’est pas cochée", () => {
    expect(account).toContain("understandsTripDeletion");
    expect(account).toContain("(tripsDeletedWithAccount.length > 0 && !understandsTripDeletion)");
  });
  it("nettoie les avatars avant le RPC en best-effort", () => {
    expect(account.indexOf("cleanupAvatarFilesBestEffort")).toBeLessThan(account.indexOf('supabase.rpc("delete_my_account")'));
    expect(account).toContain('supabase.storage.from("avatars")');
    expect(account).toContain("bucket.remove(paths)");
  });
});
