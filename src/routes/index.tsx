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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* ——— Hero cinématique ——— */}
        <section className="relative isolate min-h-[78vh] overflow-hidden">
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-black/45" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />

          <div className="relative z-10 mx-auto flex max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:pb-20 sm:pt-36">
            <Badge variant="lagoon" className="mb-5 w-fit backdrop-blur-sm">
              L’organisation des voyages de groupe, simplement
            </Badge>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Le voyage de groupe,{" "}
              <span className="text-brand-gradient">organisé pour toi.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Disponibilités, envies, budget : KREW rassemble les réponses du groupe et t’aide à
              organiser le séjour, étape par étape.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/trips/new">Créer mon voyage</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-muted-foreground">
                <Link to="/auth" search={{}}>Se connecter</Link>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap gap-2">
              {TRUST.map((t) => (
                <li
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-sm"
                >
                  <Check className="size-3.5 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ——— Types d'événements ——— */}
        <section className="border-b border-border bg-card/40">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-5">
            <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Idéal pour
            </span>
            {EVENT_TYPES.slice(0, 6).map((ev) => (
              <Link
                key={ev.value}
                to="/trips/new"
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                {ev.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ——— Comment ça marche (stepper) ——— */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Comment ça marche
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
              Trois étapes, zéro chaos
            </h2>
          </div>

          <ol className="relative mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 ? (
                  <div
                    className="pointer-events-none absolute left-[calc(50%+28px)] top-7 hidden h-0.5 w-[calc(100%-56px)] bg-border sm:block"
                    aria-hidden
                  />
                ) : null}
                <span className="relative z-10 flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm">
                  <step.icon className="size-6" />
                </span>
                <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">
                  Étape {i + 1}
                </span>
                <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-[16rem] text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ——— Aperçu Projet Complet Fictif ——— */}
        <section className="border-t border-border bg-gradient-to-b from-card to-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary font-display">Aperçu interactif</p>
              <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Un voyage complet, assemblé en direct</h2>
              <p className="mt-4 text-sm text-muted-foreground">
                Découvre à quoi peut ressembler un voyage organisé avec KREW.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card shadow-elevated overflow-hidden max-w-4xl mx-auto">
              <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=1200&q=80')` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 backdrop-blur-sm px-2 py-0.5 rounded-full">Exemple de projet final</span>
                    <h3 className="font-display text-2xl sm:text-3xl font-bold mt-1">Week-end Retrouvailles à Lisbonne</h3>
                    <p className="text-xs text-white/80 mt-1">Organisé par Thomas · 8 personnes</p>
                  </div>
                </div>
              </div>

              <div className="p-6 grid gap-6 md:grid-cols-3 text-sm border-b border-border bg-surface/30">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Dates</p>
                  <p className="font-medium text-foreground">Vendredi 11 Sept. → Dimanche 13 Sept.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Budget estimé par personne</p>
                  <p className="font-medium text-foreground">~360 €</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase text-muted-foreground font-display">État des réponses</p>
                  <div className="flex gap-4">
                    <p className="text-xs">📅 Disponibilités : <span className="font-semibold text-emerald-600 dark:text-emerald-400">8/8</span></p>
                    <p className="text-xs">⚙️ Préférences : <span className="font-semibold text-emerald-600 dark:text-emerald-400">8/8</span></p>
                  </div>
                </div>
              </div>

              <div className="p-6 grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Check className="size-4 text-emerald-500" />
                    Hébergement retenu par le groupe
                  </h4>
                  <div className="rounded-2xl border border-border p-4 bg-background">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">Lisbon Sky Apartments</p>
                        <p className="text-xs text-muted-foreground">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p>
                      </div>
                      <Badge variant="success">5 votes sur 8</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground font-medium">42 € / personne par nuit · 84 € / personne pour le séjour</p>
                  </div>

                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Check className="size-4 text-emerald-500" />
                    Transports par ville de départ
                  </h4>
                  <ul className="space-y-2">
                    <li className="flex justify-between border-b border-border/40 pb-1.5 text-xs text-muted-foreground">
                      <span>Paris (5 personnes) · Vol EasyJet aller-retour</span>
                      <span className="font-semibold text-foreground">115 €</span>
                    </li>
                    <li className="flex justify-between border-b border-border/40 pb-1.5 text-xs text-muted-foreground">
                      <span>Lyon (3 personnes) · Vol Transavia aller-retour</span>
                      <span className="font-semibold text-foreground">125 €</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Check className="size-4 text-emerald-500" />
                    Extrait du planning jour par jour
                  </h4>
                  <div className="space-y-3">
                    <div className="relative pl-4 border-l-2 border-primary/30">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-semibold text-primary">JOUR 1 · 15:30</p>
                      <p className="font-semibold text-xs">Arrivée à l&apos;aéroport de Lisbonne et transfert</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">Dépose des bagages aux Lisbon Sky Apartments.</p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary/30">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-semibold text-primary">JOUR 1 · 19:30</p>
                      <p className="font-semibold text-xs">Dîner de Tapas locales chez Ramiro</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">Le resto mythique de fruits de mer plébiscité par le groupe.</p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary/30">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-semibold text-primary">JOUR 2 · 14:00</p>
                      <p className="font-semibold text-xs">Visite guidée en Tuk-Tuk électrique</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">Balade insolite dans les ruelles pavées de l&apos;Alfama.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Features ——— */}
        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 lg:grid-cols-12">
            <div className="lg:col-span-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary text-center">
                Ce que KREW fait pour toi
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold text-center mb-12">Moins de débats, plus de départ</h2>
              <div className="grid gap-4 sm:grid-cols-4">
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
          </div>
        </section>

        {/* ——— CTA final ——— */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-lagoon/15 to-background" />
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-24">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Ta prochaine légende commence ici
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Crée le voyage, invite le groupe et avancez ensemble, étape par étape.
            </p>
            <Button asChild variant="hero" size="xl" className="mt-8">
              <Link to="/trips/new">Créer mon voyage</Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">Gratuit pour démarrer · sans carte bancaire</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/30 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
          <Logo size="sm" withTagline />
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/mentions-legales" className="transition hover:text-primary">
              Mentions légales
            </Link>
            <Link to="/cgu" className="transition hover:text-primary">
              CGU
            </Link>
            <Link to="/confidentialite" className="transition hover:text-primary">
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
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/35 hover:shadow-glow">
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
