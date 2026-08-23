import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/kiwi-test")({
  component: KiwiTravelpayoutsTestPage,
});

function KiwiTravelpayoutsTestPage() {
  const partnerId = import.meta.env.VITE_TRAVELPAYOUTS_PARTNER_ID as string | undefined;
  const kiwiDeepLink = "https://www.kiwi.com/deep?from=PAR&to=LIS&departure=2026-09-18&return=2026-09-21";
  const affiliateUrl = partnerId
    ? `https://c111.travelpayouts.com/click?shmarker=${encodeURIComponent(`${partnerId}.krew-kiwi-test`)}&promo_id=3791&source_type=customlink&type=click&custom_url=${encodeURIComponent(kiwiDeepLink)}`
    : null;

  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Test Kiwi × Travelpayouts</h1>
        <p className="text-sm text-muted-foreground">
          Test isolé : Paris (PAR) → Lisbonne (LIS), 18 → 21 septembre 2026.
        </p>
      </div>

      {affiliateUrl ? (
        <Button asChild>
          <a href={affiliateUrl} target="_blank" rel="noopener noreferrer">
            Ouvrir la recherche Kiwi affiliée
          </a>
        </Button>
      ) : (
        <p className="text-sm text-destructive">
          Variable VITE_TRAVELPAYOUTS_PARTNER_ID absente de ce déploiement.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Ce test ne modifie ni le moteur transport ni les liens existants de KREW.
      </p>
    </main>
  );
}
