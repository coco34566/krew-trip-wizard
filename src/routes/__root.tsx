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
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/krew/CookieConsent";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
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
  profile: {
    title: "Profil du voyage",
    otter: "/brand/otter-states/preferences.png",
    description: "Le profil du groupe se construira à partir des réponses de chacun.",
    requirement: "Il se débloquera quand les préférences nécessaires du groupe auront été renseignées.",
    realSelector: "#hub-profile",
  },
  accommodation: {
    title: "Hébergement",
    otter: "/brand/otter-states/accommodation.png",
    description: "Les logements seront proposés une fois la destination du groupe choisie.",
    requirement: "Choisis d’abord la destination pour débloquer cette étape.",
    realSelector: "#hub-logistics",
  },
  planning: {
    title: "Planning",
    otter: "/brand/otter-states/planning.png",
    description: "KREW construira le programme à partir de la destination et des choix du groupe.",
    requirement: "Valide d’abord la destination pour débloquer le planning.",
    realSelector: "#hub-activities-plan",
  },
  tasks: {
    title: "Tâches",
    otter: "/brand/otter-states/trip-preparation.png",
    description: "La répartition des tâches apparaîtra quand le voyage aura suffisamment avancé.",
    requirement: "Choisis d’abord la destination pour débloquer l’organisation du groupe.",
    realSelector: "#hub-tasks-org",
  },
} as const;

type LockedJourneySection = keyof typeof LOCKED_JOURNEY_SECTIONS;

function JourneyLockedFallbackPortal() {
  const location = useRouterState({ select: (state) => state.location });
  const [host, setHost] = useState<HTMLElement | null>(null);

  const section = (location.search as Record<string, unknown> | undefined)?.section;
  const lockedSection = typeof section === "string" && section in LOCKED_JOURNEY_SECTIONS
    ? (section as LockedJourneySection)
    : null;
  const config = lockedSection ? LOCKED_JOURNEY_SECTIONS[lockedSection] : null;
  const isTripJourneyRoute = /^\/trips\/[^/]+\/?$/.test(location.pathname);

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

  if (!host || !config || !lockedSection || !isTripJourneyRoute) return null;

  return createPortal(
    <section
      data-journey-locked-section={lockedSection}
      aria-labelledby={`locked-${lockedSection}-title`}
      className="relative mt-6 overflow-hidden rounded-[24px] border border-sage/25 bg-sage/[0.045] px-6 py-7 sm:mt-8 sm:px-8 sm:py-8"
    >
      <img
        src={config.otter}
        alt=""
        className="pointer-events-none absolute right-5 top-5 w-[80px] h-auto object-contain opacity-90 sm:right-7 sm:top-7 sm:w-[96px] lg:w-[104px]"
      />
      <div className="max-w-[640px] pr-[92px] sm:pr-[120px]">
        <p className="font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-primary/75 sm:text-sm">
          Étape verrouillée
        </p>
        <div className="relative mt-2 inline-block pb-2">
          <h2
            id={`locked-${lockedSection}-title`}
            className="font-display text-[40px] font-normal leading-[0.98] tracking-[-0.02em] text-foreground/80 sm:text-[52px] lg:text-[60px]"
          >
            {config.title}
          </h2>
          <KrewMark
            type="underline-wave"
            tone="sage"
            size="md"
            className="absolute left-1 -bottom-1 pointer-events-none opacity-65"
          />
        </div>
        <p className="mt-5 max-w-[540px] text-[18px] leading-[1.5] text-muted-foreground sm:text-[20px]">
          {config.description}
        </p>
        <div className="mt-6 max-w-[520px] rounded-[20px] border border-sage/25 bg-background/80 px-5 py-4 text-[16px] leading-[1.5] text-muted-foreground sm:text-[17px]">
          {config.requirement}
        </div>
      </div>
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" },
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
  return <QueryClientProvider client={queryClient}><Outlet /><JourneyLockedFallbackPortal /><CookieConsent /><Toaster position="top-center" richColors /></QueryClientProvider>;
}