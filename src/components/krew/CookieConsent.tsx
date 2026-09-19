import { useEffect, useState } from "react";
import { Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConsentCategory =
  | "analytics"
  | "personalization"
  | "advertising"
  | "retargeting"
  | "social"
  | "affiliate";

type CookieConsentState = {
  essential: true;
  analytics: boolean;
  personalization: boolean;
  advertising: boolean;
  retargeting: boolean;
  social: boolean;
  affiliate: boolean;
  date: string;
  version: 1;
};

const STORAGE_KEY = "krew-cookie-consent";
const CONSENT_EVENT = "krew:cookie-consent-changed";
const OPEN_SETTINGS_EVENT = "krew:cookie-consent-open";
const CONSENT_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000;

export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

const OPTIONAL_CATEGORIES: ConsentCategory[] = [
  "analytics",
  "personalization",
  "advertising",
  "retargeting",
  "social",
  "affiliate",
];

function applyConsent(consent: Pick<CookieConsentState, ConsentCategory>) {
  window.dispatchEvent(
    new CustomEvent(CONSENT_EVENT, {
      detail: consent,
    }),
  );
}

function emptyOptionalConsent(): Pick<CookieConsentState, ConsentCategory> {
  return {
    analytics: false,
    personalization: false,
    advertising: false,
    retargeting: false,
    social: false,
    affiliate: false,
  };
}

export function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [consent, setConsent] = useState(emptyOptionalConsent);

  useEffect(() => {
    const openSettings = () => {
      setShowCustomize(true);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, openSettings);

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsOpen(true);
      return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
    }

    try {
      const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
      const consentDate = parsed.date ? new Date(parsed.date).getTime() : Number.NaN;
      if (!Number.isFinite(consentDate) || Date.now() - consentDate > CONSENT_MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        setIsOpen(true);
        return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
      }
      const next = OPTIONAL_CATEGORIES.reduce(
        (result, category) => {
          result[category] = parsed[category] === true;
          return result;
        },
        {} as Pick<CookieConsentState, ConsentCategory>,
      );
      setConsent(next);
      applyConsent(next);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      setIsOpen(true);
    }

    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, openSettings);
  }, []);

  function saveConsent(next: Pick<CookieConsentState, ConsentCategory>) {
    const stored: CookieConsentState = {
      essential: true,
      ...next,
      date: new Date().toISOString(),
      version: 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setConsent(next);
    applyConsent(next);
    setIsOpen(false);
    setShowCustomize(false);
  }

  function updateCategory(category: ConsentCategory, value: boolean) {
    setConsent((current) => ({ ...current, [category]: value }));
  }

  if (!isOpen) return null;

  return (
    <div role="region" aria-label="Choix de cookies" className="fixed bottom-4 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 md:left-auto md:right-4 md:max-w-md">
      <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-2xs">
        <header className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Tes choix de cookies</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              KREW utilise des cookies nécessaires au fonctionnement du service et, avec ton accord,
              mesure les clics vers ses partenaires et liens d’affiliation.
            </p>
          </div>
        </header>

        {showCustomize ? (
          <div className="space-y-3 border-y border-border/60 py-3">
            <CategoryRow
              title="Cookies nécessaires"
              description="Authentification, sécurité, fonctionnement du service et mémorisation de tes choix."
              alwaysOn
            />
            <CategoryRow
              title="Partenaires & affiliation"
              description="Mesure des clics et conversions liés aux partenaires, à l'affiliation et à certains services externes."
              checked={consent.affiliate}
              onChange={(value) => updateCategory("affiliate", value)}
            />
          </div>
        ) : null}

        <footer className="flex flex-col gap-2 pt-1">
          {showCustomize ? (
            <div className="flex gap-2">
              <Button variant="outline" className="w-1/2 text-xs" onClick={() => setShowCustomize(false)}>
                Retour
              </Button>
              <Button className="w-1/2 text-xs font-medium" onClick={() => saveConsent(consent)}>
                Enregistrer mes choix
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="outline" className="w-1/2 text-xs" onClick={() => saveConsent(emptyOptionalConsent())}>
                  Tout refuser
                </Button>
                <Button
                  className="w-1/2 text-xs font-medium"
                  onClick={() => saveConsent({
                    ...emptyOptionalConsent(),
                    affiliate: true,
                  })}
                >
                  Tout accepter
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="mt-1 flex min-h-10 items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Settings className="size-4" />
                Personnaliser mes choix
              </button>
            </>
          )}
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Les cookies non essentiels ne sont pas activés avant ton choix.
          </p>
        </footer>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  alwaysOn = false,
  onChange,
}: {
  title: string;
  description: string;
  checked?: boolean;
  alwaysOn?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border/40 pt-3 first:border-t-0 first:pt-0 text-xs">
      <div className="space-y-0.5">
        <p className="font-semibold">{title}</p>
        <p className="leading-normal text-muted-foreground">{description}</p>
      </div>
      {alwaysOn ? (
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-bold uppercase text-muted-foreground">
          Toujours actifs
        </span>
      ) : (
        <input
          type="checkbox"
          checked={checked === true}
          onChange={(event) => onChange?.(event.target.checked)}
          className="mt-0.5 size-5 cursor-pointer accent-primary"
          aria-label={`Activer ${title}`}
        />
      )}
    </div>
  );
}
