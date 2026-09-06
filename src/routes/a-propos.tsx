import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Button } from "@/components/ui/button";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";
import { KrewOrganicBlob } from "@/components/krew/visual-language/KrewOrganicBlob";

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
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
        <header className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-2 relative">
          <KrewOrganicBlob
            tone="sage"
            variant="soft"
            className="absolute -top-10 -left-10 w-[200px] h-[150px] opacity-30 pointer-events-none"
          />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary font-mono relative z-10">
            Notre mission
          </p>
          <div className="relative inline-block z-10">
            <h1 className="font-display text-[40px] sm:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
              Pourquoi <span className="text-primary">KREW ?</span>
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-1/2 -bottom-2 h-5 w-[clamp(110px,38%,180px)] -translate-x-1/2 opacity-70 pointer-events-none"
            />
          </div>
          <p className="mt-4 text-base text-muted-foreground font-sans relative z-10 leading-relaxed">
            Voyager à plusieurs, c’est souvent la meilleure partie. L’organiser ne devrait pas être la pire.
          </p>
        </header>

        <article className="prose-krew space-y-9 text-sm sm:text-base leading-relaxed text-foreground/90">
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
              <KrewIcon name="group" tone="plum" size="sm" className="size-5" />
              Notre histoire
            </h2>
            <p>
              Tout a commencé lors de l&apos;organisation d&apos;un EVG. Entre celui qui n&apos;aime pas l&apos;avion, celle qui a un budget serré et les personnes qui ne répondent pas aux sondages de dates, organiser le séjour devenait vite compliqué.
            </p>
            <p>
              KREW est né pour rassembler au même endroit les disponibilités, les envies et les contraintes du groupe, puis aider à avancer des dates jusqu’au planning.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
              <KrewIcon name="planning" tone="plum" size="sm" className="size-5" />
              Notre philosophie
            </h2>
            <p>
              Chacun doit pouvoir partager ses préférences simplement, sans transformer l’organisation en une suite de débats et de tableaux à maintenir.
            </p>
            <p>
              KREW aide le groupe à y voir clair et à décider ensemble. L’application simplifie l’organisation, mais le dernier mot reste toujours au groupe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-2xl font-normal text-foreground flex items-center gap-2">
              <KrewIcon name="favorite" tone="plum" size="sm" className="size-5" />
              Pour les moments qui comptent
            </h2>
            <p>
              EVG, EVJF, anniversaire ou week-end entre amis : KREW accompagne le groupe du premier message jusqu’au départ.
            </p>
          </section>
        </article>

        <div className="mt-12 text-center py-8 border-t border-border/60 space-y-2">
          <h3 className="font-display text-2xl font-normal text-foreground">Prêt pour le prochain voyage ?</h3>
          <p className="text-sm text-muted-foreground font-sans">Crée ton voyage et invite le groupe.</p>
          <div className="pt-2">
            <Button asChild size="xl">
              <Link to="/trips/new">
                <KrewIcon name="plus" size="sm" className="size-4 shrink-0" />
                Créer mon voyage
              </Link>
            </Button>
          </div>
        </div>
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
