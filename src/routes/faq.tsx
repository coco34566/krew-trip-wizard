import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/krew/SiteHeader";
import { Logo } from "@/components/krew/Logo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Krew" },
      { name: "description", content: "Une question sur Krew ? Retrouve toutes les réponses à tes questions ici." },
    ],
  }),
  component: FaqPage,
});

const FAQS = [
  {
    q: "Comment fonctionne l'organisation d'un voyage sur Krew ?",
    a: "C'est super simple ! Tu crées le voyage, tu indiques tes critères de base, et tu partages le lien d'invitation générique avec ton groupe. Chacun·e se connecte, remplit ses disponibilités sur un calendrier visuel et répond au questionnaire de préférences (budget, envies, transports...). Krew compile tout et génère les meilleures recommandations de destinations, avec plannings et offres réels !",
  },
  {
    q: "Mes ami·e·s doivent-ils/elles créer un compte pour répondre ?",
    a: "Oui, pour garantir la sécurité et s'assurer que chacun·e gère de façon autonome ses propres réponses et disponibilités, chaque participant·e crée un compte gratuit en quelques secondes (via email ou Google/Apple). Ainsi, personne ne peut modifier les réponses d'un·e autre !",
  },
  {
    q: "Qu'est-ce que « la star » du voyage ?",
    a: "Si tu organises un EVG, un EVJF ou un anniversaire, il y a souvent une personne mise à l'honneur. Tu peux la désigner comme « la star ». Ses préférences d'activités, ses contre-indications et ses envies auront un poids démultiplié (multiplié par 2,5 à 3,2) dans le calcul final pour que le voyage lui plaise à 100 % !",
  },
  {
    q: "Comment sont calculées les suggestions de destinations ?",
    a: "Krew utilise un moteur de scoring intelligent basé sur des critères objectifs : la météo réelle à tes dates, le budget maximum de chacun·e, le temps de transport depuis les villes de départ, les ambiances demandées, et la satisfaction globale de chaque participant·e pour éviter les déçus.",
  },
  {
    q: "Les propositions d'hôtels et d'activités sont-elles réelles ?",
    a: "Absolument ! Krew se connecte à de vraies plateformes de réservation partenaires (comme Booking.com ou TripAdvisor) pour te proposer de vrais hébergements disponibles et de véritables activités sur place avec des liens directs pour réserver.",
  },
  {
    q: "Puis-je gérer les dépenses du voyage sur l'app ?",
    a: "Oui ! Une brique de répartition des coûts interactive est incluse dans ton Dashboard. Une fois les réservations faites, elle te permet d'indiquer qui a payé quoi et de calculer automatiquement la part de chacun·e pour des remboursements sans prise de tête.",
  },
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
            La Foire Aux <span className="text-brand-gradient">Questions</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Tout ce que tu as toujours voulu savoir sur Krew, sans oser le demander.
          </p>
        </header>

        <section className="max-w-2xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {FAQS.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-2xl border border-border bg-card px-4 py-1"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <div className="mt-16 text-center p-6 bg-card/50 rounded-3xl border border-border">
          <h3 className="font-display text-lg font-semibold">Tu as une autre question ?</h3>
          <p className="text-xs text-muted-foreground mt-1">N&apos;hésite pas à nous écrire, on se fera un plaisir de t&apos;aider !</p>
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
