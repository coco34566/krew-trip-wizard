import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/krew/LegalPage";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — KREW" },
      { name: "description", content: "Politique de confidentialité et protection des données KREW (RGPD)." },
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
          Le responsable du traitement des données personnelles collectées via KREW est l&apos;éditeur
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
          </a>
          . Cette adresse pourra être remplacée par l&apos;adresse officielle de l&apos;éditeur lors de
          la mise en place de la structure juridique définitive.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <p>Selon votre usage, nous pouvons traiter notamment :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Compte</strong> : email, identifiant technique, prénom et, si KREW le collecte,
            nom ou nom d&apos;affichage, ainsi que les informations liées à la création et à la gestion du compte ;
          </li>
          <li>
            <strong>Voyages</strong> : nom du voyage, dates, ville de départ, budget, préférences,
            contraintes et informations nécessaires à l&apos;organisation du voyage ;
          </li>
          <li>
            <strong>Participants</strong> : informations d&apos;invitation, réponses aux questionnaires,
            préférences, disponibilités et informations nécessaires à la personnalisation du voyage ;
          </li>
          <li>
            <strong>Personne mise à l&apos;honneur (« la Star »)</strong> : lorsqu&apos;un organisateur renseigne
            ses préférences, disponibilités et informations nécessaires à l&apos;organisation du voyage ;
          </li>
          <li>
            <strong>Contenus et photos</strong> : contenus que les utilisateurs choisissent de transmettre
            au Service dans le cadre d&apos;un voyage ;
          </li>
          <li>
            <strong>Technique</strong> : données de connexion, sécurité, journaux techniques et éléments
            strictement nécessaires au fonctionnement et à la sécurisation du Service.
          </li>
        </ul>
        <p>
          Certaines réponses libres ou informations relatives à l&apos;alimentation, à la mobilité ou à
          l&apos;accessibilité peuvent, selon leur contenu, révéler des informations particulièrement
          sensibles. KREW demande de ne renseigner que les informations nécessaires au voyage et met en
          œuvre des mesures de protection adaptées. Les données ne sont pas réutilisées pour une finalité
          différente de celle annoncée sans fondement juridique approprié.
        </p>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <p>
          Les données sont traitées uniquement pour des finalités déterminées, explicites et légitimes,
          notamment :
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Fourniture du Service</strong> (exécution du contrat ou mesures précontractuelles) :
            création et gestion du compte, création des voyages de groupe, invitations, gestion des
            participants, questionnaires, organisation du voyage, calcul de la répartition des coûts,
            scoring et génération de propositions adaptées.
          </li>
          <li>
            <strong>Sécurité et prévention des abus</strong> (intérêt légitime, lorsque les conditions de
            ce fondement sont réunies) : sécurisation du Service, prévention des fraudes et des usages
            abusifs, détection et résolution des incidents.
          </li>
          <li>
            <strong>Amélioration du Service</strong> : analyse technique et fonctionnelle nécessaire à
            l&apos;amélioration de KREW, dans le respect de la base légale applicable et du principe de
            minimisation.
          </li>
          <li>
            <strong>Profilage et recommandations</strong> : KREW analyse les préférences renseignées par
            les membres d&apos;un voyage afin d&apos;identifier les besoins et préférences du groupe et de
            générer des recommandations personnalisées, notamment pour les destinations, activités,
            hébergements et organisation du voyage. Les recommandations constituent des suggestions et ne
            constituent pas, à elles seules, une décision produisant un effet juridique ou un effet
            significatif similaire à l&apos;égard d&apos;une personne.
          </li>
          <li>
            <strong>Consentement</strong> : lorsque celui-ci constitue la base légale requise pour une
            finalité particulière, notamment certains cookies et traceurs non essentiels ou certaines
            communications commerciales. Le consentement peut être retiré à tout moment dans les mêmes
            conditions de simplicité que son recueil.
          </li>
          <li>
            <strong>Cas particulier de « la Star »</strong> : lorsqu&apos;un organisateur renseigne les
            préférences et disponibilités d&apos;une personne tierce sans compte, il doit s&apos;assurer de
            disposer d&apos;un fondement juridique approprié pour transmettre ces informations à KREW et
            informer la personne concernée conformément au RGPD. Ces données sont utilisées pour
            l&apos;organisation et la personnalisation du voyage concerné.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Destinataires et partage des données">
        <p>
          Les données sont accessibles uniquement aux personnes et prestataires qui en ont besoin pour
          les finalités décrites dans la présente politique, avec des mesures d&apos;accès adaptées.
        </p>
        <p>
          Les participants d&apos;un même voyage peuvent voir certaines informations liées au groupe
          (par exemple certaines réponses ou propositions), selon le fonctionnement du produit et les
          règles d&apos;accès applicables au voyage.
        </p>
        <p>
          KREW peut utiliser des prestataires techniques, notamment pour l&apos;hébergement, la base de
          données, l&apos;authentification, les services applicatifs et la recherche d&apos;offres de voyage.
          Lorsque des API tierces sont utilisées pour rechercher des vols, hébergements ou activités,
          seuls les paramètres nécessaires à la recherche sont transmis lorsque cela est possible
          (par exemple destination, dates et nombre de personnes). Les prestataires concernés traitent
          les données selon leurs propres engagements et les instructions applicables.
        </p>
        <p>
          À ce jour, KREW ne vend pas les données personnelles des utilisateurs à des tiers. Toute
          nouvelle finalité de partage, de publicité ciblée ou de monétisation des données devra être
          définie, documentée et mise en œuvre avec le fondement juridique, l&apos;information et, lorsque
          nécessaire, le consentement appropriés avant son activation.
        </p>
      </LegalSection>

      <LegalSection title="5. Transferts hors Union européenne">
        <p>
          Certains prestataires techniques peuvent traiter des données en dehors de l&apos;Union européenne
          ou de l&apos;Espace économique européen. Lorsque cela est le cas, KREW met en œuvre les garanties
          requises par le RGPD, telles qu&apos;une décision d&apos;adéquation ou des garanties contractuelles
          appropriées, selon la situation. Les informations relatives aux prestataires concernés seront
          précisées et tenues à jour lorsque les fournisseurs utilisés par KREW seront définitivement
          sélectionnés.
        </p>
      </LegalSection>

      <LegalSection title="6. Durées de conservation et suppression du compte">
        <p>
          KREW ne conserve pas les données personnelles indéfiniment. Chaque catégorie de données est
          conservée pendant la durée nécessaire à la finalité pour laquelle elle a été collectée, sous
          réserve des durées imposées par la loi ou nécessaires à la constatation, à l&apos;exercice ou à la
          défense de droits en justice.
        </p>
        <p>
          Vous pouvez demander la suppression de votre compte directement depuis l&apos;espace « Mes
          informations ». La suppression entraîne la suppression des données personnelles qui n&apos;ont plus
          de raison légale d&apos;être conservées. Certaines données peuvent toutefois être conservées pendant
          la durée légalement nécessaire, notamment lorsqu&apos;une obligation légale, comptable, fiscale ou
          un litige le justifie. Ces données sont alors conservées séparément ou avec des mesures adaptées
          lorsque cela est nécessaire.
        </p>
        <p>
          Pour les comptes ou données inactifs, KREW applique des règles de purge définies en fonction des
          finalités et obligations applicables. Les éventuelles durées précises seront documentées dans la
          politique interne de conservation et mises à jour dans la présente politique lorsqu&apos;elles seront
          définitivement arrêtées.
        </p>
      </LegalSection>

      <LegalSection title="7. Utilisation des données par les systèmes d&apos;IA">
        <p>
          Les données personnelles collectées pour le fonctionnement de KREW ne sont pas automatiquement
          réutilisées pour entraîner des modèles d&apos;IA. Une utilisation ultérieure à des fins d&apos;entraînement,
          d&apos;amélioration de modèles ou de développement de nouveaux services constituerait une finalité
          distincte qui devra être définie, justifiée et documentée avant sa mise en œuvre.
        </p>
        <p>
          Le cas échéant, KREW appliquera les principes de minimisation, de limitation des finalités et de
          protection des données, et déterminera le fondement juridique approprié ainsi que les modalités
          d&apos;information et, lorsque nécessaire, de consentement ou d&apos;opposition des personnes concernées.
        </p>
      </LegalSection>

      <LegalSection title="8. Vos droits (RGPD)">
        <p>
          Conformément au Règlement (UE) 2016/679 et à la loi Informatique et Libertés, vous disposez,
          selon les conditions applicables, d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation, de portabilité et d&apos;opposition. Lorsque le traitement repose sur votre consentement,
          vous pouvez retirer celui-ci à tout moment sans remettre en cause la licéité des traitements
          effectués avant son retrait.
        </p>
        <p>
          Pour exercer vos droits :{" "}
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

      <LegalSection title="9. Cookies et traceurs">
        <p>
          KREW distingue les traceurs strictement nécessaires au fonctionnement du Service des traceurs
          nécessitant un consentement. Les traceurs nécessaires peuvent notamment être utilisés pour
          l&apos;authentification, la sécurité, la gestion de session et les fonctionnalités essentielles.
        </p>
        <p>
          KREW pourra à l&apos;avenir utiliser, après mise en place des mécanismes de consentement requis,
          des traceurs destinés notamment à la mesure d&apos;audience, à la personnalisation, à la publicité
          ciblée, au retargeting et aux fonctionnalités de réseaux sociaux. Ces finalités seront présentées
          de manière distincte afin de permettre un choix libre et granulaire.
        </p>
        <p>
          Les traceurs nécessitant un consentement ne seront pas déposés ou lus avant le consentement
          requis. Le choix pourra être retiré ou modifié simplement à tout moment. La liste des traceurs,
          leurs fournisseurs, finalités et durées sera tenue à jour dans le dispositif de gestion des
          cookies lorsqu&apos;ils seront activés.
        </p>
      </LegalSection>

      <LegalSection title="10. Sécurité">
        <p>
          KREW met en œuvre des mesures techniques et organisationnelles adaptées aux risques, notamment
          des contrôles d&apos;accès, des politiques de sécurité de la base de données, du chiffrement en
          transit et des mécanismes de protection des comptes et des données. L&apos;accès aux données est
          limité selon les besoins du Service.
        </p>
        <p>
          Aucun système n&apos;est infaillible. Toute vulnérabilité ou utilisation suspecte peut être signalée
          à l&apos;éditeur à l&apos;adresse de contact indiquée dans les mentions légales ou à l&apos;adresse vie privée
          ci-dessus.
        </p>
      </LegalSection>

      <LegalSection title="11. Modifications">
        <p>
          La présente politique peut être mise à jour pour tenir compte de l&apos;évolution de KREW, de ses
          prestataires ou de la réglementation. La date de dernière mise à jour figure en tête de page.
          En cas de changement substantiel affectant les personnes concernées, une information appropriée
          pourra être affichée sur le Service.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
