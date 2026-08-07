import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/krew/LegalPage";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Krew" },
      { name: "description", content: "Mentions légales du service Krew." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales">
      <LegalSection title="1. Éditeur du site">
        <p>
          Le site et l&apos;application <strong>Krew</strong> (ci-après « le Service ») sont édités par :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Raison sociale / nom</strong> : [À compléter — ex. Société XYZ ou Nom Prénom]
          </li>
          <li>
            <strong>Forme juridique</strong> : [À compléter — SAS, SARL, micro-entreprise…]
          </li>
          <li>
            <strong>Capital social</strong> : [À compléter] €
          </li>
          <li>
            <strong>Siège social</strong> : [Adresse complète]
          </li>
          <li>
            <strong>RCS / SIREN</strong> : [Numéro]
          </li>
          <li>
            <strong>N° TVA intracommunautaire</strong> : [Si applicable]
          </li>
          <li>
            <strong>Directeur de la publication</strong> : [Nom Prénom]
          </li>
          <li>
            <strong>Contact</strong> :{" "}
            <a className="text-primary underline" href="mailto:contact@krew.app">
              contact@krew.app
            </a>{" "}
            [à remplacer par votre email réel]
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Hébergement">
        <p>
          Le Service est hébergé via l&apos;infrastructure cloud de l&apos;éditeur de la plateforme de
          déploiement utilisée (ex. Lovable Cloud) et des prestataires techniques associés, notamment
          pour la base de données et l&apos;authentification (Supabase ou équivalent).
        </p>
        <p>
          Pour toute question relative à l&apos;hébergement, contactez l&apos;éditeur à l&apos;adresse
          indiquée ci-dessus.
        </p>
      </LegalSection>

      <LegalSection title="3. Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments du Service (marques, logos, textes, interfaces, structure,
          logiciels) est protégé par le droit de la propriété intellectuelle. Toute reproduction,
          représentation ou exploitation non autorisée est interdite.
        </p>
        <p>
          La marque et le logo <strong>Krew</strong> appartiennent à l&apos;éditeur. Les marques
          tierces éventuellement citées (compagnies aériennes, plateformes hôtelières, etc.)
          restent la propriété de leurs titulaires respectifs.
        </p>
      </LegalSection>

      <LegalSection title="4. Nature du service">
        <p>
          Krew est un outil d&apos;aide à l&apos;organisation de voyages de groupe (questionnaires,
          suggestions de destinations, estimation de budgets). Krew n&apos;est pas une agence de
          voyages au sens du Code du tourisme : le Service ne vend pas de billets ni d&apos;hébergements
          pour son propre compte. Les offres affichées sont fournies à titre indicatif via des
          sources et API tierces ; la réservation et le paiement s&apos;effectuent le cas échéant
          auprès des prestataires concernés.
        </p>
      </LegalSection>

      <LegalSection title="5. Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude des informations et le bon
          fonctionnement du Service, sans garantie d&apos;absence d&apos;erreurs ou d&apos;interruptions.
          Les estimations de prix, disponibilités et conditions de voyage peuvent évoluer et doivent
          être vérifiées auprès des prestataires finaux avant toute réservation.
        </p>
      </LegalSection>

      <LegalSection title="6. Droit applicable">
        <p>
          Les présentes mentions sont régies par le droit français. En cas de litige, et à défaut
          d&apos;accord amiable, les tribunaux français seront compétents.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
