import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Users, Sparkles, Heart } from "lucide-react";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — Krew" },
      { name: "description", content: "Découvre l'histoire de Krew, notre mission et notre équipe passionnée." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
        <header className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Notre Mission
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Qui se cache derrière <span className="text-brand-gradient">Krew ?</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            On adore voyager entre ami·e·s, mais on déteste devoir relancer tout le monde sur WhatsApp ou remplir des fichiers Excel sans fin.
          </p>
        </header>

        <article className="prose-krew space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="size-5 text-primary" /> Notre histoire
            </h2>
            <p>
              Tout a commencé lors de l&apos;organisation d&apos;un EVG. Entre celui qui n&apos;aime pas l&apos;avion, celle qui a un budget serré, et les dix autres personnes qui ne répondent pas aux sondages de dates... On a bien failli abandonner. On s&apos;est rendu compte qu&apos;organiser un voyage de groupe était devenu un vrai parcours du combattant.
            </p>
            <p>
              C&apos;est pour ça qu&apos;on a créé <strong>Krew</strong>. Une application simple qui collecte les disponibilités de chacun·e, agrège les préférences, et conçoit pour ton groupe le voyage idéal : destination scorée, hébergements, activités et transports réels.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Notre philosophie
            </h2>
            <p>
              Chez Krew, on croit en la simplicité et en l&apos;équité. On pense que chaque participant·e doit pouvoir s&apos;exprimer librement, sans influence et en toute confidentialité, pour que l&apos;algorithme puisse proposer des suggestions justes et transparentes.
            </p>
            <p>
              On veut en finir avec les débats sans fin et les prises de tête. Avec notre solution de scoring intelligent, tu as enfin toutes les cartes en main pour prendre une décision rapide en groupe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Heart className="size-5 text-primary" /> Conçu pour toi
            </h2>
            <p>
              Que tu organises un EVG/EVJF, un anniversaire ou un week-end d&apos;escapade, on a pensé à tout pour te simplifier la vie. On améliore Krew chaque jour grâce à tes retours, alors n&apos;hésite pas à nous faire part de tes suggestions !
            </p>
          </section>
        </article>

        <div className="mt-12 text-center p-6 bg-card/50 rounded-3xl border border-border">
          <h3 className="font-display text-lg font-semibold">Prêt·e à tenter l&apos;expérience ?</h3>
          <p className="text-xs text-muted-foreground mt-1">Crée ton premier voyage et invite ta bande en 2 minutes.</p>
          <Button asChild className="mt-4" variant="hero">
            <Link to="/trips/new">Créer mon voyage</Link>
          </Button>
        </div>
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

// Simple fallback Button to avoid full import complexity
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
        "inline-flex items-center justify-center rounded-xl text-sm font-medium transition cursor-pointer px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95",
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
