import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Check, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — KREW" },
      { name: "description", content: "Découvre les tarifs de KREW. Organise tes voyages gratuitement." },
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
            Gratuit pour démarrer, <span className="text-primary">simplement.</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            On veut que tu puisses organiser tes voyages de groupe sans aucune barrière financière.
          </p>
        </header>

        <section className="grid gap-6 sm:grid-cols-1 max-w-md mx-auto">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-primary font-semibold">Formule unique</p>
              <div className="mt-4 flex items-baseline">
                <span className="font-mono text-4xl font-bold">0 €</span>
                <span className="text-muted-foreground ml-2">/ voyage</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Toutes nos fonctionnalités de base d&apos;organisation collective de voyage sont entièrement gratuites.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/80">
                {[
                  "Création de voyages de groupe illimités",
                  "Invitations pour tout le groupe",
                  "Questionnaires de préférences et disponibilités",
                  "Propositions de destinations adaptées au groupe",
                  "Planning collaboratif jour par jour",
                  "Répartition des coûts",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-secondary mt-0.5" />
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
          <div className="divide-y divide-border/40 text-sm">
            <div className="py-4 space-y-1">
              <h3 className="font-semibold">Comment KREW se finance ?</h3>
              <p className="text-muted-foreground leading-relaxed text-xs">
                KREW peut percevoir une commission lorsque tu passes par certains liens partenaires. Cela n&apos;ajoute pas de frais au prix affiché par le partenaire.
              </p>
            </div>
            <div className="py-4 space-y-1">
              <h3 className="font-semibold">Y a-t-il des frais cachés ?</h3>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Non. KREW ne facture pas de frais supplémentaires dans l&apos;application. Les réservations sont payées directement auprès des prestataires concernés.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/30 py-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 text-xs text-muted-foreground">
          <Logo size="sm" />
          <p>© {new Date().getFullYear()} KREW — voyages de groupe simples</p>
        </div>
      </footer>
    </div>
  );
}
