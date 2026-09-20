import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("trip hard-delete permissions contract", () => {
  it("keeps permanent trip deletion owner-only at the application boundary", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/trip-cancel-owner.functions.ts"),
      "utf8",
    );

    const cancelStart = source.indexOf("export const cancelTripOwnerOnly");
    expect(cancelStart).toBeGreaterThanOrEqual(0);

    const cancelSection = source.slice(cancelStart, cancelStart + 3500);
    const ownerGuard = cancelSection.indexOf(
      "if (!canArchiveTrip(trip.data, userId))",
    );
    const forbidden = cancelSection.indexOf(
      "403 Forbidden: seul l'organisateur initial peut supprimer le voyage",
    );
    const hardDeleteStart = cancelSection.indexOf("if (data.hardDelete)");
    const deleteCall = cancelSection.indexOf('.from("trips").delete()');

    expect(ownerGuard).toBeGreaterThanOrEqual(0);
    expect(forbidden).toBeGreaterThan(ownerGuard);
    expect(hardDeleteStart).toBeGreaterThan(forbidden);
    expect(deleteCall).toBeGreaterThan(hardDeleteStart);
  });
});
