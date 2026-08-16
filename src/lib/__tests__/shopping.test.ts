import { describe, expect, it } from "vitest";
import { resolveShoppingLink } from "../krew/shopping";

describe("shopping links", () => {
  it("n'affiche aucune option sans marchand configuré ou avec une URL invalide", () => {
    expect(resolveShoppingLink("speaker")).toBeNull();
    expect(
      resolveShoppingLink("speaker", {
        speaker: { merchant: "Partenaire", url: "javascript:alert(1)" },
      }),
    ).toBeNull();
  });
  it("retourne uniquement un lien https explicitement configuré", () => {
    expect(
      resolveShoppingLink("speaker", {
        speaker: { merchant: "Partenaire", url: "https://example.com/speaker" },
      }),
    )?.toEqual({ merchant: "Partenaire", url: "https://example.com/speaker" });
  });
});
