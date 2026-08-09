import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Shield, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("krew-cookie-consent");
    if (!consent) {
      setIsOpen(true);
    } else {
      try {
        const parsed = JSON.parse(consent);
        applyConsent(parsed.analytics, parsed.marketing);
      } catch {
        setIsOpen(true);
      }
    }
  }, []);

  function applyConsent(allowAnalytics: boolean, allowMarketing: boolean) {
    // Dans Krew, nous bloquons les scripts tiers non-essentiels si non consentis.
    // Nous pouvons initialiser ou désactiver par exemple Google Analytics, Pixel Facebook etc.
    (window as any).krewAnalyticsAllowed = allowAnalytics;
    (window as any).krewMarketingAllowed = allowMarketing;

    if (allowAnalytics) {
      console.log("[RGPD] Cookies analytiques activés.");
    } else {
      console.log("[RGPD] Cookies analytiques désactivés.");
    }

    if (allowMarketing) {
      console.log("[RGPD] Cookies marketing activés.");
    } else {
      console.log("[RGPD] Cookies marketing désactivés.");
    }
  }

  function handleAcceptAll() {
    const consent = { essential: true, analytics: true, marketing: true, date: new Date().toISOString() };
    localStorage.setItem("krew-cookie-consent", JSON.stringify(consent));
    applyConsent(true, true);
    setIsOpen(false);
  }

  function handleRefuseAll() {
    const consent = { essential: true, analytics: false, marketing: false, date: new Date().toISOString() };
    localStorage.setItem("krew-cookie-consent", JSON.stringify(consent));
    applyConsent(false, false);
    setIsOpen(false);
  }

  function handleSaveCustom() {
    const consent = { essential: true, analytics, marketing, date: new Date().toISOString() };
    localStorage.setItem("krew-cookie-consent", JSON.stringify(consent));
    applyConsent(analytics, marketing);
    setIsOpen(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-elevated space-y-4">
        <header className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <Shield className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold text-sm">Respect de ta vie privée 🍪</h3>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Nous utilisons des cookies pour optimiser ton expérience, analyser notre trafic et te proposer des offres personnalisées d&apos;hébergements et de transports.
            </p>
          </div>
        </header>

        {showCustomize ? (
          <div className="space-y-3 py-2 border-t border-b border-border/60">
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold">Cookies essentiels (obligatoires)</p>
                <p className="text-muted-foreground leading-normal">Nécessaires à l&apos;authentification de ton compte et à la création sécurisée de voyages.</p>
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md shrink-0">Toujours actif</span>
            </div>

            <div className="flex items-start justify-between gap-3 text-xs pt-2">
              <div className="space-y-0.5">
                <p className="font-semibold">Mesures d&apos;audience (analytiques)</p>
                <p className="text-muted-foreground leading-normal">Nous aident à comprendre comment Krew est utilisé pour constamment l&apos;améliorer.</p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 cursor-pointer accent-primary"
              />
            </div>

            <div className="flex items-start justify-between gap-3 text-xs pt-2">
              <div className="space-y-0.5">
                <p className="font-semibold">Recommandations & Publicités</p>
                <p className="text-muted-foreground leading-normal">Te proposent de vrais établissements hôteliers et des activités en phase avec tes recherches réelles.</p>
              </div>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 cursor-pointer accent-primary"
              />
            </div>
          </div>
        ) : null}

        <footer className="flex flex-col gap-2 pt-1">
          {showCustomize ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-1/2 text-xs" onClick={() => setShowCustomize(false)}>
                Retour
              </Button>
              <Button variant="hero" size="sm" className="w-1/2 text-xs" onClick={handleSaveCustom}>
                Enregistrer mes choix
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="w-1/2 text-xs" onClick={handleRefuseAll}>
                  Tout refuser
                </Button>
                <Button variant="hero" size="sm" className="w-1/2 text-xs" onClick={handleAcceptAll}>
                  Tout accepter
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 mt-1 font-medium"
              >
                <Settings className="size-3" />
                Personnaliser mes choix de cookies
              </button>
            </>
          )}
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            En naviguant sur Krew, tu acceptes notre{" "}
            <a href="/confidentialite" className="underline hover:text-primary">politique de confidentialité</a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
