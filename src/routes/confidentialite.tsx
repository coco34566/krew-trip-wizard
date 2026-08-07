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
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Fourniture du Service</strong> (exécution du contrat / mesures précontractuelles) :
            compte, voyages, invitations, suggestions ;
          </li>
          <li>
            <strong>Sécurité et prévention des abus</strong> (intérêt légitime) ;
          </li>
          <li>
            <strong>Obligations légales</strong> le cas échéant ;
          </li>
          <li>
            <strong>Amélioration du produit</strong> (intérêt légitime, données agrégées ou
            pseudonymisées lorsque possible).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Destinataires">
        <p>
          Les données sont accessibles à l&apos;éditeur et aux prestataires techniques nécessaires
          au fonctionnement (hébergement, base de données, authentification — ex. infrastructure
          Lovable / Supabase). Elles ne sont pas vendues.
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
          Les données de compte et de voyage sont conservées tant que le compte est actif et pour la
          durée nécessaire à la fourniture du Service, puis archivées ou supprimées selon les
          obligations légales et les besoins de preuve (délais raisonnables, en principe max. 3 ans
          après la dernière activité sauf obligation contraire).
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
          Le Service utilise des cookies ou équivalents techniques nécessaires à l&apos;authentification
          et au fonctionnement (session). Aucun cookie publicitaire tiers n&apos;est déployé par
          défaut dans la version actuelle. En cas d&apos;ajout de traceurs non essentiels, un
          mécanisme de consentement sera mis en place.
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
