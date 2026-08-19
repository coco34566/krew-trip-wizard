import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — KREW" },
      { name: "description", content: "Une question sur KREW ? Retrouve toutes les réponses à tes questions ici." },
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
      <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
        <header className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Des questions ?
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            La foire aux questions
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Les réponses aux questions les plus fréquentes sur KREW.
          </p>
        </header>

        <section className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full divide-y divide-border/50 border-y border-border/50">
            {FAQS.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b-0 py-1"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="mt-16 text-center py-8 border-t border-border/60">
          <h3 className="font-display text-2xl font-bold">Prêt à organiser ton prochain voyage ?</h3>
          <p className="text-xs text-muted-foreground mt-1">Crée ton voyage et invite le groupe.</p>
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
