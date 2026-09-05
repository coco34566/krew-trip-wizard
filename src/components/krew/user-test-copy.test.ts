import { describe, expect, it } from "vitest";

import { responseMissingCopy } from "./TripInvitePage";
import { planningLinkForSlot, planningTypeLabel } from "./TripPlanningPage";

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

  it("uses the proposed place name instead of a generic Maps fallback", () => {
    const link = planningLinkForSlot(
      {
        type: "resto",
        label: "Mar do Inferno",
        url: "https://www.google.com/maps/search/?api=1&query=D%C3%A9jeuner%20bord%20de%20mer",
        resourceKind: "maps",
        verified: false,
      },
      "Côte de Cascais & Sintra",
    );

    expect(link?.url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mar%20do%20Inferno%2C%20C%C3%B4te%20de%20Cascais%20%26%20Sintra",
    );
    expect(link?.label).toBe("Rechercher ce lieu →");
  });

  it("preserves a verified place link", () => {
    const link = planningLinkForSlot({
      type: "activite",
      label: "Cabo da Roca",
      url: "https://example.com/cabo-da-roca",
      resourceKind: "website",
      verified: true,
    });

    expect(link).toEqual({
      url: "https://example.com/cabo-da-roca",
      label: "Voir le lieu →",
    });
  });
});
