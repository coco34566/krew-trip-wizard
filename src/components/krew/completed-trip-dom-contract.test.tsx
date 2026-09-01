import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TripLifecycleProvider } from "@/lib/krew/trip-lifecycle-context";
import { PackingListCard } from "./PackingListCard";

describe("completed trip DOM contract", () => {
  it("does not render editable packing controls in historical mode", () => {
    const html = renderToStaticMarkup(
      <TripLifecycleProvider lifecycle="completed">
        <PackingListCard
          tripId="historical-trip"
          participants={[]}
          activities={[]}
          durationDays={2}
        />
      </TripLifecycleProvider>,
    );

    expect(html).not.toContain("Ajouter un élément");
    expect(html).not.toContain("À répartir dans les tâches");
    expect(html).not.toContain("aria-label=\"Assigner");
    expect(html).not.toContain("aria-label=\"Cocher");
    expect(html).toContain("Souvenir du voyage");
    expect(html).toContain("La liste du voyage, conservée avec son dernier état.");
  });
});