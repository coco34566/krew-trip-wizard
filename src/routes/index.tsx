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
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary">
      <SiteHeader />

      <main>
        {/* ——— Hero Éditorial ——— */}
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">

              {/* Colonne gauche : Titre & Actions */}
              <div className="lg:col-span-7">
                <Badge variant="secondary" className="mb-6 rounded-full px-3.5 py-1 text-xs font-medium bg-secondary/60 text-foreground border border-border/80">
                  L’organisation des voyages de groupe, simplement
                </Badge>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-foreground leading-[1.08]">
                  Le voyage de groupe,{" "}
                  <span className="italic text-primary">organisé pour toi.</span>
                </h1>

                <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
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

                <ul className="mt-10 flex flex-wrap gap-2.5 sm:gap-3">
                  {TRUST.map((t) => (
                    <li
                      key={t}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground"
                    >
                      <Check className="size-3.5 text-secondary-foreground" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Colonne droite : Photo Cadre Éditorial */}
              <div className="lg:col-span-5">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-card shadow-sm">
                    <img
                      src={heroImage}
                      alt=""
                      className="h-[360px] sm:h-[440px] w-full object-cover"
                      fetchPriority="high"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />

                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <p className="font-display text-2xl font-normal leading-tight">
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
        <section className="border-y border-border bg-surface/50 py-4 sm:py-5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 sm:px-6">
            <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Idéal pour
            </span>
            {EVENT_TYPES.slice(0, 6).map((ev) => (
              <Link
                key={ev.value}
                to="/trips/new"
                className="rounded-full border border-border/80 bg-background px-3.5 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                {ev.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ——— Comment ça marche (stepper éditorial) ——— */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Comment ça marche
            </p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-normal text-foreground">
              Trois étapes, zéro chaos
            </h2>
          </div>

          <ol className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col items-center text-center sm:items-start sm:text-left rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between w-full mb-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary/30 text-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary font-mono">
                    Étape {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ——— Aperçu Projet Complet Fictif ——— */}
        <section className="border-t border-border bg-surface/40 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Aperçu interactif</p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-normal text-foreground">Un voyage complet, assemblé en direct</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Découvre à quoi peut ressembler un voyage organisé avec KREW.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden max-w-4xl mx-auto">
              <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555881403-64995e224d73?auto=format&fit=crop&w=1200&q=80')` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/40 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-white">Exemple de projet final</span>
                    <h3 className="font-display text-2xl sm:text-3xl font-normal mt-1.5 text-white">Week-end Retrouvailles à Lisbonne</h3>
                    <p className="text-xs text-white/80 mt-1">Organisé par Thomas · 8 personnes</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 grid gap-6 md:grid-cols-3 text-sm border-b border-border bg-surface/50">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dates</p>
                  <p className="font-medium text-foreground">Vendredi 11 Sept. → Dimanche 13 Sept.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Budget estimé par personne</p>
                  <p className="font-mono font-semibold text-foreground">~360 €</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">État des réponses</p>
                  <div className="flex gap-4">
                    <p className="text-xs">📅 Disponibilités : <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">8/8</span></p>
                    <p className="text-xs">⚙️ Préférences : <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">8/8</span></p>
                  </div>
                </div>
              </div>

              <div className="p-6 grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground">
                      <Check className="size-4 text-emerald-600" />
                      Hébergement retenu par le groupe
                    </h4>
                    <div className="rounded-xl border border-border p-4 bg-background">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-semibold text-foreground">Lisbon Sky Apartments</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Appartement entier · ★ 4.7 · Proche centre (0.8 km)</p>
                        </div>
                        <Badge variant="success" className="shrink-0">5 votes sur 8</Badge>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground font-mono">42 € / personne par nuit · 84 € / personne pour le séjour</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground">
                      <Check className="size-4 text-emerald-600" />
                      Transports par ville de départ
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                        <span>Paris (5 personnes) · Vol EasyJet aller-retour</span>
                        <span className="font-mono font-semibold text-foreground">115 €</span>
                      </li>
                      <li className="flex justify-between border-b border-border/60 pb-2 text-xs text-muted-foreground">
                        <span>Lyon (3 personnes) · Vol Transavia aller-retour</span>
                        <span className="font-mono font-semibold text-foreground">125 €</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground">
                    <Check className="size-4 text-emerald-600" />
                    Extrait du planning jour par jour
                  </h4>
                  <div className="space-y-3.5 pt-1">
                    <div className="relative pl-4 border-l-2 border-primary/40">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 15:30</p>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">Arrivée à l&apos;aéroport de Lisbonne et transfert</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Dépose des bagages aux Lisbon Sky Apartments.</p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary/40">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-mono font-semibold text-primary">JOUR 1 · 19:30</p>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">Dîner de Tapas locales chez Ramiro</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Le resto mythique de fruits de mer plébiscité par le groupe.</p>
                    </div>
                    <div className="relative pl-4 border-l-2 border-primary/40">
                      <span className="absolute -left-1.5 top-0.5 size-3 rounded-full bg-primary" />
                      <p className="text-xs font-mono font-semibold text-primary">JOUR 2 · 14:00</p>
                      <p className="font-semibold text-xs mt-0.5 text-foreground">Visite guidée en Tuk-Tuk électrique</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">Balade insolite dans les ruelles pavées de l&apos;Alfama.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ——— Features (Ce que KREW fait pour toi) ——— */}
        <section className="border-y border-border bg-background py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary text-center">
              Ce que KREW fait pour toi
            </p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-normal text-foreground text-center mb-14">
              Moins de débats, plus de départ
            </h2>
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
