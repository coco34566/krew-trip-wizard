import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("trip hard-delete permissions contract", () => {
  it("keeps permanent trip deletion owner-only at the application boundary", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/trips.functions.ts"),
      "utf8",
    );

    const cancelStart = source.indexOf("export const cancelTrip");
    expect(cancelStart).toBeGreaterThanOrEqual(0);

    const cancelSection = source.slice(cancelStart, cancelStart + 3500);
    const hardDeleteStart = cancelSection.indexOf("if (data.hardDelete)");
    const ownerGuard = cancelSection.indexOf("trip.data.owner_id !== userId");
    const forbidden = cancelSection.indexOf(
      "403 Forbidden: seul l'organisateur initial peut supprimer le voyage",
    );
    const deleteCall = cancelSection.indexOf('.from("trips").delete()');

    expect(hardDeleteStart).toBeGreaterThanOrEqual(0);
    expect(ownerGuard).toBeGreaterThan(hardDeleteStart);
    expect(forbidden).toBeGreaterThan(ownerGuard);
    expect(deleteCall).toBeGreaterThan(forbidden);
  });
});
