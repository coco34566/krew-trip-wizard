import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  Wallet,
  CalendarCheck,
  Users,
  MapPinned,
  Vote,
  Check,
} from "lucide-react";

import heroImage from "@/assets/hero-krew.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { EVENT_TYPES } from "@/lib/krew/constants";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";

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

const STEPS = [
  {
    icon: Users,
    title: "Crée ton voyage",
    text: "Renseigne l’essentiel et invite le groupe.",
  },
  {
    icon: CalendarCheck,
    title: "Chacun répond",
    text: "Disponibilités et préférences : chacun complète ses informations.",
  },
  {
    icon: Sparkles,
    title: "KREW propose",
    text: "Dates, destinations, hébergements et trajets adaptés au groupe.",
  },
];

const TRUST = [
  "Sans prise de tête",
  "Décision en groupe",
  "Budget clair dès le départ",
];

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary">
      <SiteHeader />

      <main>
        {/* ——— Hero Éditorial ——— */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-20 min-h-[760px]">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-10 xl:px-14">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">

              {/* Colonne gauche : Titre & Actions */}
              <div className="lg:col-span-7">
                <p className="mb-6 text-sm font-medium text-primary">
                  L’organisation des voyages de groupe, simplement
                </p>

                <div className="relative">
                  <h1 className="font-display text-[52px] sm:text-[72px] lg:text-[88px] xl:text-[96px] font-normal tracking-[-0.035em] text-foreground leading-[0.96] lg:leading-[0.92]">
                    Le voyage de groupe,{" "}
                    <span className="italic text-primary">organisé pour toi.</span>
                  </h1>
                  <KrewMark type="underline" tone="sage" size="lg" rotation={-2} className="absolute left-0 -bottom-6 w-[150px] sm:w-[220px] h-auto opacity-80 pointer-events-none" />
                </div>

                <p className="mt-8 sm:mt-10 max-w-[500px] text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à
                  organiser le séjour, étape par étape.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button asChild size="xl" className="rounded-xl px-7 text-base font-medium shadow-none">
                    <Link to="/trips/new">Créer mon voyage</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="rounded-xl px-5 text-muted-foreground hover:text-foreground">
                    <Link to="/auth" search={{}}>Se connecter</Link>
                  </Button>
                </div>

                <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground">
                  {TRUST.map((t) => (
                    <li
                      key={t}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground"
                    >
                      <Check className="size-4 text-primary shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>

                <KrewMark type="arrow" tone="plum" size="md" rotation={-4} className="hidden lg:block absolute w-[96px] bottom-12 left-1/2 pointer-events-none" />
              </div>

              {/* Colonne droite : Photo Cadre Éditorial */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  {/* Rectangle Sauge exact derrière photo */}
                  <div className="absolute w-[88%] sm:w-[82%] h-[92%] sm:h-[88%] -bottom-4 sm:-bottom-8 -right-4 sm:-right-8 rounded-[36px] bg-sage/18 pointer-events-none" />
                  <div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card shadow-none h-[460px] sm:h-[520px] lg:h-[660px] xl:h-[700px] w-full">
                    <img
                      src={heroImage}
                      alt=""
                      className="h-full w-full object-cover object-center"
                      fetchPriority="high"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />

                    <div className="absolute bottom-6 left-6 text-white">
                      <p className="font-display text-2xl sm:text-[32px] font-normal leading-[1]">
                        La Team. Le Plan. Le Moment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ——— Types d'événements ——— */}
        <section className="py-10 border-y border-border/70 bg-background">
          <div className="mx-auto max-w-[1240px] px-6 flex flex-wrap items-center justify-center gap-y-3 text-sm">
            <div className="relative flex items-center mr-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Idéal pour
              </span>
              <KrewMark type="circle" tone="sage" size="sm" rotation={2} className="absolute w-8 -left-2 -top-1 opacity-70 pointer-events-none" />
            </div>
            {EVENT_TYPES.slice(0, 6).map((ev, index) => (
              <div key={ev.value} className={`flex items-center ${index > 0 ? "border-l border-border/60 pl-4 ml-4" : ""}`}>
                <Link
                  to="/trips/new"
                  className="text-sm font-medium text-muted-foreground transition hover:text-primary"
                >
                  {ev.label}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* ——— Comment ça marche (stepper éditorial LE PLAN) ——— */}
        <section className="mx-auto max-w-[1280px] px-6 py-16 sm:py-24 lg:py-28 min-h-0 lg:min-h-[840px] relative">
          <div className="mx-auto max-w-2xl text-center">
            <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-2">
              LE PLAN
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Comment ça marche
            </p>
            <h2 className="relative inline-block mt-3 font-display text-3xl sm:text-4xl lg:text-[58px] font-normal text-foreground leading-tight lg:leading-[0.98] tracking-normal lg:tracking-[-0.025em]">
              Trois étapes, zéro chaos
              <KrewMark type="highlight" tone="sage" size="lg" rotation={-2} className="absolute w-[260px] opacity-70 -z-10 left-1/2 -bottom-2 pointer-events-none" />
            </h2>
          </div>

          <div className="relative mx-auto mt-16 lg:mt-24 max-w-5xl">
            {/* Connectors Desktop */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none z-0">
              <KrewMark type="connector" tone="sage" size="lg" rotation={-2} className="absolute w-[260px] opacity-55 left-[24%] top-[140px]" />
              <KrewMark type="connector" tone="sage" size="lg" rotation={2} className="absolute w-[260px] opacity-55 right-[24%] top-[200px]" />
            </div>

            {/* Trajectoire mobile */}
            <div className="lg:hidden absolute top-5 bottom-5 left-5 w-0 border-l border-sage/30" />

            <div className="grid gap-14 lg:gap-8 lg:grid-cols-3 relative z-10">
              {STEPS.map((step, i) => {
                const offsets = ["lg:translate-y-0", "lg:translate-y-24", "lg:translate-y-8"];
                return (
                  <div key={step.title} className={`relative flex flex-col items-start pl-14 lg:pl-0 ${offsets[i]}`}>
                    <span aria-hidden="true" className="font-display text-[72px] lg:text-[128px] font-normal text-sage/20 leading-none select-none -mb-4 lg:-mb-10">
                      0{i + 1}
                    </span>
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`flex size-11 items-center justify-center rounded-lg ${i === 1 ? 'bg-sage/12 text-sage' : 'bg-primary/8 text-primary'}`}>
                        <step.icon className="size-5" />
                      </div>
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                        Étape {i + 1}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground mt-1">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ——— Aperçu Projet Complet Fictif (LE MOMENT) ——— */}
        <section className="w-full bg-sage/12 py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
            <div className="mx-auto max-w-2xl text-center mb-12 lg:mb-16">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-2">
                LE MOMENT
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aperçu interactif</p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-normal text-foreground">Un voyage complet, assemblé en direct</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Découvre à quoi peut ressembler un voyage organisé avec KREW.
              </p>
            </div>

            {/* Composition Ouverte sans Wrapper Card */}
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center xl:gap-14">

              {/* Photo Lisbonne */}
              <div className="lg:col-span-7 relative">
                <img
                  src="https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=1200&q=80"
                  alt=""
                  className="h-[400px] lg:h-[580px] xl:h-[620px] w-full object-cover rounded-[28px]"
                />

                {/* Budget Chevauchement Desktop */}
                <div className="hidden lg:block absolute right-0 bottom-12 translate-x-12 bg-background rounded-xl px-6 py-5 shadow-none border border-border/40">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Budget estimé par personne</p>
                  <p className="font-mono text-[48px] font-bold text-primary leading-none mt-2">~360 €</p>
                </div>
              </div>

              {/* Contenu principal */}
              <div className="lg:col-span-5 space-y-6 relative">
                <KrewMark type="heart" tone="plum" size="lg" rotation={4} className="w-[84px] opacity-75 pointer-events-none absolute -top-10 right-0 hidden lg:block" />

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground/10 px-2.5 py-0.5 rounded-full text-foreground">Exemple de projet final</span>
                  <h3 className="font-display text-3xl sm:text-4xl lg:text-[58px] font-normal leading-tight lg:leading-[0.98] tracking-normal lg:tracking-[-0.025em] text-foreground mt-2">
                    Week-end Retrouvailles à Lisbonne
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5">Organisé par Thomas · 8 personnes</p>
                </div>

                {/* Budget Mobile */}
                <div className="lg:hidden -mt-7 relative z-10 bg-background rounded-xl p-4 border border-border/40 w-fit">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Budget estimé / personne</p>
                  <p className="font-mono text-3xl font-bold text-primary leading-none mt-1">~360 €</p>
                </div>

                <div className="border-t border-b border-border/50 py-4 grid gap-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dates</span>
                    <span className="font-medium text-foreground">11 Sept. → 13 Sept.</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/40 pt-3">
                    <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Réponses</span>
                    <div className="flex gap-4">
                      <span className="text-xs inline-flex items-center gap-1">
                        <CalendarCheck className="size-4 text-sage" />
                        <span className="font-mono font-semibold text-success">8/8</span>
                      </span>
                      <span className="text-xs inline-flex items-center gap-1">
                        <Vote className="size-4 text-sage" />
                        <span className="font-mono font-semibold text-success">8/8</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hébergement */}
                <div className="border-t border-border/50 pt-5 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-base">Lisbon Sky Apartments</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p>
                    </div>
                    <Badge variant="success" className="shrink-0">5 votes sur 8</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">42 € / personne par nuit · 84 € / personne pour le séjour</p>
                </div>

                {/* Transport */}
                <div className="border-t border-border/50 pt-4 space-y-2 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wider">Transports</p>
                  <div className="flex justify-between border-b border-border/40 pb-2 text-muted-foreground">
                    <span>Paris (5 pers.) · Vol EasyJet A/R</span>
                    <span className="font-mono font-semibold text-foreground">115 €</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Lyon (3 pers.) · Vol Transavia A/R</span>
                    <span className="font-mono font-semibold text-foreground">125 €</span>
                  </div>
                </div>

                {/* Planning */}
                <div className="border-t border-border/50 pt-4 space-y-3">
                  <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">Planning</p>
                  <div className="space-y-3 pt-1">
                    <div className="relative pl-4 border-l-2 border-sage/35">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 15:30</p>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">Arrivée & transfert appartement</p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-sage/35">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 19:30</p>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">Dîner Tapas locales chez Ramiro</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ——— Features (Ce que KREW fait pour toi / LA TEAM) ——— */}
        <section className="border-y border-border bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-2">
                LA TEAM
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Ce que KREW fait pour toi
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-normal text-foreground">
                Moins de débats, plus de départ
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={MapPinned}
                title="Destinations adaptées"
                text="Des propositions qui tiennent compte des envies, du budget et des contraintes du groupe."
              />
              <FeatureCard
                icon={Wallet}
                title="Budget transparent"
                text="Transport, hébergement, activités — estimés par personne."
              />
              <FeatureCard
                icon={Vote}
                title="Décision collective"
                text="Chacun partage ses préférences, puis le groupe avance ensemble."
              />
              <FeatureCard
                icon={CalendarCheck}
                title="Planning jour par jour"
                text="Restaurants, activités et temps forts réunis dans un programme clair."
              />
            </div>
          </div>
        </section>

        {/* ——— CTA final ——— */}
        <section className="relative bg-surface/60 border-b border-border py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
            <h2 className="font-display text-3xl sm:text-5xl font-normal text-foreground">
              Ta prochaine légende commence ici
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground leading-relaxed">
              Crée le voyage, invite le groupe et avancez ensemble, étape par étape.
            </p>
            <Button asChild size="xl" className="mt-8 rounded-xl px-8 text-base font-medium shadow-none">
              <Link to="/trips/new">Créer mon voyage</Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">Gratuit pour démarrer · sans carte bancaire</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" withTagline />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/mentions-legales" className="transition hover:text-foreground">
              Mentions légales
            </Link>
            <Link to="/cgu" className="transition hover:text-foreground">
              CGU
            </Link>
            <Link to="/confidentialite" className="transition hover:text-foreground">
              Confidentialité
            </Link>
          </nav>
          <p className="max-w-xs text-center text-xs text-muted-foreground sm:text-right">
            © {new Date().getFullYear()} KREW — l&apos;organisation de voyages de groupe, enfin
            simple.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof MapPinned;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/40">
      <span className="grid size-11 place-items-center rounded-xl bg-secondary/30 text-foreground mb-4">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold text-foreground text-base">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
