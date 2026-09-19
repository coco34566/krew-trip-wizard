import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const auth = readFileSync("src/routes/auth.tsx", "utf8");
const join = readFileSync("src/routes/join.$tripId.tsx", "utf8");

describe("auth et parcours invité", () => {
  it("ouvre l’inscription par défaut pour un next /join", () => {
    expect(auth).toContain('defaultValue={safeNext?.startsWith("/join/") ? "signup" : "signin"}');
  });
  it("gère le renvoi de confirmation avec cooldown 60 s", () => {
    expect(auth).toContain("setResendCooldown(60)");
    expect(auth).toContain("resendCooldown > 0");
    expect(auth).toContain("E-mail envoyé, vérifie aussi tes spams");
  });
  it("impose 8 caractères hors connexion", () => {
    expect(auth).toContain("password.length < 8");
    expect(auth).toContain("minLength={8}");
    expect(auth).not.toContain("6 caractères minimum");
  });
  it("préremplit le prénom avec priorité session puis compte", () => {
    expect(join.indexOf("sessionStorage.getItem")).toBeLessThan(join.indexOf("user?.user_metadata?.full_name"));
    expect(join).toContain('provider === "email" ? accountName : accountName.split(/\\s+/)[0]');
  });
  it("conserve le lien d’invitation non pré-encodé", () => {
    expect(join).toContain("const authNext = invitePath;");
  });
});
