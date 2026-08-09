import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Check, HelpCircle } from "lucide-react";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — Krew" },
      { name: "description", content: "Découvre les tarifs de Krew. Organise tes voyages gratuitement." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
        <header className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Tarifs simples
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Gratuit pour démarrer, <span className="text-brand-gradient">sans friction.</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            On veut que tu puisses organiser tes voyages de groupe sans aucune barrière financière.
          </p>
        </header>

        <section className="grid gap-6 sm:grid-cols-1 max-w-md mx-auto">
          <div className="rounded-3xl border border-primary/30 bg-card p-6 shadow-glow flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold">Formule unique</p>
              <div className="mt-4 flex items-baseline">
                <span className="font-display text-4xl font-bold">0 €</span>
                <span className="text-muted-foreground ml-2">/ voyage</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Toutes nos fonctionnalités de base d&apos;organisation collective de voyage sont entièrement gratuites.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/80">
                {[
                  "Création de voyages de groupe illimités",
                  "Invitation illimitée de participant·e·s",
                  "Questionnaires de préférences et disponibilités",
                  "Moteur de scoring intelligent (3 à 4 propositions)",
                  "Planning collaboratif jour par jour",
                  "Brique de répartition des coûts incluse",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="hero" className="w-full">
                <Link to="/trips/new">Créer mon voyage gratuitement</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-xl font-bold text-center flex items-center justify-center gap-2">
            <HelpCircle className="size-5 text-primary" /> Des questions sur nos tarifs ?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 space-y-1">
              <h3 className="font-semibold">Comment Krew gagne de l&apos;argent ?</h3>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Nous touchons parfois des commissions d&apos;affiliation de nos partenaires (hôtels, vols ou activités) lorsque tu réserves directement via nos liens réels. C&apos;est totalement transparent pour toi et sans surcoût !
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 space-y-1">
              <h3 className="font-semibold">Y a-t-il des frais cachés ?</h3>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Aucun ! Krew est gratuit pour l&apos;organisateur·rice et pour tous les participant·e·s. Tu ne paies que tes réservations auprès des prestataires réels.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/30 py-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 text-xs text-muted-foreground">
          <Logo size="sm" />
          <p>© {new Date().getFullYear()} Krew — voyages de groupe simples</p>
        </div>
      </footer>
    </div>
  );
}

function Button({
  asChild,
  variant,
  className,
  children,
}: {
  asChild?: boolean;
  variant?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl text-sm font-medium transition cursor-pointer px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95",
        className,
      )}
    >
      {children}
    </span>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
