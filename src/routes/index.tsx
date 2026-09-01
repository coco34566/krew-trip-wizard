import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import heroImage from "@/assets/hero-krew.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon, type KrewIconName } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewHighlight, KrewOrganicBlob } from "@/components/krew/visual-language";
import { KrewNote } from "@/components/krew/visual-language/KrewNote";
import { EVENT_TYPES } from "@/lib/krew/constants";
import "@/styles/krew-motion.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KREW — Organise simplement tes voyages de groupe" },
      {
        name: "description",
        content:
          "EVG, EVJF, week-end entre amis : KREW réunit les disponibilités et les préférences du groupe pour t’aider à organiser le voyage.",
      },
      { property: "og:title", content: "KREW — Organise simplement tes voyages de groupe" },
      {
        property: "og:description",
        content:
          "Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à organiser le séjour, étape par étape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS: { iconName: KrewIconName; number: string; title: string; text: string }[] = [
  { iconName: "group", number: "01", title: "Crée ton voyage", text: "Renseigne l’essentiel et invite le groupe." },
  { iconName: "calendar", number: "02", title: "Chacun répond", text: "Disponibilités, budget et envies : chacun complète ses informations." },
  { iconName: "planning", number: "03", title: "KREW propose", text: "Dates, destinations, hébergements et trajets adaptés aux vraies contraintes du groupe." },
];

const TRUST = ["Sans prise de tête", "Décision en groupe", "Budget clair dès le départ"];

const IDEAL_FOR_TYPES = EVENT_TYPES.filter((ev) =>
  ["evg", "evjf", "weekend", "anniversaire"].includes(ev.value),
);

function useLandingReveal() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".krew-reveal, .krew-hero-scene"));
    if (reduced) {
      nodes.forEach((node) => node.setAttribute("data-revealed", "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          (entry.target as HTMLElement).setAttribute("data-revealed", entry.isIntersecting ? "true" : "false");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function Landing() {
  useLandingReveal();

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary">
      <SiteHeader />
      <main>
        <section className="krew-hero-scene relative overflow-hidden bg-background py-8 sm:py-10 lg:py-12">
          <KrewOrganicBlob tone="sage" variant="soft" className="absolute -top-12 -left-12 w-[350px] sm:w-[500px] h-[300px] sm:h-[400px] opacity-40 pointer-events-none z-0" />
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">
              <div className="krew-hero-copy lg:col-span-7 space-y-4 sm:space-y-5">
                <div className="relative">
                  <h1 className="font-display text-[42px] sm:text-[64px] lg:text-[78px] font-normal tracking-tight text-foreground leading-[0.94]">
                    Tout commence par{" "}<span className="italic text-primary block sm:inline">une envie de partir.</span>
                  </h1>
                  <KrewMark type="underline-wave" tone="sage" size="lg" className="krew-hero-mark mt-1 w-[180px] sm:w-[260px] h-[10px] opacity-90 pointer-events-none" />
                </div>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                  KREW aide le groupe à se mettre d’accord et transforme les réponses en un voyage concret.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2 relative">
                  <Button asChild size="xl" className="krew-hero-cta h-10 min-h-10 rounded-xl px-7 py-0 text-sm sm:text-base font-medium leading-none shadow-none">
                    <Link to="/trips/new" className="inline-flex h-full items-center justify-center whitespace-nowrap text-center leading-none">Créer mon voyage</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="h-10 rounded-xl px-5 text-muted-foreground hover:text-foreground">
                    <Link to="/auth" search={{}}>Se connecter</Link>
                  </Button>
                </div>
                <ul className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground">
                  {TRUST.map((t) => (
                    <li key={t} className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                      <KrewMark type="check" tone="plum" size="sm" className="size-4 shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="krew-hero-media lg:col-span-5 relative">
                <KrewOrganicBlob tone="plum" variant="sweep" className="absolute -bottom-6 -right-6 w-[200px] h-[160px] opacity-20 pointer-events-none z-0" />
                <div className="krew-hero-photo-settle relative z-10 overflow-hidden rounded-[24px] lg:rounded-l-[36px] shadow-sm aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/5] w-full">
                  <img src={heroImage} alt="Groupe d'amis en voyage" className="h-full w-full object-cover object-center" fetchPriority="high" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                  <div className="krew-hero-postit-settle absolute top-4 right-3 sm:top-5 sm:right-4 z-20 pointer-events-none">
                    <KrewNote variant="sticky" tone="sage" rotation={7} size="sm" className="w-fit max-w-[125px] text-xs sm:text-sm text-center">
                      Le plan prend forme ici
                    </KrewNote>
                  </div>
                  <div className="absolute bottom-5 left-5 right-5 text-white text-right"><p className="krew-hero-slogan font-display text-xl sm:text-2xl font-normal leading-tight">La team. Le plan. Le moment.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-sage/12 border-y border-border/60 py-3.5 sm:py-4">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 flex flex-wrap items-center justify-center sm:justify-start gap-y-2 gap-x-4 text-sm">
            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono shrink-0">Idéal pour</span>
            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-0 gap-y-2">
              {IDEAL_FOR_TYPES.map((ev, index) => (
                <div key={ev.value} className={`flex items-center ${index > 0 ? "sm:border-l sm:border-border/60 sm:pl-4 sm:ml-4" : ""}`}>
                  <Link to="/trips/new" className="text-xs sm:text-sm font-semibold text-foreground/90 transition hover:text-primary whitespace-nowrap">{ev.label}</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="krew-plan-scene relative overflow-hidden py-12 sm:py-16 lg:py-20 bg-background">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative">
            <div className="krew-reveal krew-scene-heading flex items-start justify-between gap-4 mb-8 sm:mb-12">
              <div className="space-y-0.5 min-w-0">
                <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">LE PLAN</span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono">Comment ça marche</p>
                <h2 className="relative inline-block font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground leading-tight tracking-tight mt-0.5">
                  KREW croise les réponses. Le groupe n’a plus qu’à choisir.
                  <KrewMark type="underline-wave" tone="sage" size="md" className="krew-draw-mark mt-1 w-[180px] sm:w-[240px] opacity-80 pointer-events-none" />
                </h2>
              </div>
              <img src="/brand/otter-states/trip-progress.png" alt="Loutre KREW organisation" className="krew-scene-otter w-[76px] sm:w-[94px] h-auto object-contain shrink-0 filter drop-shadow-xs mt-0.5" />
            </div>
            <div className="krew-plan-track relative grid gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-7">
              <KrewMark type="route" tone="sage" size="lg" className="krew-plan-route krew-draw-mark pointer-events-none absolute hidden lg:block" />
              {STEPS.map((step, index) => (
                <article key={step.number} className={`krew-reveal krew-plan-step krew-plan-step-${index + 1} relative flex items-start gap-4 sm:gap-5 lg:block`}>
                  <div className="flex items-center gap-3 shrink-0 lg:mb-4">
                    <span aria-hidden="true" className="font-display text-6xl sm:text-7xl font-normal text-secondary/60 leading-none select-none tracking-tight">{step.number}</span>
                    <div className="flex size-11 sm:size-12 items-center justify-center rounded-[18px] bg-primary/10 text-primary shrink-0"><KrewIcon name={step.iconName} tone="plum" size="sm" className="size-5" /></div>
                  </div>
                  <div className="space-y-1 min-w-0 lg:pl-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary block">Étape {step.number}</span>
                    <h3 className="font-display text-[24px] sm:text-[28px] font-normal text-foreground leading-none">{step.title}</h3>
                    <p className="max-w-[310px] text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="krew-moment-scene w-full bg-sage/15 py-12 sm:py-16 lg:py-20 relative overflow-hidden border-y border-border/50">
          <KrewOrganicBlob tone="plum" variant="soft" className="absolute top-0 right-0 w-[400px] h-[300px] opacity-15 pointer-events-none z-0" />
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
            <div className="krew-reveal krew-scene-heading flex items-start justify-between gap-4 mb-8 sm:mb-10">
              <div className="min-w-0">
                <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">LE MOMENT</span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono mt-0.5">L&apos;expérience du groupe</p>
                <h2 className="mt-1 font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground">Une fois décidé, il ne reste plus qu’à partir.</h2>
                <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg font-sans">Planning, arrivées, tâches, choses à prendre : tout le groupe sait ce qui se passe sans devoir remonter six semaines de messages.</p>
              </div>
              <img src="/brand/otter-states/planning.png" alt="Loutre KREW planning" className="krew-scene-otter w-[76px] sm:w-[92px] h-auto object-contain shrink-0 filter drop-shadow-xs mt-0.5" />
            </div>
            <div className="krew-moment-stage grid lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              <div className="krew-reveal krew-moment-photo-wrap lg:col-span-5 relative">
                <div className="krew-moment-postit absolute -top-3 left-1 z-20 pointer-events-none"><KrewNote variant="tape" tone="sage" rotation={-3} className="text-xs font-handwriting py-1 px-2.5 min-w-0 max-w-[120px]">Option coup de cœur</KrewNote></div>
                <div className="krew-moment-photo relative rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/5] shadow-xs border border-border/40">
                  <img src="/images/trip-types/weekend.png" alt="Week-end entre amis" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white"><span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full">Week-end entre amis</span><p className="font-display text-lg sm:text-2xl font-normal mt-1 leading-snug">Lisbonne · 8 personnes</p></div>
                </div>
              </div>
              <div className="krew-moment-stack lg:col-span-7 relative lg:-ml-10">
                <div className="krew-reveal krew-moment-card relative p-4 sm:p-5 lg:p-6 rounded-[22px] bg-background border border-border/60 shadow-[0_18px_50px_-34px_rgba(42,25,37,.42)]">
                  <div className="krew-moment-validated absolute -top-4 right-3 z-20 hidden sm:block pointer-events-none"><KrewNote variant="sticky" tone="cream" rotation={3} className="text-xs font-handwriting py-1 px-2.5 min-w-0 max-w-[130px]">Validé par le groupe</KrewNote></div>
                  <div className="krew-reveal krew-moment-group flex flex-wrap items-center justify-between gap-4">
                    <div><span className="text-xs font-semibold uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-md text-primary font-mono">Exemple de voyage organisé</span><h3 className="font-display text-2xl sm:text-3xl font-normal text-foreground mt-1">Retrouvailles à Lisbonne</h3><p className="text-xs sm:text-sm text-muted-foreground">Organisé par Thomas · 8 participants</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider font-mono">Budget / personne</p><KrewHighlight tone="sage" className="font-mono text-2xl sm:text-3xl font-bold text-primary mt-1 inline-block px-3 py-1">~360 €</KrewHighlight></div>
                  </div>
                  <div className="krew-reveal krew-moment-group mt-4 border-t border-border/50 pt-3"><p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider font-mono">Dates choisies</p><p className="text-xs sm:text-sm font-medium text-foreground mt-0.5">Vendredi 11 Sept. → Dimanche 13 Sept.</p></div>
                  <div className="krew-reveal krew-moment-group mt-3 border-t border-border/50 pt-3 space-y-1"><p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">État des réponses</p><div className="flex flex-wrap gap-4 text-xs pt-1"><span className="inline-flex items-center gap-1.5"><KrewIcon name="availability" tone="sage" size="sm" className="size-4" /><span>Disponibilités : </span><span className="font-mono font-semibold text-primary">8/8</span></span><span className="inline-flex items-center gap-1.5"><KrewIcon name="preferences" tone="sage" size="sm" className="size-4" /><span>Préférences : </span><span className="font-mono font-semibold text-primary">8/8</span></span></div></div>
                  <div className="krew-reveal krew-moment-group mt-3 border-t border-border/50 pt-3 space-y-2"><h4 className="font-semibold text-xs sm:text-sm flex items-center gap-2 text-foreground"><KrewMark type="check" tone="sage" size="sm" className="size-4 shrink-0" />Hébergement retenu par le groupe</h4><div className="flex justify-between items-start gap-2"><div><p className="font-semibold text-foreground text-xs sm:text-sm">Lisbon Sky Apartments</p><p className="text-xs text-muted-foreground">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p></div><Badge variant="success" className="shrink-0 text-[10px]">5 votes sur 8</Badge></div><p className="text-xs text-muted-foreground font-mono">42 € / personne par nuit · 84 € / personne pour le séjour</p></div>
                  <div className="krew-reveal krew-moment-group mt-3 border-t border-border/50 pt-3 space-y-2 text-xs"><h4 className="font-semibold text-xs sm:text-sm flex items-center gap-2 text-foreground"><KrewMark type="check" tone="sage" size="sm" className="size-4 shrink-0" />Transports par ville de départ</h4><div className="flex justify-between border-b border-border/40 pb-1.5 text-muted-foreground"><span>Paris (5 personnes) · Vol EasyJet aller-retour</span><span className="font-mono font-semibold text-foreground">115 €</span></div><div className="flex justify-between text-muted-foreground"><span>Lyon (3 personnes) · Vol Transavia aller-retour</span><span className="font-mono font-semibold text-foreground">125 €</span></div></div>
                  <div className="krew-reveal krew-moment-group mt-3 border-t border-border/50 pt-3 space-y-2.5"><h4 className="font-semibold text-xs sm:text-sm flex items-center gap-2 text-foreground"><KrewMark type="check" tone="sage" size="sm" className="size-4 shrink-0" />Extrait du planning jour par jour</h4><div className="space-y-2 pt-0.5"><div className="relative pl-4 border-l-2 border-sage/40"><p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 15:30</p><p className="font-semibold text-xs mt-0.5 text-foreground">Arrivée à l&apos;aéroport de Lisbonne et transfert</p></div><div className="relative pl-4 border-l-2 border-sage/40"><p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 19:30</p><p className="font-semibold text-xs mt-0.5 text-foreground">Dîner de Tapas locales chez Ramiro</p></div><div className="relative pl-4 border-l-2 border-sage/40"><p className="text-xs font-mono font-semibold text-primary">JOUR 2 · 14:00</p><p className="font-semibold text-xs mt-0.5 text-foreground">Visite guidée en Tuk-Tuk électrique</p></div></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="krew-team-scene bg-background py-12 sm:py-16 lg:py-20 relative overflow-hidden">
          <KrewOrganicBlob tone="sage" variant="soft" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] opacity-20 pointer-events-none z-0" />
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
            <KrewMark type="sparkle" tone="sage" size="sm" className="absolute top-2 right-10 size-6 opacity-60 pointer-events-none" />
            <div className="krew-reveal krew-scene-heading max-w-xl text-center mx-auto mb-8 sm:mb-12"><span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">LA TEAM</span><p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono mt-0.5">Tout le voyage dans KREW</p><h2 className="mt-1 font-display text-3xl sm:text-4xl font-normal text-foreground relative inline-block">De l’idée au souvenir.<KrewMark type="underline-wave" tone="sage" size="md" className="krew-draw-mark mt-1 w-[140px] mx-auto opacity-80 pointer-events-none" /></h2><p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">KREW accompagne le groupe avant, pendant et après le voyage, sans compliquer ce qui doit rester simple.</p></div>
            <div className="krew-bento grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[178px]">
              <FeatureBlock className="krew-bento-cale sm:col-span-1 lg:col-span-2" iconName="destination" title="On se cale" text="Dispos, envies, budget, contraintes : chacun répond à son rythme." mark="pin-line" />
              <FeatureBlock className="krew-bento-choisit sm:col-span-1 lg:col-span-4 lg:row-span-2" iconName="vote" title="On choisit" text="KREW aide le groupe à transformer toutes ces réponses en décisions concrètes." mark="stamp-circle" large />
              <FeatureBlock className="krew-bento-part lg:col-span-2" iconName="planning" title="On part" text="Planning, transports, tâches et essentiels restent au même endroit." mark="check" />
              <FeatureBlock className="krew-bento-garde sm:col-span-2 lg:col-span-6" iconName="budget" title="On garde" text="Une fois le voyage passé, KREW conserve le voyage et les souvenirs du groupe." mark="heart" wide />
            </div>
          </div>
        </section>

        <section className="krew-final-scene relative bg-surface/80 border-t border-border py-16 sm:py-24 overflow-hidden">
          <KrewOrganicBlob tone="sage" variant="sweep" className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[520px] h-[230px] opacity-25 pointer-events-none" />
          <div className="krew-reveal max-w-2xl mx-auto px-4 sm:px-6 lg:px-10 text-center relative z-10 space-y-4">
            <div className="relative mx-auto w-fit"><img src="/brand/otter-states/lets-go.png" alt="Loutre KREW départ" className="krew-scene-otter w-[68px] sm:w-[82px] h-auto object-contain filter drop-shadow-xs mx-auto" /><KrewMark type="route" tone="sage" size="md" className="krew-draw-mark absolute -left-14 top-8 h-8 w-16 opacity-70" /></div>
            <h2 className="font-display text-3xl sm:text-5xl font-normal text-foreground leading-tight">Votre groupe a déjà assez parlé de ce voyage.</h2>
            <p className="mx-auto max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed font-sans">Il serait peut-être temps de le faire.</p>
            <div className="krew-final-cta pt-3 relative"><div className="mb-4 flex justify-center sm:hidden"><KrewNote variant="tape" tone="sage" rotation={1} size="sm" className="w-fit text-sm pointer-events-none">Prêt à partir ?</KrewNote></div><Button asChild size="xl" className="h-10 min-h-10 rounded-xl px-7 py-0 text-sm sm:text-base font-medium leading-none shadow-none"><Link to="/trips/new" className="inline-flex h-full items-center justify-center whitespace-nowrap text-center leading-none">Créer notre voyage</Link></Button></div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-background py-8">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between"><Logo size="sm" withTagline /><nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground"><Link to="/mentions-legales" className="transition hover:text-foreground">Mentions légales</Link><Link to="/cgu" className="transition hover:text-foreground">CGU</Link><Link to="/confidentialite" className="transition hover:text-foreground">Confidentialité</Link></nav><p className="max-w-xs text-center text-xs text-muted-foreground sm:text-right">© {new Date().getFullYear()} KREW</p></div>
      </footer>
    </div>
  );
}

function FeatureBlock({ className, iconName, title, text, mark, large = false, wide = false }: { className?: string; iconName: KrewIconName; title: string; text: string; mark: "pin-line" | "stamp-circle" | "check" | "heart"; large?: boolean; wide?: boolean }) {
  return (
    <article className={`krew-reveal krew-bento-card relative overflow-hidden rounded-[22px] border border-border/50 bg-background/95 p-5 sm:p-6 ${className ?? ""}`}>
      <KrewMark type={mark} tone={mark === "heart" ? "plum" : "sage"} size="md" className="krew-draw-mark pointer-events-none absolute right-4 top-4 opacity-55" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-5">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><KrewIcon name={iconName} tone="plum" size="sm" className="size-5" /></div>
        <div className={wide ? "sm:flex sm:items-end sm:justify-between sm:gap-8" : ""}><h3 className={`font-display font-normal text-foreground ${large ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{title}</h3><p className={`mt-1 text-sm text-muted-foreground leading-relaxed font-sans ${wide ? "sm:mt-0 sm:max-w-md" : "max-w-sm"}`}>{text}</p></div>
      </div>
    </article>
  );
}
