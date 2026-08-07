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
      { title: "Krew — Organisez le voyage parfait avec vos amis" },
      {
        name: "description",
        content:
          "EVG, EVJF, week-end entre amis : Krew analyse votre groupe et propose destination, hébergement, activités, budget et planning jour par jour.",
      },
      { property: "og:title", content: "Krew — Le voyage de groupe, organisé pour vous" },
      {
        property: "og:description",
        content:
          "Répondez à un questionnaire, Krew construit le voyage complet. Sans passer des heures à chercher.",
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
    title: "Créez le voyage",
    text: "Type d'événement, effectif, et lien d'invitation pour la bande.",
  },
  {
    icon: CalendarCheck,
    title: "Chacun répond",
    text: "Dispos + préférences. Krew agrège le groupe automatiquement.",
  },
  {
    icon: Sparkles,
    title: "Krew propose",
    text: "Destinations scorées, planning, hôtels et trajets A/R.",
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
              Assistant intelligent de voyages de groupe
            </Badge>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Le voyage de groupe,{" "}
              <span className="text-brand-gradient">organisé pour vous.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Dispos, envies, budget : Krew assemble destination, hébergement, activités et
              trajets — pour que la bande vote et parte, sans tableau Excel.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/trips/new">Créer mon voyage</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="text-muted-foreground">
                <Link to="/auth">Se connecter</Link>
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

        {/* ——— Features + exemple score ——— */}
        <section className="border-y border-border bg-surface/50">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Ce que Krew fait pour vous
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">Moins de débats, plus de départ</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <FeatureCard
                  icon={MapPinned}
                  title="Destinations scorées"
                  text="Ambiance, saison, distance et budget : chaque ville est justifiée."
                />
                <FeatureCard
                  icon={Wallet}
                  title="Budget transparent"
                  text="Transport, hébergement, activités — estimés par personne."
                />
                <FeatureCard
                  icon={Vote}
                  title="Décision collective"
                  text="Invite, réponses de chacun, validation par l'organisateur."
                />
                <FeatureCard
                  icon={CalendarCheck}
                  title="Planning jour par jour"
                  text="Restos, activités, bars — et liens pour réserver hôtels & trajets."
                />
              </div>
            </div>

            {/* Card exemple score */}
            <div className="flex items-stretch lg:col-span-5">
              <div className="flex w-full flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-elevated">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Exemple de proposition
                  </p>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-semibold">Barcelone</p>
                      <p className="text-sm text-muted-foreground">Espagne · week-end EVG</p>
                    </div>
                    <span className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      87 %
                    </span>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {[
                      "Ambiance fête alignée au groupe",
                      "Budget ~340 € / pers. tout compris",
                      "Vols A/R depuis Paris & Lyon",
                      "Planning : boat party, tapas, Gothic",
                    ].map((line) => (
                      <li key={line} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-6 text-xs text-muted-foreground">
                  Score indicatif — généré à partir des questionnaires du groupe.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ——— CTA final ——— */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-lagoon/15 to-background" />
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-24">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Votre prochaine légende commence ici
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Créez le voyage, partagez le lien WhatsApp, laissez Krew assembler le reste.
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
            © {new Date().getFullYear()} Krew — l&apos;organisation de voyages de groupe, enfin
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
