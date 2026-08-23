import { createFileRoute, Link } from "@tanstack/react-router";
import heroImage from "@/assets/hero-krew.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { KrewIcon, type KrewIconName } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewHighlight, KrewOrganicBlob } from "@/components/krew/visual-language";
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

// Filter out "Voyage de groupe" and "Voyage en famille" as requested in item 5
const IDEAL_FOR_TYPES = EVENT_TYPES.filter(
  (ev) => ev.value !== "voyage_groupe" && ev.value !== "famille"
);

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary">
      <SiteHeader />

      <main>
        {/* ——— Hero Section — Compact & Impactful ——— */}
        <section className="relative overflow-hidden bg-background py-8 sm:py-10 lg:py-12">
          {/* Subtle Organic Background Surface */}
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-12 -left-12 w-[350px] sm:w-[500px] h-[300px] sm:h-[400px] opacity-40 pointer-events-none z-0"
          />

          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative z-10">
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">
              {/* Text Column (7 cols) */}
              <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold uppercase tracking-wider">
                  <KrewMark type="sparkle" tone="plum" size="sm" className="size-3.5" />
                  <span>L’organisation des voyages de groupe, simplement</span>
                </div>

                <div className="relative">
                  <h1 className="font-display text-[42px] sm:text-[64px] lg:text-[84px] font-normal tracking-tight text-foreground leading-[0.92]">
                    Organisez moins.{" "}
                    <span className="italic text-primary block sm:inline">
                      Profitez plus.
                    </span>
                  </h1>
                  {/* Clean KrewMark underline positioned safely below glyphs without cutting text */}
                  <KrewMark
                    type="underline-wave"
                    tone="sage"
                    size="lg"
                    className="mt-1 w-[180px] sm:w-[260px] h-[10px] opacity-90 pointer-events-none"
                  />
                </div>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                  Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à
                  organiser le séjour, étape par étape.
                </p>

                {/* CTA Buttons - Perfectly Centered Text */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    asChild
                    size="xl"
                    className="rounded-xl px-8 text-base font-medium shadow-none inline-flex items-center justify-center text-center leading-none"
                  >
                    <Link to="/trips/new" className="inline-flex items-center justify-center text-center">
                      Nouveau voyage
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="lg"
                    className="rounded-xl px-5 text-muted-foreground hover:text-foreground inline-flex items-center justify-center text-center leading-none"
                  >
                    <Link to="/auth" search={{}} className="inline-flex items-center justify-center text-center">
                      Se connecter
                    </Link>
                  </Button>
                </div>

                <ul className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-foreground">
                  {TRUST.map((t) => (
                    <li
                      key={t}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground"
                    >
                      <KrewMark type="check" tone="plum" size="sm" className="size-4 shrink-0" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Photo Column (5 cols) */}
              <div className="lg:col-span-5 relative">
                <KrewOrganicBlob
                  tone="plum"
                  variant="sweep"
                  className="absolute -bottom-6 -right-6 w-[200px] h-[160px] opacity-20 pointer-events-none z-0"
                />
                <div className="relative z-10 overflow-hidden rounded-[24px] lg:rounded-l-[36px] shadow-sm aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/5] w-full">
                  <img
                    src={heroImage}
                    alt="Groupe d'amis en voyage"
                    className="h-full w-full object-cover object-center"
                    fetchPriority="high"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white text-right">
                    <p className="font-display text-xl sm:text-2xl font-normal leading-tight">
                      La Team. Le Plan. Le Moment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Section "Idéal pour" — Compact & Filtered ——— */}
        <section className="bg-sage/12 border-y border-border/60 py-4 sm:py-5">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 flex flex-wrap items-center justify-center sm:justify-start gap-y-2 gap-x-3 text-sm">
            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono shrink-0">
              Idéal pour
            </span>
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-0 gap-y-2">
              {IDEAL_FOR_TYPES.map((ev, index) => (
                <div
                  key={ev.value}
                  className={`flex items-center ${
                    index > 0 ? "sm:border-l sm:border-border/60 sm:pl-3 sm:ml-3" : ""
                  }`}
                >
                  <Link
                    to="/trips/new"
                    className="text-xs sm:text-sm font-medium text-foreground/80 transition hover:text-primary whitespace-nowrap"
                  >
                    {ev.label}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— Section "LE PLAN" — Compact, Structured & Otter Signature ——— */}
        <section className="relative overflow-hidden py-12 sm:py-16 bg-background">
          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative">
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div className="space-y-1">
                <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">
                  LE PLAN
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono">
                  Comment ça marche
                </p>
                <h2 className="relative inline-block font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground leading-tight tracking-tight mt-1">
                  Trois étapes, zéro chaos
                  <KrewMark
                    type="underline-wave"
                    tone="sage"
                    size="md"
                    className="mt-1 w-[180px] sm:w-[240px] opacity-80 pointer-events-none"
                  />
                </h2>
              </div>

              {/* Prominent KREW Otter tied directly to "Le plan" section */}
              <div className="shrink-0 flex items-center gap-3 bg-sage/15 px-4 py-2.5 rounded-2xl border border-sage/30">
                <img
                  src="/brand/otter-states/trip-progress.png"
                  alt="Loutre KREW organisation"
                  className="w-[72px] sm:w-[88px] h-auto object-contain shrink-0 filter drop-shadow-xs"
                />
                <div className="text-xs font-sans">
                  <p className="font-semibold text-foreground">KREW orchestre tout</p>
                  <p className="text-muted-foreground">Dispos & envies synchronisées</p>
                </div>
              </div>
            </div>

            {/* Steps Flow Grid */}
            <div className="relative">
              <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-secondary/40 z-0" />

              <div className="grid gap-6 lg:grid-cols-3 relative z-10">
                {STEPS.map((step) => (
                  <div
                    key={step.number}
                    className="relative space-y-2.5 p-5 rounded-2xl bg-surface/50 border border-border/50 transition-colors hover:border-border"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        aria-hidden="true"
                        className="font-display text-4xl sm:text-5xl font-normal text-secondary/50 leading-none select-none"
                      >
                        {step.number}
                      </span>
                      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <KrewIcon name={step.iconName} tone="plum" size="sm" className="size-5" />
                      </div>
                    </div>
                    <div>
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary block mb-0.5">
                        Étape {step.number}
                      </span>
                      <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">
                        {step.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ——— Section "LE MOMENT" — Travel Journal Concept & Friends Weekend Photo ——— */}
        <section className="w-full bg-sage/15 py-12 sm:py-16 relative overflow-hidden border-y border-border/50">
          <KrewOrganicBlob
            tone="plum"
            variant="soft"
            className="absolute top-0 right-0 w-[400px] h-[300px] opacity-15 pointer-events-none z-0"
          />

          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative z-10">
            {/* Header Block */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">
                  LE MOMENT
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono mt-0.5">
                  L&apos;expérience du groupe
                </p>
                <h2 className="mt-1 font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground">
                  Un voyage prêt, un groupe rassemblé
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg font-sans">
                  Une fois les réponses du groupe réunies, le séjour se dessine clairement avec des hébergements, des billets et un planning validé.
                </p>
              </div>

              {/* Otter asset specific to "Le moment" (Planning state) */}
              <div className="shrink-0 flex items-center gap-3 bg-background/80 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-border/60">
                <img
                  src="/brand/otter-states/planning.png"
                  alt="Loutre KREW planning"
                  className="w-[72px] sm:w-[84px] h-auto object-contain shrink-0 filter drop-shadow-xs"
                />
                <div className="text-xs font-sans">
                  <p className="font-semibold text-foreground">Week-end garanti</p>
                  <p className="text-muted-foreground">0 membre oublié</p>
                </div>
              </div>
            </div>

            {/* Photo & Story Grid — Using existing weekend photo asset */}
            <div className="grid lg:grid-cols-12 gap-6 items-center">
              {/* Photo Column with /images/trip-types/weekend.png (Friends weekend moment) */}
              <div className="lg:col-span-5 relative">
                <div className="relative rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/5] shadow-xs border border-border/40">
                  <img
                    src="/images/trip-types/weekend.png"
                    alt="Week-end entre amis"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/75 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full">
                      Week-end entre amis
                    </span>
                    <p className="font-display text-lg sm:text-2xl font-normal mt-1 leading-snug">
                      Lisbonne · 8 personnes
                    </p>
                  </div>
                </div>
              </div>

              {/* Travel Journal Detail Breakdown */}
              <div className="lg:col-span-7 space-y-4">
                {/* Title & Budget Summary */}
                <div className="p-5 rounded-2xl bg-background/90 border border-border/70 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md text-primary font-mono">
                        Exemple de projet final
                      </span>
                      <h3 className="font-display text-2xl sm:text-3xl font-normal text-foreground mt-1">
                        Retrouvailles à Lisbonne
                      </h3>
                      <p className="text-xs text-muted-foreground font-sans">Organisé par Thomas · 8 participants</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider font-mono">
                        Budget / personne
                      </p>
                      <KrewHighlight tone="sage" className="font-mono text-2xl sm:text-3xl font-bold text-primary mt-0.5 inline-block px-2.5 py-0.5">
                        ~360 €
                      </KrewHighlight>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
                    <div>
                      <p className="font-mono font-semibold uppercase text-[10px] text-muted-foreground">Dates</p>
                      <p className="font-medium text-foreground">Ven 11 Sept. → Dim 13 Sept.</p>
                    </div>
                    <div>
                      <p className="font-mono font-semibold uppercase text-[10px] text-muted-foreground">Réponses groupe</p>
                      <p className="font-medium text-foreground flex items-center gap-3">
                        <span>Dispos : <strong className="font-mono text-primary">8/8</strong></span>
                        <span>Envies : <strong className="font-mono text-primary">8/8</strong></span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lodging & Transport Highlights */}
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                      <KrewMark type="check" tone="sage" size="sm" className="size-3.5 shrink-0" />
                      <span>Hébergement validé</span>
                    </div>
                    <p className="font-semibold text-foreground">Lisbon Sky Apartments</p>
                    <p className="text-muted-foreground text-[11px]">Centre ville · 5 votes sur 8</p>
                    <p className="font-mono text-primary font-medium text-[11px]">42 € / pers / nuit</p>
                  </div>

                  <div className="p-4 rounded-xl bg-background/80 border border-border/50 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                      <KrewMark type="check" tone="sage" size="sm" className="size-3.5 shrink-0" />
                      <span>Transports sur mesure</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">Paris (5 pers) : Vol A/R 115 €</p>
                    <p className="text-muted-foreground text-[11px]">Lyon (3 pers) : Vol A/R 125 €</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Section "LA TEAM" — Features Grid ——— */}
        <section className="bg-background py-12 sm:py-16 relative overflow-hidden">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] opacity-20 pointer-events-none z-0"
          />

          <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 relative z-10">
            <div className="max-w-xl text-center mx-auto mb-8 sm:mb-10">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide">
                LA TEAM
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono mt-0.5">
                Ce que KREW fait pour toi
              </p>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-normal text-foreground relative inline-block">
                Moins de débats, plus de départ
                <KrewMark
                  type="underline-wave"
                  tone="sage"
                  size="md"
                  className="mt-1 w-[140px] mx-auto opacity-80 pointer-events-none"
                />
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureBlock
                iconName="destination"
                title="Destinations adaptées"
                text="Des propositions qui tiennent compte des envies, du budget et des contraintes du groupe."
              />
              <FeatureBlock
                iconName="budget"
                title="Budget transparent"
                text="Transport, hébergement, activités — estimés par personne."
              />
              <FeatureBlock
                iconName="vote"
                title="Décision collective"
                text="Chacun partage ses préférences, puis le groupe avance ensemble."
              />
              <FeatureBlock
                iconName="planning"
                title="Planning jour par jour"
                text="Restaurants, activités et temps forts réunis dans un programme clair."
              />
            </div>
          </div>
        </section>

        {/* ——— Final CTA — Focused & Compact ——— */}
        <section className="relative bg-surface/80 border-t border-border py-14 sm:py-20 overflow-hidden">
          <div className="max-w-2xl mx-auto px-5 sm:px-6 text-center relative z-10 space-y-4">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-sage/15 border border-sage/30 mx-auto">
              <img
                src="/brand/otter-states/lets-go.png"
                alt="Loutre KREW départ"
                className="w-14 sm:w-16 h-auto object-contain filter drop-shadow-xs"
              />
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-normal text-foreground leading-tight">
              Ta prochaine légende commence ici
            </h2>
            <p className="mx-auto max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed font-sans">
              Crée le voyage, invite le groupe et avancez ensemble, étape par étape.
            </p>

            <div className="pt-2">
              <Button
                asChild
                size="xl"
                className="rounded-xl px-8 text-base font-medium shadow-none inline-flex items-center justify-center text-center leading-none"
              >
                <Link to="/trips/new" className="inline-flex items-center justify-center text-center">
                  Créer mon voyage
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground font-mono pt-1">
              Gratuit pour démarrer · sans carte bancaire
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background py-8">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" withTagline />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
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
            © {new Date().getFullYear()} KREW — l&apos;organisation de voyages de groupe, enfin simple.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureBlock({
  iconName,
  title,
  text,
}: {
  iconName: KrewIconName;
  title: string;
  text: string;
}) {
  return (
    <div className="space-y-2.5 p-4 rounded-xl bg-surface/40 border border-border/40">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <KrewIcon name={iconName} tone="plum" size="sm" className="size-5" />
      </div>
      <h3 className="font-semibold text-foreground text-sm sm:text-base">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">{text}</p>
    </div>
  );
}
