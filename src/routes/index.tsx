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
        {/* ——— Hero Poster / Affiche V3 ——— */}
        <section className="relative overflow-hidden min-h-[520px] lg:h-[calc(100svh-72px)] lg:min-h-[820px] lg:max-h-[980px] bg-background">
          {/* KrewMark Circle coupée haut/droite viewport (260px, -70px top, -100px right, opacity 80) */}
          <KrewMark
            type="circle"
            tone="sage"
            size="lg"
            rotation={8}
            className="hidden lg:block absolute -top-[70px] -right-[100px] w-[260px] h-auto opacity-80 pointer-events-none z-10"
          />

          {/* Photo Absolute Right touching right viewport (lg:w-[58vw] max-w-[880px], rounded-l-[44px]) */}
          <div className="relative lg:absolute lg:right-0 lg:top-[44px] w-full lg:w-[58vw] lg:max-w-[880px] h-[520px] lg:h-[calc(100%-88px)] z-10 my-8 lg:my-0">
            {/* Panneau Sauge derrière photo */}
            <div className="absolute -bottom-4 -right-4 lg:right-[32px] lg:top-[88px] w-[90%] lg:w-[56vw] h-[95%] lg:h-[calc(100%-88px)] rounded-[28px] lg:rounded-l-[48px] lg:rounded-r-none bg-sage/30 lg:translate-x-[44px] lg:translate-y-[32px] pointer-events-none -z-10" />

            <div className="relative overflow-hidden rounded-l-[28px] rounded-r-none lg:rounded-l-[44px] lg:rounded-r-none border-0 shadow-none h-full w-full">
              <img
                src={heroImage}
                alt=""
                className="h-full w-full object-cover object-center"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-gradient-to-tl from-foreground/80 via-transparent to-transparent" />

              {/* Signature Photo Éditoriale */}
              <div className="absolute bottom-6 right-6 lg:bottom-[40px] lg:right-[48px] text-white text-right max-w-[360px]">
                <p className="font-display text-2xl sm:text-[32px] lg:text-[44px] font-normal leading-[0.95]">
                  La Team. Le Plan. Le Moment.
                </p>
              </div>
            </div>
          </div>

          {/* Eyebrow, Titre & Bloc Description/CTA */}
          <div className="relative lg:static max-w-[1500px] mx-auto px-6 lg:px-10 xl:px-14">
            {/* Eyebrow */}
            <p className="mb-4 lg:mb-0 lg:absolute lg:top-[72px] lg:left-[max(40px,calc((100vw-1500px)/2+56px))] text-sm font-medium text-primary z-20">
              L’organisation des voyages de groupe, simplement
            </p>

            {/* Titre Objet Graphique (clamp 112px à 154px) */}
            <div className="relative z-30 lg:absolute lg:left-[max(40px,calc((100vw-1500px)/2+56px))] lg:top-[135px] lg:w-[min(900px,68vw)]">
              <h1 className="font-display text-[60px] sm:text-[72px] lg:text-[clamp(112px,9.4vw,154px)] font-normal tracking-[-0.04em] lg:tracking-[-0.055em] text-foreground leading-[0.84] lg:leading-[0.78]">
                Le voyage de groupe,{" "}
                <span className="italic text-primary">organisé pour toi.</span>
              </h1>
              <KrewMark
                type="underline"
                tone="sage"
                size="lg"
                rotation={-3}
                className="absolute left-0 -bottom-6 w-[180px] lg:w-[380px] h-auto opacity-90 pointer-events-none"
              />
            </div>

            {/* Bloc Description + CTA Calme */}
            <div className="mt-8 lg:mt-0 lg:absolute lg:left-[max(40px,calc((100vw-1500px)/2+56px))] lg:bottom-[68px] lg:w-[430px] z-40">
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à
                organiser le séjour, étape par étape.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 relative">
                <Button asChild size="xl" className="rounded-xl px-7 text-base font-medium shadow-none">
                  <Link to="/trips/new">Créer mon voyage</Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="rounded-xl px-5 text-muted-foreground hover:text-foreground">
                  <Link to="/auth" search={{}}>Se connecter</Link>
                </Button>
                <KrewMark
                  type="arrow"
                  tone="plum"
                  size="lg"
                  rotation={-10}
                  className="hidden lg:block absolute -right-28 -top-3 w-[150px] h-auto pointer-events-none"
                />
              </div>

              <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-foreground">
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
          </div>
        </section>

        {/* ——— Types d'événements (Interlude) ——— */}
        <section className="min-h-[180px] flex items-center bg-background border-y border-border/70 py-8">
          <div className="mx-auto max-w-[1180px] px-6 flex flex-wrap items-center justify-center lg:justify-start gap-y-3 text-sm w-full">
            <span className="mr-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Idéal pour
            </span>
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

        {/* ——— Double Page Éditoriale LE PLAN V3 ——— */}
        <section className="relative overflow-hidden py-16 sm:py-24 lg:py-0 lg:min-h-[1100px] bg-background">
          <div className="mx-auto max-w-[1380px] px-6 lg:px-10 relative">
            {/* Intro Éditoriale Alignée Gauche */}
            <div className="relative z-20 lg:pt-[120px] lg:max-w-[760px]">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-2">
                LE PLAN
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Comment ça marche
              </p>
              <h2 className="relative inline-block mt-3 font-display text-3xl sm:text-5xl lg:text-[clamp(78px,7vw,108px)] font-normal text-foreground leading-[0.88] lg:leading-[0.84] tracking-[-0.045em]">
                Trois étapes, zéro chaos
                <KrewMark
                  type="highlight"
                  tone="sage"
                  size="lg"
                  rotation={-3}
                  className="absolute w-[320px] lg:w-[430px] opacity-75 -z-10 right-0 -bottom-2 pointer-events-none"
                />
              </h2>
            </div>

            {/* Layout Absolute Double Page Desktop */}
            <div className="relative mt-12 lg:mt-0 lg:static">
              {/* Connectors Desktop */}
              <div className="hidden lg:block absolute inset-0 pointer-events-none z-10">
                <KrewMark
                  type="connector"
                  tone="sage"
                  size="lg"
                  rotation={-6}
                  className="absolute w-[360px] opacity-60 left-[22%] top-[620px]"
                />
                <KrewMark
                  type="connector"
                  tone="sage"
                  size="lg"
                  rotation={5}
                  className="absolute w-[380px] opacity-60 right-[22%] top-[660px]"
                />
              </div>

              {/* Trajectoire mobile */}
              <div className="lg:hidden absolute top-5 bottom-5 left-5 w-0 border-l border-sage/30" />

              {/* Grand 01 */}
              <span
                aria-hidden="true"
                className="hidden lg:block font-display text-[320px] font-normal text-sage/22 leading-[0.7] select-none absolute -left-[55px] top-[400px] z-0 pointer-events-none"
              >
                01
              </span>

              {/* Étape 1 */}
              <div className="relative lg:absolute lg:left-[max(70px,calc((100vw-1380px)/2+80px))] lg:top-[590px] lg:w-[290px] z-20 pl-14 lg:pl-0 mb-12 lg:mb-0">
                <span aria-hidden="true" className="lg:hidden font-display text-[110px] font-normal text-sage/22 leading-none select-none block -mb-6">
                  01
                </span>
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Users className="size-5" />
                  </div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    Étape 1
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mt-1">Crée ton voyage</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Renseigne l’essentiel et invite le groupe.</p>
              </div>

              {/* Grand 02 */}
              <span
                aria-hidden="true"
                className="hidden lg:block font-display text-[390px] font-normal text-primary/10 leading-[0.7] select-none absolute left-1/2 top-[430px] -translate-x-[45%] z-0 pointer-events-none"
              >
                02
              </span>

              {/* Étape 2 */}
              <div className="relative lg:absolute lg:left-1/2 lg:top-[690px] lg:-translate-x-[35%] lg:w-[300px] z-20 pl-14 lg:pl-0 mb-12 lg:mb-0">
                <span aria-hidden="true" className="lg:hidden font-display text-[110px] font-normal text-primary/10 leading-none select-none block -mb-6">
                  02
                </span>
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-sage/12 text-sage">
                    <CalendarCheck className="size-5" />
                  </div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    Étape 2
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mt-1">Chacun répond</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Disponibilités et préférences : chacun complète ses informations.</p>
              </div>

              {/* Grand 03 */}
              <span
                aria-hidden="true"
                className="hidden lg:block font-display text-[330px] font-normal text-sage/22 leading-[0.7] select-none absolute -right-[80px] top-[500px] z-0 pointer-events-none"
              >
                03
              </span>

              {/* Étape 3 */}
              <div className="relative lg:absolute lg:right-[max(70px,calc((100vw-1380px)/2+70px))] lg:top-[610px] lg:w-[300px] z-20 pl-14 lg:pl-0">
                <span aria-hidden="true" className="lg:hidden font-display text-[110px] font-normal text-sage/22 leading-none select-none block -mb-6">
                  03
                </span>
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/8 text-primary">
                    <Sparkles className="size-5" />
                  </div>
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                    Étape 3
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mt-1">KREW propose</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Dates, destinations, hébergements et trajets adaptés au groupe.</p>
              </div>

            </div>
          </div>
        </section>

        {/* ——— Cover Story LE MOMENT V3 ——— */}
        <section className="w-full bg-sage/22 pt-[130px] pb-[150px] relative overflow-hidden">
          <div className="mx-auto max-w-[1440px] px-6 lg:px-10 xl:px-14">
            {/* Intro Éditoriale Alignée Gauche */}
            <div className="max-w-[620px] text-left mb-12">
              <span className="block font-display text-2xl sm:text-3xl text-primary font-normal tracking-wide mb-2">
                LE MOMENT
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aperçu interactif</p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-foreground">Un voyage complet, assemblé en direct</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Découvre à quoi peut ressembler un voyage organisé avec KREW.
              </p>
            </div>

            {/* Composition Cover Story V3 */}
            <div className="space-y-12">
              {/* Photo Massive Full Width (calc(100% - 150px) sur desktop) */}
              <div className="relative w-full lg:w-[calc(100%-150px)]">
                <img
                  src="https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=1200&q=80"
                  alt=""
                  className="h-[440px] lg:h-[720px] w-full object-cover rounded-[36px]"
                />
              </div>

              {/* Cover Title + Panneau Support Blanc + Budget */}
              <div className="relative lg:-mt-[100px] lg:ml-[clamp(40px,8vw,130px)] z-20 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 lg:w-[calc(100%-150px)]">
                {/* Support Blanc Titre */}
                <div className="bg-background rounded-xl p-6 lg:p-[32px_42px_28px] max-w-[760px] shadow-none border-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground/10 px-2.5 py-0.5 rounded-full text-foreground">Exemple de projet final</span>
                  <h3 className="font-display text-[56px] sm:text-[56px] lg:text-[clamp(72px,7vw,108px)] font-normal leading-[0.84] tracking-[-0.045em] text-foreground mt-3">
                    Week-end Retrouvailles à Lisbonne
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2">Organisé par Thomas · 8 personnes</p>
                </div>

                {/* Budget Typographique & Heart Mark */}
                <div className="relative bg-background rounded-xl p-6 lg:p-7 border-0 shrink-0">
                  <KrewMark
                    type="heart"
                    tone="plum"
                    size="lg"
                    rotation={4}
                    className="w-[120px] opacity-75 pointer-events-none absolute -top-16 -left-12 hidden lg:block z-30"
                  />
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Budget estimé par personne</p>
                  <p className="font-mono text-[52px] lg:text-[80px] font-bold text-primary leading-[0.9] mt-2">~360 €</p>
                </div>
              </div>

              {/* Informations du Voyage : Grille 2 Zones Éditoriale */}
              <div className="grid gap-12 lg:grid-cols-12 pt-8 lg:pt-12">
                {/* Zone Gauche (~36% / col-span-4) */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="border-t border-border/50 pt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dates</p>
                    <p className="font-medium text-foreground text-sm">Vendredi 11 Sept. → Dimanche 13 Sept.</p>
                  </div>

                  <div className="border-t border-border/50 pt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">État des réponses</p>
                    <div className="flex flex-wrap gap-4 text-xs pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarCheck className="size-4 text-sage" />
                        <span>Disponibilités : </span>
                        <span className="font-mono font-semibold text-success">8/8</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Vote className="size-4 text-sage" />
                        <span>Préférences : </span>
                        <span className="font-mono font-semibold text-success">8/8</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Zone Droite (~58% / col-span-7 col-start-6) */}
                <div className="lg:col-span-7 lg:col-start-6 space-y-8">
                  {/* Hébergement */}
                  <div className="border-t border-border/50 pt-5 space-y-2">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground mb-3">
                      <Check className="size-4 text-success" />
                      Hébergement retenu par le groupe
                    </h4>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-base">Lisbon Sky Apartments</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p>
                      </div>
                      <Badge variant="success" className="shrink-0">5 votes sur 8</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono pt-1">42 € / personne par nuit · 84 € / personne pour le séjour</p>
                  </div>

                  {/* Transport */}
                  <div className="border-t border-border/50 pt-5 space-y-3 text-xs">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground mb-3">
                      <Check className="size-4 text-success" />
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

                  {/* Planning Jour par Jour Restauré */}
                  <div className="border-t border-border/50 pt-5 space-y-4">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground mb-3">
                      <Check className="size-4 text-success" />
                      Extrait du planning jour par jour
                    </h4>
                    <div className="space-y-4 pt-1">
                      <div className="relative pl-5 border-l-2 border-sage/35">
                        <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 15:30</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Arrivée à l&apos;aéroport de Lisbonne et transfert</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Dépose des bagages aux Lisbon Sky Apartments.</p>
                      </div>
                      <div className="relative pl-5 border-l-2 border-sage/35">
                        <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 19:30</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Dîner de Tapas locales chez Ramiro</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Le resto mythique de fruits de mer plébiscité par le groupe.</p>
                      </div>
                      <div className="relative pl-5 border-l-2 border-sage/35">
                        <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                        <p className="text-xs font-mono font-semibold text-primary">JOUR 2 · 14:00</p>
                        <p className="font-semibold text-xs mt-0.5 text-foreground">Visite guidée en Tuk-Tuk électrique</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Balade insolite dans les ruelles pavées de l&apos;Alfama.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grand Espace Négatif de Fin (>100px) */}
              <div className="h-28 lg:h-36" />

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
