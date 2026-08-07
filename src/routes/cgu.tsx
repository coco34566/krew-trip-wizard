import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/krew/LegalPage";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — Krew" },
      { name: "description", content: "CGU du service Krew." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CguPage,
});

function CguPage() {
  return (
    <LegalPage title="Conditions générales d'utilisation">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions générales d&apos;utilisation (CGU) régissent l&apos;accès et
          l&apos;utilisation du service <strong>Krew</strong>, plateforme d&apos;organisation de
          voyages de groupe (création de voyage, invitations, questionnaires, suggestions).
        </p>
        <p>
          Toute utilisation du Service implique l&apos;acceptation sans réserve des présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="2. Inscription et compte">
        <p>
          L&apos;utilisation de certaines fonctionnalités nécessite la création d&apos;un compte
          (email / mot de passe ou connexion via un prestataire d&apos;authentification). Vous
          vous engagez à fournir des informations exactes et à conserver la confidentialité de vos
          identifiants. Vous êtes responsable de l&apos;activité réalisée via votre compte.
        </p>
      </LegalSection>

      <LegalSection title="3. Description du service">
        <p>Krew permet notamment de :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>créer un voyage et inviter des participants (lien de partage, email) ;</li>
          <li>collecter les préférences du groupe via questionnaire ;</li>
          <li>proposer des destinations et des estimations (budget, transport, hébergement) ;</li>
          <li>faciliter le vote et le suivi d&apos;organisation au sein du groupe.</li>
        </ul>
        <p>
          Les suggestions s&apos;appuient sur les réponses du groupe et, le cas échéant, sur des
          données provenant d&apos;API tierces. Elles sont fournies à titre d&apos;aide à la décision
          et ne constituent pas une offre contractuelle de voyage.
        </p>
      </LegalSection>

      <LegalSection title="4. Rôle de Krew — absence de qualité d'agence de voyages">
        <p>
          Krew n&apos;agit pas en qualité d&apos;agence de voyages ou de tour-opérateur. Aucun
          contrat de voyage n&apos;est conclu via Krew avec l&apos;éditeur. Les réservations,
          paiements et conditions commerciales relèvent exclusivement des prestataires tiers
          (compagnies, hôteliers, plateformes de réservation).
        </p>
      </LegalSection>

      <LegalSection title="5. Obligations de l'utilisateur">
        <p>Vous vous engagez à :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>utiliser le Service de manière loyale et conforme à la loi ;</li>
          <li>ne pas usurper l&apos;identité d&apos;autrui ni inviter des tiers sans base légitime ;</li>
          <li>
            ne pas tenter de perturber le Service (scraping abusif, contournement de sécurité, etc.) ;
          </li>
          <li>
            vérifier auprès des prestataires finaux toute information avant engagement financier.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Contenu et données de groupe">
        <p>
          Les organisateurs et participants sont responsables des informations qu&apos;ils saisissent
          (préférences, emails d&apos;invitation, notes). L&apos;éditeur peut supprimer tout contenu
          illicite ou contraire aux présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilité et évolution">
        <p>
          Le Service est fourni « en l&apos;état ». L&apos;éditeur peut modifier, suspendre ou
          interrompre tout ou partie du Service, notamment pour maintenance ou évolution produit.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité">
        <p>
          Dans les limites autorisées par la loi, l&apos;éditeur ne saurait être tenu responsable
          des dommages indirects, pertes de chance, écarts de prix ou indisponibilités de prestataires
          tiers. La responsabilité de l&apos;éditeur, si elle était engagée, serait limitée aux
          préjudices directs prouvés.
        </p>
      </LegalSection>

      <LegalSection title="9. Résiliation">
        <p>
          Vous pouvez cesser d&apos;utiliser le Service à tout moment. L&apos;éditeur peut suspendre
          ou résilier un compte en cas de manquement aux CGU ou de risque pour la sécurité du Service.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable et litiges">
        <p>
          Les CGU sont soumises au droit français. En cas de litige, les parties s&apos;efforceront
          de trouver une solution amiable avant toute action judiciaire.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
