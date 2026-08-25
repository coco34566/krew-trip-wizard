import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";

import { recordAffiliateClick } from "@/lib/affiliate.functions";

const CONSENT_STORAGE_KEY = "krew-cookie-consent";

type AffiliateProvider = "kiwi" | "getyourguide" | "booking" | "kayak" | "omio";

function hasAffiliateConsent(): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { affiliate?: boolean };
    return parsed.affiliate === true;
  } catch {
    return false;
  }
}

function inferProvider(url: URL): AffiliateProvider | null {
  const host = url.hostname.toLowerCase();
  if (host === "c111.travelpayouts.com" || host.endsWith(".kiwi.com") || host === "kiwi.com") return "kiwi";
  if (host.includes("getyourguide.")) return "getyourguide";
  if (host.includes("booking.com")) return "booking";
  if (host.includes("kayak.")) return "kayak";
  if (host.includes("omio.")) return "omio";
  return null;
}

function currentTripId(): string | null {
  const match = window.location.pathname.match(/\/trips\/([0-9a-f-]{36})(?:\/|$)/i);
  return match?.[1] ?? null;
}

function currentSource(): string {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section) return section.slice(0, 64);

  const path = window.location.pathname;
  if (path.endsWith("/recap")) return "recap";
  if (path.endsWith("/memories")) return "memories";
  if (path.endsWith("/availability")) return "availability";
  if (path.endsWith("/questionnaire")) return "preferences";
  return "trip";
}

/**
 * Captures outbound partner clicks once for the authenticated app.
 * Tracking is deliberately disabled until the user accepts the "affiliate"
 * consent category. Navigation is never delayed by analytics.
 */
export function AffiliateClickTracker() {
  const recordClick = useServerFn(recordAffiliateClick);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!hasAffiliateConsent()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.origin === window.location.origin) return;

      const provider = inferProvider(url);
      if (!provider) return;
      const tripId = currentTripId();
      if (!tripId) return;

      void recordClick({
        data: {
          tripId,
          provider,
          source: currentSource(),
          targetUrl: url.toString(),
          offerId: anchor.dataset.affiliateOfferId || undefined,
        },
      }).catch(() => {
        // Measurement must never interfere with the booking/navigation flow.
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [recordClick]);

  return null;
}
