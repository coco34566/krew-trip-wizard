import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Button } from "@/components/ui/button";
import { KrewIcon, KrewMark, KrewHighlight } from "@/components/krew/visual-language";

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
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
        <header className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary font-mono">
            Tarifs simples
          </p>
          <div className="relative inline-block">
            <h1 className="font-display text-[40px] sm:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
              Organiser avec KREW, <span className="text-primary">c’est gratuit.</span>
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-1/2 -bottom-2 h-5 w-[clamp(110px,38%,180px)] -translate-x-1/2 opacity-70 pointer-events-none"
            />
          </div>
          <p className="mt-4 text-base text-muted-foreground font-sans">
            Crée ton voyage, invite le groupe et avance jusqu’au planning sans frais dans KREW.
          </p>
        </header>

        <section className="max-w-md mx-auto">
          <div className="rounded-[24px] border border-border/60 bg-card p-6 sm:p-8 shadow-2xs flex flex-col justify-between">
            <div>
              <p className="text-sm uppercase tracking-wider text-primary font-mono font-semibold">Formule unique</p>
              <div className="mt-4 flex items-baseline">
                <KrewHighlight tone="sage" className="font-mono text-4xl font-bold text-primary px-2 py-0.5">
                  0 €
                </KrewHighlight>
                <span className="text-muted-foreground font-sans text-sm ml-2">/ voyage</span>
              </div>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground font-sans leading-relaxed">
                Les fonctionnalités essentielles pour organiser le voyage avec ton groupe sont disponibles gratuitement.
              </p>
              <ul className="mt-6 space-y-3 text-sm sm:text-base text-foreground/85 font-sans">
                {[
                  "Création de voyages de groupe",
                  "Invitations pour tout le groupe",
                  "Questionnaires de préférences et disponibilités",
                  "Propositions de destinations adaptées au groupe",
                  "Planning collaboratif jour par jour",
                  "Répartition des coûts",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5 items-start">
                    <KrewIcon name="check" tone="sage" size="sm" className="size-4 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 text-center">
              <Button asChild className="w-full min-h-[48px] h-auto rounded-xl text-base font-medium whitespace-normal text-center leading-tight py-2.5">
                <Link to="/trips/new">
                  <KrewIcon name="plus" size="sm" className="size-4 shrink-0" />
                  Créer mon voyage gratuitement
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-14 sm:mt-16 space-y-5">
          <h2 className="font-display text-2xl font-normal text-foreground text-center">
            À savoir
          </h2>
          <div className="divide-y divide-border/40 text-sm sm:text-base font-sans border-y border-border/40">
            <div className="py-4 space-y-1.5">
              <h3 className="font-semibold text-foreground">Comment KREW se finance ?</h3>
              <p className="text-muted-foreground leading-relaxed">
                KREW peut percevoir une commission lorsque tu passes par certains liens partenaires. Cela n&apos;ajoute pas de frais au prix affiché par le partenaire.
              </p>
            </div>
            <div className="py-4 space-y-1.5">
              <h3 className="font-semibold text-foreground">Y a-t-il des frais cachés ?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Non. KREW ne facture pas de frais supplémentaires dans l&apos;application. Les réservations sont payées directement auprès des prestataires concernés.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/30 py-8">
        <div className="mx-auto flex max-w-3xl flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 text-sm text-muted-foreground">
          <Logo size="sm" />
          <p className="text-center sm:text-right">© {new Date().getFullYear()} KREW — voyages de groupe simples</p>
        </div>
      </footer>
    </div>
  );
}
