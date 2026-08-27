import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";
import { KrewMark } from "@/components/krew/visual-language/KrewMark";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — KREW" },
      { name: "description", content: "Une question sur KREW ? Retrouve les réponses aux questions les plus fréquentes." },
    ],
  }),
  component: FaqPage,
});

const FAQS = [
  { q: "Comment fonctionne l’organisation d’un voyage sur KREW ?", a: "Tu crées le voyage, tu invites le groupe, puis chacun indique ses disponibilités et ses préférences. KREW rassemble les réponses pour proposer les dates et les options qui correspondent le mieux au groupe." },
  { q: "Faut-il créer un compte pour participer ?", a: "Oui. Chaque personne utilise son propre compte pour renseigner et modifier ses disponibilités et ses préférences en toute autonomie." },
  { q: "Qu’est-ce que la Star du voyage ?", a: "Pour certains voyages comme un EVG, un EVJF ou un anniversaire, tu peux désigner la personne mise à l’honneur comme Star. En mode secret, l’organisation peut compléter ses préférences sans lui dévoiler la surprise. En mode participant, elle rejoint le groupe et répond comme les autres." },
  { q: "Comment sont proposées les destinations ?", a: "KREW tient compte des réponses du groupe : budget, envies, disponibilités, départs, transports acceptés et autres contraintes du voyage. Les propositions servent à aider le groupe à choisir." },
  { q: "Les prix et disponibilités sont-ils garantis ?", a: "Non. Les prix et disponibilités peuvent évoluer. Lorsqu’un lien de réservation est proposé, vérifie toujours le tarif et les conditions au moment de réserver." },
  { q: "Puis-je gérer les dépenses du voyage ?", a: "Oui. KREW peut estimer et répartir les coûts du voyage pour indiquer la part de chacun. Les paiements et remboursements restent effectués directement entre les participants." },
];

function FaqPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
        <header className="text-center max-w-2xl mx-auto mb-10 sm:mb-12 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary font-mono">
            Des questions ?
          </p>
          <div className="relative inline-block">
            <h1 className="font-display text-[40px] sm:text-[48px] font-normal leading-[0.95] tracking-tight text-foreground">
              La foire aux questions
            </h1>
            <KrewMark
              type="underline-wave"
              tone="sage"
              size="md"
              className="absolute left-1/2 -bottom-2 h-5 w-[clamp(110px,38%,180px)] -translate-x-1/2 opacity-70 pointer-events-none"
            />
          </div>
          <p className="mt-4 text-base text-muted-foreground font-sans">
            Les réponses aux questions les plus fréquentes sur KREW.
          </p>
        </header>

        <section className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full divide-y divide-border/50 border-y border-border/50">
            {FAQS.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b-0 py-1">
                <AccordionTrigger className="text-left text-base font-semibold hover:no-underline py-4.5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-sm sm:text-base pb-5 pr-2">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="mt-14 sm:mt-16 text-center py-8 border-t border-border/60 space-y-2">
          <h3 className="font-display text-2xl font-normal text-foreground">Prêt à organiser ton prochain voyage ?</h3>
          <p className="text-sm text-muted-foreground font-sans">Crée ton voyage et invite le groupe.</p>
          <div className="pt-2">
            <Button asChild className="rounded-xl min-h-[44px] h-auto whitespace-normal text-center leading-tight py-2.5 px-5">
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
