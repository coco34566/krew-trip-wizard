import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Wallet, CalendarCheck, Users, MapPinned, Vote } from "lucide-react";

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
        content: "Répondez à un questionnaire, Krew construit le voyage complet. Sans passer des heures à chercher.",
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
    title: "1. Décrivez votre groupe",
    text: "Nombre de participants, âge, ambiance recherchée, ville de départ et budget par personne.",
  },
  {
    icon: Sparkles,
    title: "2. Krew analyse et propose",
    text: "Notre moteur croise budget, envies, contraintes, distance et saison pour scorer chaque destination.",
  },
  {
    icon: CalendarCheck,
    title: "3. Votez et partez",
    text: "Programme jour par jour, hébergement, activités et budget détaillé — validés en groupe.",
  },
];

const FEATURES = [
  { icon: MapPinned, title: "Destinations scorées", text: "Chaque proposition est justifiée : ambiance, saison, distance, prix moyens." },
  { icon: Wallet, title: "Budget transparent", text: "Transport, hébergement, activités et restauration détaillés par personne." },
  { icon: Vote, title: "Décision collective", text: "Invitez la bande, votez sur les propositions et validez ensemble." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden bg-hero-gradient">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <Badge variant="lagoon" className="mb-5">
                Assistant intelligent de voyages de groupe
              </Badge>
              <h1 className="text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                Organisez le voyage parfait avec vos amis,{" "}
                <span className="text-brand-gradient">sans passer des heures à chercher.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                Krew transforme un simple questionnaire en voyage clé en main : destination, hébergement,
                activités, transports, budget et planning jour par jour.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="hero" size="xl">
                  <Link to="/trips/new">Créer mon voyage</Link>
                </Button>
                <Button asChild variant="glass" size="xl">
                  <Link to="/auth">J'ai déjà un compte</Link>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <span
                    key={t.value}
                    className="rounded-full border border-border/70 bg-surface/60 px-3 py-1 text-xs text-muted-foreground"
                  >
                    {t.emoji} {t.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-3xl border border-border/60 shadow-elevated">
                <img
                  src={heroImage}
                  alt="Groupe d'amis trinquant au coucher du soleil sur un rooftop face à la mer"
                  width={1600}
                  height={1104}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="glass-panel absolute -bottom-6 left-4 right-4 rounded-2xl p-4 sm:left-8 sm:right-auto sm:w-72">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Exemple de proposition</p>
                <p className="mt-1 font-display text-lg font-semibold">EVG à Barcelone · 10 pers.</p>
                <p className="text-sm text-muted-foreground">Boat party, tapas tour, loft au Gothic — 342 € / pers.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">Comment ça marche</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Trois étapes, dix minutes, et le voyage est prêt à être validé par tout le groupe.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="rounded-3xl border border-border bg-card p-6 shadow-elevated">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <step.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lagoon/15 text-lagoon">
                  <f.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Votre prochaine légende commence ici</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Créez votre voyage, invitez la bande et laissez Krew s'occuper de la logistique.
          </p>
          <Button asChild variant="hero" size="xl" className="mt-8">
            <Link to="/trips/new">Lancer mon voyage</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <Logo className="text-base" />
          <p>© {new Date().getFullYear()} Krew — l'organisation de voyages de groupe, enfin simple.</p>
        </div>
      </footer>
    </div>
  );
}
