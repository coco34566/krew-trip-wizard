import { useEffect, useState } from "react";
import { Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type CookieConsentState = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  date: string;
};

const STORAGE_KEY = "krew-cookie-consent";

function applyConsent(consent: Pick<CookieConsentState, "analytics" | "marketing">) {
  // Consent state is exposed for integrations to read before loading non-essential scripts.
  // No non-essential third-party tracker is loaded by this component itself.
  window.dispatchEvent(
    new CustomEvent("krew:cookie-consent-changed", {
      detail: consent,
    }),
  );
}

export function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsOpen(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
      const next = {
        analytics: parsed.analytics === true,
        marketing: parsed.marketing === true,
      };
      setAnalytics(next.analytics);
      setMarketing(next.marketing);
      applyConsent(next);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setIsOpen(true);
    }
  }, []);

  function saveConsent(next: Pick<CookieConsentState, "analytics" | "marketing">) {
    const consent: CookieConsentState = {
      essential: true,
      ...next,
      date: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    applyConsent(next);
    setIsOpen(false);
    setShowCustomize(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 md:left-auto md:right-4 md:max-w-md">
      <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-elevated">
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Tes préférences de cookies</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Krew utilise des traceurs nécessaires au fonctionnement du service. Les traceurs
              non essentiels ne sont activés qu&apos;après ton accord.
            </p>
          </div>
        </header>

        {showCustomize ? (
          <div className="space-y-3 border-y border-border/60 py-3">
            <div className="flex items-start justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold">Traceurs essentiels</p>
                <p className="leading-normal text-muted-foreground">
                  Authentification, sécurité et mémorisation de tes choix. Ils sont nécessaires au
                  fonctionnement du service.
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                Toujours actifs
              </span>
            </div>

            <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-border/40 pt-3 text-xs">
              <span className="space-y-0.5">
                <span className="block font-semibold">Mesure d&apos;audience</span>
                <span className="block leading-normal text-muted-foreground">
                  Permet de comprendre l&apos;utilisation de Krew et d&apos;améliorer le service.
                </span>
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 cursor-pointer accent-primary"
              />
            </label>

            <label className="flex cursor-pointer items-start justify-between gap-3 border-t border-border/40 pt-3 text-xs">
              <span className="space-y-0.5">
                <span className="block font-semibold">Publicité et personnalisation</span>
                <span className="block leading-normal text-muted-foreground">
                  Permettrait à Krew d&apos;utiliser des traceurs publicitaires ou de personnalisation
                  si de tels services sont activés ultérieurement.
                </span>
              </span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-1 cursor-pointer accent-primary"
              />
            </label>
          </div>
        ) : null}

        <footer className="flex flex-col gap-2 pt-1">
          {showCustomize ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-1/2 text-xs" onClick={() => setShowCustomize(false)}>
                Retour
              </Button>
              <Button variant="hero" size="sm" className="w-1/2 text-xs" onClick={() => saveConsent({ analytics, marketing })}>
                Enregistrer mes choix
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="w-1/2 text-xs" onClick={() => saveConsent({ analytics: false, marketing: false })}>
                  Tout refuser
                </Button>
                <Button variant="hero" size="sm" className="w-1/2 text-xs" onClick={() => saveConsent({ analytics: true, marketing: true })}>
                  Tout accepter
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Settings className="size-3" />
                Personnaliser mes choix
              </button>
            </>
          )}
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            Les traceurs non essentiels ne sont pas activés avant ton choix. Tu peux modifier tes
            préférences à tout moment depuis la gestion des cookies.
          </p>
        </footer>
      </div>
    </div>
  );
}
