import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import appCss from "../styles.css?url";
import reviewCss from "../krew-ux-review.css?url";
import reviewDetailsCss from "../krew-ux-review-details.css?url";
import journeyPagesCss from "../krew-journey-pages.css?url";
import journeyPagesPolishCss from "../krew-journey-pages-polish.css?url";
import journeyPagesRefinementCss from "../krew-journey-pages-refinement.css?url";
import journeyPagesRefinementWavefixCss from "../krew-journey-pages-refinement-wavefix.css?url";
import visualBaselineCss from "../krew-visual-baseline.css?url";
import journeyAlignmentCss from "../krew-journey-alignment.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CookieConsent } from "@/components/krew/CookieConsent";
import { KrewJourneyPageHeader } from "@/components/krew/KrewJourneyPageHeader";
import { KrewJourneyStatusPanel } from "@/components/krew/KrewJourneyStatusPanel";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">La page que tu recherches n’existe pas ou a été déplacée.</p>
        <div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Retour à l’accueil</Link></div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center">
      <h1 className="font-display text-3xl font-bold text-foreground">Cette page n’a pas pu être chargée</h1>
      <p className="mt-2 text-sm text-muted-foreground">Une erreur est survenue. Tu peux réessayer ou revenir à l’accueil.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2"><button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Réessayer</button><a href="/" className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent">Retour à l’accueil</a></div>
    </div></div>
  );
}

const LOCKED_JOURNEY_SECTIONS = {
  destination: {
    title: "Destination",
    otter: "/brand/otter-states/destination.png",
    description: "Les destinations seront proposées à partir du Profil du voyage et des envies du groupe.",
    requirement: "Choisis d’abord le Profil du voyage pour débloquer les destinations.",
    realSelector: "#hub-destination > div.flex.flex-wrap.items-end.justify-between",
    actionSection: "profile",
    actionLabel: "Choisir le Profil du voyage",
  },
  accommodation: {
    title: "Hébergement",
    otter: "/brand/otter-states/accommodation.png",
    description: "Les hébergements seront proposés une fois la destination du groupe choisie.",
    requirement: "Choisis d’abord la destination pour débloquer cette étape.",
    realSelector: "#hub-logistics",
    actionSection: "destination",
    actionLabel: "Voir la destination",
  },
} as const;

type LockedJourneySection = keyof typeof LOCKED_JOURNEY_SECTIONS;

function getCachedTripName(queryClient: QueryClient, tripId: string | null) {
  if (!tripId) return null;
  const candidates = [
    queryClient.getQueryData<any>(["trip", tripId]),
    queryClient.getQueryData<any>(["trip-availability", tripId]),
    queryClient.getQueryData<any>(["star-prefs", tripId]),
  ];
  for (const candidate of candidates) {
    const name = candidate?.trip?.name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function JourneyChapterDomMetadata({ queryClient }: { queryClient: QueryClient }) {
  const location = useRouterState({ select: (state) => state.location });

  useEffect(() => {
    const match = location.pathname.match(/^\/trips\/([^/]+)/);
    const tripId = match?.[1] ?? null;
    if (!tripId) return;

    let frame = 0;
    let observer: MutationObserver | null = null;

    const sync = () => {
      const tripName = getCachedTripName(queryClient, tripId);
      if (!tripName) return;
      document
        .querySelectorAll<HTMLElement>("#hub-destination,#hub-logistics")
        .forEach((section) => section.setAttribute("data-krew-trip-name", tripName));
    };

    frame = window.requestAnimationFrame(() => {
      sync();
      observer = new MutationObserver(sync);
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [location.href, location.pathname, queryClient]);

  return null;
}

function JourneyLockedFallbackPortal({ queryClient }: { queryClient: QueryClient }) {
  const location = useRouterState({ select: (state) => state.location });
  const [host, setHost] = useState<HTMLElement | null>(null);

  const section = (location.search as Record<string, unknown> | undefined)?.section;
  const lockedSection = typeof section === "string" && section in LOCKED_JOURNEY_SECTIONS
    ? (section as LockedJourneySection)
    : null;
  const config = lockedSection ? LOCKED_JOURNEY_SECTIONS[lockedSection] : null;
  const isTripJourneyRoute = /^\/trips\/[^/]+\/?$/.test(location.pathname);
  const tripId = location.pathname.match(/^\/trips\/([^/]+)/)?.[1] ?? null;
  const tripName = getCachedTripName(queryClient, tripId) ?? "Voyage";

  useEffect(() => {
    if (!config || !lockedSection || !isTripJourneyRoute) {
      setHost(null);
      return;
    }

    let frame = 0;
    let observer: MutationObserver | null = null;

    const sync = () => {
      const realChapter = document.querySelector(config.realSelector);
      const journeyWrapper = document.querySelector<HTMLElement>("main.max-w-5xl > div.space-y-6");
      setHost(!realChapter && journeyWrapper ? journeyWrapper : null);
    };

    frame = window.requestAnimationFrame(() => {
      sync();
      observer = new MutationObserver(sync);
      observer.observe(document.body, { childList: true, subtree: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [config, lockedSection, isTripJourneyRoute, location.href]);

  if (!host || !config || !lockedSection || !isTripJourneyRoute || !tripId) return null;

  const actionHref = config.actionSection === "profile"
    ? `/trips/${tripId}/profile`
    : `/trips/${tripId}?view=voyage&section=${config.actionSection}`;

  return createPortal(
    <section data-journey-locked-state={lockedSection} className="mt-8 space-y-8">
      <KrewJourneyPageHeader tripName={tripName} title={config.title} otterSrc={config.otter}>
        <p>{config.description}</p>
      </KrewJourneyPageHeader>
      <KrewJourneyStatusPanel
        title="Étape à débloquer"
        icon="attention"
        tone="locked"
        action={
          <a
            href={actionHref}
            className="inline-flex min-h-10 items-center text-[14px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            {config.actionLabel}
          </a>
        }
      >
        <p>{config.requirement}</p>
      </KrewJourneyStatusPanel>
    </section>,
    host,
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KREW — Organise simplement tes voyages de groupe" },
      { name: "description", content: "EVG, EVJF, week-end entre amis : KREW réunit les disponibilités et les préférences du groupe pour t’aider à organiser le voyage." },
      { name: "author", content: "KREW" }, { property: "og:title", content: "KREW — Organise simplement tes voyages de groupe" },
      { property: "og:description", content: "EVG, EVJF, week-end entre amis : KREW réunit les disponibilités et les préférences du groupe pour t’aider à organiser le voyage." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: reviewCss },
      { rel: "stylesheet", href: reviewDetailsCss },
      { rel: "stylesheet", href: journeyPagesCss },
      { rel: "stylesheet", href: journeyPagesPolishCss },
      { rel: "stylesheet", href: journeyPagesRefinementCss },
      { rel: "stylesheet", href: journeyPagesRefinementWavefixCss },
      { rel: "stylesheet", href: visualBaselineCss },
      { rel: "stylesheet", href: journeyAlignmentCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Kalam:wght@400;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" },
      { rel: "icon", href: "/brand/favicon-32x32.png?v=2", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/brand/favicon-16x16.png?v=2", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/brand/apple-touch-icon.png?v=2", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell, component: RootComponent, notFoundComponent: NotFoundComponent, errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) { return <html lang="fr"><head><HeadContent /></head><body>{children}<Scripts /></body></html>; }
function RootComponent() {
  const { queryClient } = Route.useRouteContext(); const router = useRouter();
  useEffect(() => { const { data } = supabase.auth.onAuthStateChange((event) => { if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return; router.invalidate(); if (event !== "SIGNED_OUT") queryClient.invalidateQueries(); }); return () => data.subscription.unsubscribe(); }, [router, queryClient]);
  return <QueryClientProvider client={queryClient}><Outlet /><JourneyChapterDomMetadata queryClient={queryClient} /><JourneyLockedFallbackPortal queryClient={queryClient} /><CookieConsent /><Toaster position="top-center" richColors /></QueryClientProvider>;
}
