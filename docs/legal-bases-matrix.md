# KREW — Matrice des bases légales

> Document de travail RGPD — version 1 — 15 août 2026.
> Les bases ci-dessous sont une qualification de travail à confirmer avant lancement commercial avec les finalités, les contrats et le modèle économique définitifs.

## Principe

Chaque finalité doit avoir sa propre base légale. Une même personne peut être concernée par plusieurs traitements ayant des bases différentes. Le consentement n'est donc pas à utiliser par défaut : la base la plus appropriée dépend de la finalité et des conditions concrètes du traitement.

## Matrice initiale

| Traitement / finalité | Données principales | Base de travail | Conditions / vigilance |
| --- | --- | --- | --- |
| Création et gestion du compte | identité, email, identifiants, paramètres | **Contrat / mesures précontractuelles** | Uniquement les données objectivement nécessaires au service. |
| Authentification et maintien de session | identifiant, tokens/session, données techniques | **Contrat** + sécurité selon le traitement | Nécessaire à l'accès au service ; distinguer les traceurs strictement nécessaires. |
| Création et gestion d'un voyage | créateur, participants, dates, destination, préférences | **Contrat** | Ne traiter que ce qui est nécessaire à l'organisation du voyage. |
| Questionnaire de préférences | préférences, contraintes, budget, disponibilités | **Contrat** lorsque nécessaire à la personnalisation demandée | Si une donnée révèle une catégorie particulière de données sensibles, analyse article 9 obligatoire avant collecte/utilisation. |
| Préférences de la Star | préférences et contraintes liées au voyage | **Contrat** si nécessaire au service demandé | Minimisation et contrôle d'accès renforcé. |
| Génération de recommandations | profil de recherche, contraintes, préférences | **Contrat** pour produire le service demandé | Ne pas envoyer aux fournisseurs IA plus de données que nécessaire. |
| Appels aux APIs voyage | destination, dates, voyageurs, critères | **Contrat** | Ne pas transmettre identité, email ou réponses libres si inutile. |
| Météo / géocodage | destination / coordonnées nécessaires | **Contrat** ou intérêt légitime selon finalité exacte | Pas d'identifiant utilisateur nécessaire. |
| Sécurité, prévention des abus et fraude | logs, IP, événements techniques, identifiants | **Intérêt légitime** | Faire une mise en balance documentée ; minimiser les logs et définir une durée. Certaines obligations peuvent également s'appliquer selon le cas. |
| Limitation de débit / protection API | identifiant, IP, événements techniques | **Intérêt légitime** / sécurité | Finalité limitée à la protection du service ; durée courte et proportionnée. |
| Journalisation technique | logs applicatifs, erreurs, événements | **Intérêt légitime** | Durée minimale nécessaire au diagnostic/sécurité ; ne pas journaliser des données inutiles. |
| Conservation comptable/fiscale | données de facturation et pièces concernées | **Obligation légale** | Uniquement lorsque KREW est soumis à l'obligation ; durée légale applicable. |
| Gestion d'un litige / défense des droits | données nécessaires à la preuve | **Intérêt légitime** ou **obligation légale**, selon le cas | Archivage intermédiaire, accès restreint et durée liée à la prescription/obligation applicable. |
| Mesure d'audience non essentielle | identifiants/événements de navigation | **Consentement** lorsque le traceur est soumis au consentement | Ne pas charger le fournisseur avant consentement. Les exemptions éventuelles doivent être vérifiées au cas par cas. |
| Personnalisation non nécessaire | préférences de navigation/profil | **Consentement** lorsqu'il s'agit d'un traceur ou traitement soumis au consentement | Ne pas conditionner le service principal au consentement non nécessaire. |
| Publicité personnalisée | signaux publicitaires/profilage | **Consentement** lorsque requis par les règles applicables aux traceurs et communications | Fournisseur, finalité, partage et durée à documenter. |
| Retargeting | identifiants publicitaires / événements | **Consentement** lorsque requis | Aucun chargement avant consentement ; retrait aussi simple que l'acceptation. |
| Réseaux sociaux / pixels | événements, identifiants publicitaires | **Consentement** lorsque requis | Documenter chaque pixel/fournisseur. |
| Affiliation / attribution | clics, identifiants/attribution | **Consentement** lorsque le dispositif utilise un traceur soumis au consentement ; autre base possible pour des opérations non-traceurs à qualifier | Ne pas confondre commission commerciale et base légale RGPD. |
| Prospection email non sollicitée | email, historique client/prospect | **Consentement** en principe pour les cas soumis à consentement | Vérifier les exceptions applicables aux clients existants et les règles ePrivacy françaises. |
| Prospection commerciale auprès de clients | coordonnées, historique relation | **Intérêt légitime** possible sous conditions | Vérifier finalité comparable, information et droit d'opposition ; ne pas généraliser à tous les canaux. |
| Amélioration du service / statistiques internes | événements d'utilisation, agrégats | **Intérêt légitime** possible | Mise en balance, minimisation, attentes raisonnables et possibilité d'opposition lorsque applicable. Anonymisation à privilégier lorsque possible. |
| Développement / entraînement IA KREW | données de questionnaires, résultats, interactions, signaux de préférence | **À déterminer par finalité et configuration** | Ne pas utiliser automatiquement la base « contrat ». Étudier intérêt légitime ou consentement selon le dispositif, les attentes, la nature des données et le contexte ; anonymisation à privilégier. |
| Évaluation / tests IA | jeux de données et résultats | **Même base que la finalité IA correspondante, à confirmer** | Dataset séparé, minimisé, durée définie. |
| Conservation de datasets IA | données personnelles ou anonymisées | **À déterminer** | Une donnée pseudonymisée reste personnelle. Les données réellement anonymisées peuvent être conservées plus longtemps. |
| Valorisation de données réellement anonymisées | statistiques, tendances, agrégats anonymisés | **Hors RGPD si anonymisation effective** | L'anonymisation doit être robuste et empêcher raisonnablement la réidentification. |
| Partage de données personnelles avec un partenaire pour sa propre finalité | données utilisateur | **À déterminer spécifiquement** | Ne pas utiliser le consentement cookies comme base générale. Identifier le responsable de traitement, la finalité et la base légale. |
| Exercice des droits | identité et données nécessaires à la vérification/traitement de la demande | **Obligation légale** | Conservation limitée aux besoins de preuve et de gestion des demandes. |
| Gestion des demandes de suppression | compte, identifiant, état de suppression | **Obligation légale** | Conserver seulement les éléments nécessaires à la traçabilité de la demande. |

## Points sensibles à traiter séparément

### 1. Questionnaire et données sensibles

Le questionnaire doit être audité champ par champ. Une préférence de voyage n'est pas automatiquement une donnée sensible, mais certaines réponses peuvent révéler indirectement une origine, religion, santé, orientation sexuelle, etc. Si une donnée entre dans une catégorie particulière de l'article 9 du RGPD, l'article 9 doit être traité en plus de l'article 6 : une simple base légale de l'article 6 ne suffit pas.

### 2. IA

La base « contrat » ne doit pas être utilisée simplement parce que l'IA améliore globalement le produit. La CNIL rappelle que l'amélioration d'un service n'est généralement pas nécessaire à l'exécution du contrat. Il faut donc qualifier séparément l'entraînement/amélioration IA et documenter la base retenue.

### 3. Cookies / ePrivacy

Le consentement aux traceurs relève également du cadre spécifique applicable aux cookies et autres traceurs ; le consentement RGPD et les règles cookies ne sont pas interchangeables. Le CMP doit conserver la preuve du choix et permettre son retrait.

### 4. Prospection

Les règles de prospection commerciale doivent être distinguées du consentement aux cookies. Email, SMS, téléphone et publicité personnalisée ne sont pas un seul traitement juridique.

### 5. Monétisation future

Une future valorisation commerciale de données personnelles doit faire l'objet d'une nouvelle analyse de finalité et de base légale. Le fait qu'un utilisateur ait accepté des cookies ne vaut pas consentement général à la vente, au partage ou à la réutilisation de son profil.

## Références de travail

- RGPD, article 6 — bases légales.
- RGPD, article 9 — catégories particulières de données.
- CNIL — « La licéité du traitement : l'essentiel sur les bases légales prévues par le RGPD ».
- CNIL — « Le contrat : dans quels cas fonder un traitement sur cette base légale ? ».
- CNIL — « L'intérêt légitime : comment fonder un traitement sur cette base légale ? ».
- CNIL — « Conformité RGPD : comment recueillir le consentement des personnes ? ».

## Statut

**🟢 Qualification initiale : réalisée**

**🟠 À approfondir :** données sensibles du questionnaire, IA/entraînement, prospection, affiliation, partenaires et transferts.

**🔴 Validation avant lancement :** bases légales définitives et documentation de la mise en balance pour les traitements fondés sur l'intérêt légitime.
