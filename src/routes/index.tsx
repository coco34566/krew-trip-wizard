import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import heroImage from "@/assets/hero-krew.jpg";
import landingTripPreview from "@/assets/landing-trip-preview.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon, type KrewIconName } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { EVENT_TYPES } from "@/lib/krew/constants";

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
  {
    iconName: "group",
    number: "01",
    title: "Crée ton voyage",
    text: "Renseigne l’essentiel et invite le groupe.",
  },
  {
    iconName: "calendar",
    number: "02",
    title: "Chacun répond",
    text: "Disponibilités et préférences : chacun complète ses informations.",
  },
  {
    iconName: "planning",
    number: "03",
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
        {/* ——— Hero Poster / Normal Flow Container ——— */}
        <section className="relative overflow-hidden bg-background py-10 lg:py-16">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative">
            <KrewMark
              type="circle"
              tone="sage"
              size="lg"
              rotation={8}
              className="hidden lg:block absolute -top-10 -right-10 w-[220px] h-auto opacity-70 pointer-events-none z-0"
            />

            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Text Column (7 cols) */}
              <div className="lg:col-span-7 space-y-6 z-10">
                <p className="text-sm font-medium text-primary">
                  L’organisation des voyages de groupe, simplement
                </p>

                <div className="relative inline-block">
                  <h1 className="font-display text-[40px] sm:text-[64px] lg:text-[88px] font-normal tracking-tight text-foreground leading-[0.88]">
                    Le voyage de groupe,{" "}
                    <span className="italic text-primary">organisé pour toi.</span>
                  </h1>
                  <KrewMark
                    type="underline"
                    tone="sage"
                    size="lg"
                    rotation={-3}
                    className="absolute left-0 -bottom-3 w-[180px] sm:w-[280px] h-auto opacity-90 pointer-events-none"
                  />
                </div>

                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl pt-2">
                  Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à
                  organiser le séjour, étape par étape.
                </p>

                <div className="flex flex-wrap items-center gap-3 relative pt-2">
                  <Button asChild size="xl" className="rounded-xl px-7 text-base font-medium shadow-none">
                    <Link to="/trips/new">Créer mon voyage</Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="rounded-xl px-5 text-muted-foreground hover:text-foreground">
                    <Link to="/auth" search={{}}>Se connecter</Link>
                  </Button>
                </div>

                <ul className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground">
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
              </div>

              {/* Photo Column (5 cols) */}
              <div className="lg:col-span-5 relative z-10">
                <div className="relative overflow-hidden rounded-[28px] lg:rounded-l-[44px] border-0 shadow-none aspect-[4/5] sm:aspect-[4/3] lg:aspect-[4/5] w-full">
                  <img
                    src={heroImage}
                    alt=""
                    className="h-full w-full object-cover object-center"
                    fetchPriority="high"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-white text-right">
                    <p className="font-display text-2xl sm:text-3xl font-normal leading-tight">
                      La Team. Le Plan. Le Moment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Types d'événements (Interlude) ——— */}
        <section className="bg-background border-y border-border/70 py-6">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 flex flex-wrap items-center justify-center lg:justify-start gap-y-3 gap-x-4 text-sm">
            <span className="mr-2 sm:mr-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
              Idéal pour
            </span>
            <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-0 gap-y-2">
              {EVENT_TYPES.slice(0, 6).map((ev, index) => (
                <div
                  key={ev.value}
                  className={`flex items-center ${
                    index > 0 ? "sm:border-l sm:border-border/60 sm:pl-4 sm:ml-4" : ""
                  }`}
                >
                  <Link
                    to="/trips/new"
                    className="text-sm font-medium text-muted-foreground transition hover:text-primary whitespace-nowrap"
                  >
                    {ev.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Double Page Éditoriale LE PLAN V3 — Clean Grid ——— */}
        <section className="relative overflow-hidden py-16 sm:py-24 bg-background">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative">
            {/* Intro Éditoriale */}
            <div className="max-w-2xl space-y-2 mb-12">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">
                LE PLAN
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Comment ça marche
              </p>
              <h2 className="relative inline-block font-display text-3xl sm:text-5xl lg:text-6xl font-normal text-foreground leading-tight tracking-tight">
                Trois étapes, zéro chaos
                <KrewMark
                  type="highlight"
                  tone="sage"
                  size="lg"
                  rotation={-3}
                  className="absolute w-[220px] sm:w-[320px] opacity-75 -z-10 right-0 -bottom-2 pointer-events-none"
                />
              </h2>
            </div>

            {/* Grid 3 Colonnes Desktop / Stack Mobile */}
            <div className="grid gap-8 lg:grid-cols-3 relative">
              {STEPS.map((step) => (
                <div key={step.number} className="relative bg-surface/30 rounded-[24px] p-5 sm:p-8 border border-border/50 space-y-4">
                  <span
                    aria-hidden="true"
                    className="font-display text-6xl font-normal text-sage/30 leading-none select-none block"
                  >
                    {step.number}
                  </span>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <KrewIcon name={step.iconName} tone="plum" size="sm" className="size-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                      Étape {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Cover Story LE MOMENT V3 ——— */}
        <section className="w-full bg-sage/22 py-16 sm:py-24 relative overflow-hidden">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10">
            {/* Intro Éditoriale */}
            <div className="max-w-xl text-left mb-10">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-1">
                LE MOMENT
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aperçu interactif</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground">Un voyage complet, assemblé en direct</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Découvre à quoi peut ressembler un voyage organisé avec KREW.
              </p>
            </div>

            {/* Content Container */}
            <div className="space-y-10">
              <div className="relative w-full rounded-[28px] overflow-hidden aspect-[4/3] sm:aspect-[16/9] max-h-[500px]">
                <img
                  src={landingTripPreview}
                  alt=""
                  className="size-full object-cover"
                />
              </div>

              {/* Title + Budget */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 bg-background rounded-2xl p-5 sm:p-8 border border-border/50">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground/10 px-2.5 py-0.5 rounded-full text-foreground">Exemple de projet final</span>
                  <h3 className="font-display text-3xl sm:text-5xl font-normal text-foreground mt-2">
                    Week-end Retrouvailles à Lisbonne
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Organisé par Thomas · 8 personnes</p>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Budget estimé par personne</p>
                  <p className="font-mono text-4xl sm:text-6xl font-bold text-primary mt-1">~360 €</p>
                </div>
              </div>

              {/* Detail Grid */}
              <div className="grid gap-8 lg:grid-cols-12 pt-4">
                <div className="lg:col-span-4 space-y-6">
                  <div className="border-t border-border/50 pt-4 space-y-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dates</p>
                    <p className="font-medium text-foreground text-sm">Vendredi 11 Sept. → Dimanche 13 Sept.</p>
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">État des réponses</p>
                    <div className="flex flex-wrap gap-4 text-xs pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <KrewIcon name="availability" tone="sage" size="sm" className="size-4" />
                        <span>Disponibilités : </span>
                        <span className="font-mono font-semibold text-primary">8/8</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <KrewIcon name="preferences" tone="sage" size="sm" className="size-4" />
                        <span>Préférences : </span>
                        <span className="font-mono font-semibold text-primary">8/8</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <div className="border-t border-border/50 pt-4 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Check className="size-4 text-emerald-600" />
                      Hébergement retenu par le groupe
                    </h4>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm sm:text-base">Lisbon Sky Apartments</p>
                        <p className="text-xs text-muted-foreground">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p>
                      </div>
                      <Badge variant="success" className="shrink-0">5 votes sur 8</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">42 € / personne par nuit · 84 € / personne pour le séjour</p>
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-2 text-xs">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Check className="size-4 text-emerald-600" />
                      Transports par ville de départ
                    </h4>
                    <div className="flex justify-between border-b border-border/40 pb-2 text-muted-foreground">
                      <span>Paris (5 personnes) · Vol EasyJet aller-retour</span>
                      <span className="font-mono font-semibold text-foreground">115 €</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Lyon (3 personnes) · Vol Transavia aller-retour</span>
                      <span className="font-mono font-semibold text-foreground">125 €</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                      <Check className="size-4 text-emerald-600" />
                      Extrait du planning jour par jour
                    </h4>
                    <div className="space-y-3 pt-1">
                      <div className="relative pl-4 border-l-2 border-sage/40">
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 15:30</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Arrivée à l&apos;aéroport de Lisbonne et transfert</p>
                      </div>
                      <div className="relative pl-4 border-l-2 border-sage/40">
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 19:30</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Dîner de Tapas locales chez Ramiro</p>
                      </div>
                      <div className="relative pl-4 border-l-2 border-sage/40">
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 2 · 14:00</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Visite guidée en Tuk-Tuk électrique</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Features (LA TEAM) ——— */}
        <section className="border-y border-border bg-background py-16 sm:py-24">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10">
            <div className="max-w-2xl text-center mx-auto mb-12">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-1">
                LA TEAM
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Ce que KREW fait pour toi
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-normal text-foreground">
                Moins de débats, plus de départ
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                iconName="destination"
                title="Destinations adaptées"
                text="Des propositions qui tiennent compte des envies, du budget et des contraintes du groupe."
              />
              <FeatureCard
                iconName="budget"
                title="Budget transparent"
                text="Transport, hébergement, activités — estimés par personne."
              />
              <FeatureCard
                iconName="vote"
                title="Décision collective"
                text="Chacun partage ses préférences, puis le groupe avance ensemble."
              />
              <FeatureCard
                iconName="planning"
                title="Planning jour par jour"
                text="Restaurants, activités et temps forts réunis dans un programme clair."
              />
            </div>
          </div>
        </section>

        {/* ——— CTA final ——— */}
        <section className="relative bg-surface/60 border-b border-border py-20 sm:py-28">
          <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
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
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
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
  iconName,
  title,
  text,
}: {
  iconName: KrewIconName;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:border-primary/40">
      <span className="grid size-11 place-items-center rounded-xl bg-secondary/30 text-foreground mb-4">
        <KrewIcon name={iconName} tone="plum" size="sm" className="size-5" />
      </span>
      <h3 className="font-semibold text-foreground text-base">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
