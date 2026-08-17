import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Users, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — KREW" },
      { name: "description", content: "Découvre l'histoire de KREW et notre mission." },
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
            Notre mission
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Pourquoi <span className="text-brand-gradient">KREW ?</span>
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
              C&apos;est pour ça qu&apos;on a créé KREW : une application qui rassemble les disponibilités et les préférences du groupe pour aider à construire le voyage, des dates au planning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Notre philosophie
            </h2>
            <p>
              Chez KREW, on croit en la simplicité et en l&apos;équité. Chacun doit pouvoir partager ses préférences librement pour que le groupe trouve un voyage qui lui ressemble.
            </p>
            <p>
              On veut réduire les débats sans fin et simplifier les décisions, sans décider à la place du groupe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Heart className="size-5 text-primary" /> Conçu pour toi
            </h2>
            <p>
              Que tu organises un EVG, un EVJF, un anniversaire ou un week-end, KREW t’aide à avancer avec le groupe.
            </p>
          </section>
        </article>

        <div className="mt-12 text-center p-6 bg-card/50 rounded-3xl border border-border">
          <h3 className="font-display text-lg font-semibold">Prêt pour le prochain voyage ?</h3>
          <p className="text-xs text-muted-foreground mt-1">Crée ton premier voyage et invite le groupe.</p>
          <Button asChild className="mt-4" variant="hero">
            <Link to="/trips/new">Créer mon voyage</Link>
          </Button>
        </div>
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
