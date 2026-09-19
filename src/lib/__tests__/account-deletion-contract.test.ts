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
    expect(account).toContain("ownedTripsError || tripsDeletedWithAccount.length > 0");
  });
  it("reste fail-closed si la vérification des voyages échoue", () => {
    expect(account).toContain("setOwnedTripsError(true)");
    expect(account).toContain("Impossible de vérifier tes voyages organisés.");
    expect(account).toContain("setOwnedTripsReloadKey((value) => value + 1)");
    expect(account).toContain("ownedTripsError || tripsDeletedWithAccount.length > 0");
  });
  it("nettoie les avatars avant le RPC en best-effort", () => {
    expect(account.indexOf("cleanupAvatarFilesBestEffort")).toBeLessThan(account.indexOf('supabase.rpc("delete_my_account")'));
    expect(account).toContain('supabase.storage.from("avatars")');
    expect(account).toContain("bucket.remove(paths)");
  });
});
