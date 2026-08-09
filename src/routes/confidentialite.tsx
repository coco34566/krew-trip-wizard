import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/krew/LegalPage";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Krew" },
      { name: "description", content: "Politique de confidentialité et protection des données Krew (RGPD)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement des données personnelles collectées via Krew est l&apos;éditeur
          du Service, identifié dans les{" "}
          <a href="/mentions-legales" className="text-primary underline">
            mentions légales
          </a>
          .
        </p>
        <p>
          Contact vie privée :{" "}
          <a className="text-primary underline" href="mailto:privacy@krew.app">
            privacy@krew.app
          </a>{" "}
          [à remplacer par votre adresse réelle].
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <p>Selon votre usage, nous pouvons traiter notamment :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Compte</strong> : email, identifiant technique, éventuel nom d&apos;affichage ;
          </li>
          <li>
            <strong>Voyages</strong> : nom du voyage, dates, ville de départ, budget, préférences,
            contraintes ;
          </li>
          <li>
            <strong>Participants</strong> : emails d&apos;invitation, réponses au questionnaire
            (ambiances, activités, budget, ville de départ individuelle, etc.) ;
          </li>
          <li>
            <strong>Technique</strong> : logs de connexion, données de sécurité, cookies strictement
            nécessaires au fonctionnement.
          </li>
        </ul>
        <p>
          Krew n&apos;a pas vocation à collecter des données sensibles au sens du RGPD, sauf si vous
          les renseignez spontanément (ex. contraintes alimentaires, mobilité).
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <p>Nous traitons vos données personnelles (emails, prénoms, préférences de voyage) sur les bases légales suivantes :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Fourniture du Service</strong> (exécution du contrat ou mesures précontractuelles) :
            création et gestion de ton compte, création des voyages de groupe, invitations de tes ami·e·s, scoring et propositions de destinations adaptées, et calcul de la répartition des coûts.
          </li>
          <li>
            <strong>Consentement</strong> : pour le questionnaire de préférences et de disponibilités, et pour le dépôt des cookies non essentiels (analytiques, marketing) via notre bandeau de consentement.
          </li>
          <li>
            <strong>Intérêt légitime</strong> : pour la sécurité du site, la prévention des abus et fraudes, et l&apos;amélioration continue de notre produit (via des statistiques anonymes ou pseudonymisées).
          </li>
          <li>
            <strong>Cas particulier de « la star » (personne mise à l&apos;honneur)</strong> : Lorsqu&apos;un·e organisateur·rice renseigne les préférences et disponibilités d&apos;une personne tierce (« la star ») sans compte, il ou elle garantit avoir recueilli au préalable le consentement exprès de cette dernière pour la collecte et la transmission de ses préférences de voyage à Krew. Ces données sont exclusivement utilisées pour enrichir le scoring de ce voyage et ne servent à aucune autre finalité.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Destinataires">
        <p>
          Les données sont hébergées de manière sécurisée en Union européenne sur les serveurs de notre prestataire technique <strong>Supabase</strong> (Dublin, Irlande). Elles sont accessibles uniquement aux administrateurs de Krew et ne sont en aucun cas vendues à des tiers.
        </p>
        <p>
          Les participants d&apos;un même voyage peuvent voir certaines informations liées au groupe
          (ex. progression des réponses, propositions), selon le fonctionnement du produit.
        </p>
        <p>
          Des appels à des API tierces (recherche d&apos;hôtels, vols, etc.) peuvent transmettre des
          paramètres de recherche (ville, dates, nombre de personnes) strictement nécessaires à
          l&apos;obtention d&apos;une estimation. Ces prestataires agissent selon leurs propres
          conditions.
        </p>
      </LegalSection>

      <LegalSection title="5. Transferts hors UE">
        <p>
          Selon l&apos;hébergeur et les outils utilisés, des données peuvent être traitées en dehors
          de l&apos;Union européenne. Le cas échéant, des garanties appropriées (clauses
          contractuelles types, etc.) sont mises en place par les prestataires concernés.
        </p>
      </LegalSection>

      <LegalSection title="6. Durées de conservation">
        <p>
          Tes données de compte et de voyage sont conservées tant que ton compte est actif. En cas d&apos;inactivité prolongée de ton compte, tes données personnelles sont supprimées au bout de <strong>3 ans</strong> après ta dernière activité sur le Service. Les voyages inactifs et leurs questionnaires associés sont également purgés après un délai raisonnable.
        </p>
      </LegalSection>

      <LegalSection title="7. Vos droits (RGPD)">
        <p>
          Conformément au Règlement (UE) 2016/679 et à la loi Informatique et Libertés, vous disposez
          d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, de
          portabilité, et d&apos;opposition pour motifs légitimes.
        </p>
        <p>
          Pour les exercer :{" "}
          <a className="text-primary underline" href="mailto:privacy@krew.app">
            privacy@krew.app
          </a>
          . Vous pouvez également introduire une réclamation auprès de la{" "}
          <a
            className="text-primary underline"
            href="https://www.cnil.fr"
            target="_blank"
            rel="noreferrer"
          >
            CNIL
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          Le Service utilise des cookies essentiels nécessaires à l&apos;authentification de ton compte (gérés par Supabase) et au fonctionnement technique de l&apos;application. Aucun cookie non essentiel (cookies analytiques ou de personnalisation publicitaire) n&apos;est déposé sans ton consentement explicite recueilli via notre bandeau de cookies conforme (Accepter / Refuser / Personnaliser). Tu peux modifier tes choix à tout moment en vidant le cache de ton navigateur ou en cliquant sur le lien de politique de confidentialité.
        </p>
      </LegalSection>

      <LegalSection title="9. Sécurité">
        <p>
          Des mesures techniques et organisationnelles raisonnables sont mises en œuvre (contrôle
          d&apos;accès, chiffrement en transit, politiques d&apos;accès base de données). Aucun
          système n&apos;est infaillible ; signalez tout incident suspect à l&apos;éditeur.
        </p>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <p>
          La présente politique peut être mise à jour. La date de dernière mise à jour figure en
          tête de page. En cas de changement substantiel, une information pourra être affichée sur
          le Service.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
