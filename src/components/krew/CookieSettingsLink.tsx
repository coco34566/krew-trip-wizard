import { openCookieSettings } from "@/components/krew/CookieConsent";

export function CookieSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={`transition hover:text-foreground ${className}`}
    >
      Gérer mes cookies
    </button>
  );
}
