import { describe, expect, it } from "vitest";

import { responseMissingCopy } from "./TripInvitePage";
import { planningTypeLabel } from "./TripPlanningPage";

describe("user-test copy helpers", () => {
  it("keeps availability and preference gaps explicit when they differ", () => {
    expect(responseMissingCopy(2, 1)).toBe("2 disponibilités et 1 préférence manquent encore.");
    expect(responseMissingCopy(1, 0)).toBe("1 disponibilité manque encore.");
    expect(responseMissingCopy(0, 2)).toBe("2 préférences manquent encore.");
  });

  it("formats technical planning slot types for users", () => {
    expect(planningTypeLabel("activite")).toBe("Activité");
    expect(planningTypeLabel("resto")).toBe("Restaurant");
    expect(planningTypeLabel("libre")).toBe("Temps libre");
  });
});
