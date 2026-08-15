# KREW — Legal & Compliance Roadmap

> **Document de pilotage interne — version 1 — 15 août 2026**
>
> Ce document centralise les décisions prises pendant l'audit juridique KREW et leur traduction technique. Il ne constitue pas un avis juridique. Les points marqués « validation juridique » devront être revus avec un professionnel compétent avant le lancement commercial.

## 1. Statut actuel de KREW

- KREW est encore en phase de projet et la société n'est pas encore créée.
- Les mentions légales, l'identité du responsable de traitement, les coordonnées officielles et les informations de société devront être complétées dès la création de la structure.
- L'objectif est de préparer l'architecture technique et documentaire dès maintenant pour éviter une refonte ultérieure.

## 2. Principes directeurs

KREW applique comme principes de conception :

- minimisation des données ;
- limitation des finalités ;
- limitation de la conservation ;
- sécurité et cloisonnement ;
- transparence ;
- respect des droits des personnes ;
- séparation entre données opérationnelles, données IA et données analytiques/commerciales lorsque leurs finalités diffèrent.

La durée de conservation doit être déterminée selon la finalité ou une obligation légale ; les données ne doivent pas être conservées indéfiniment. Les données arrivées au terme de leur durée doivent être supprimées, anonymisées ou, lorsque nécessaire, archivées avec accès restreint. Référence CNIL : 02/04/2026. 

## 3. Cookies et traceurs

### Décision

KREW conserve une expérience utilisateur simple :

**Tout accepter | Tout refuser | Personnaliser**

La personnalisation présente quatre grandes catégories :

1. **Traceurs nécessaires** — authentification, sécurité, fonctionnement et mémorisation du choix ;
2. **Mesure & amélioration** — audience et performance ;
3. **Personnalisation & publicité** — personnalisation, publicité, retargeting et réseaux sociaux ;
4. **Partenaires & affiliation** — suivi de l'affiliation et conversions partenaires.

Le système est préparé pour accueillir les futurs fournisseurs sans charger un traceur non essentiel avant le consentement requis.

### Règle d'évolution

L'ajout futur d'un fournisseur ne doit pas être considéré comme couvert automatiquement par le consentement existant. La finalité, le fournisseur et les informations nécessaires devront être documentés avant activation.

## 4. Fournisseurs et traitements externes

Inventaire technique actuel documenté dans `docs/data-processing-inventory.md` :

- Supabase — base, Auth, Storage ;
- Vercel — hébergement/exécution ;
- RapidAPI — passerelle vers des APIs voyage/hébergement ;
- fournisseurs voyage connectés via RapidAPI ;
- Open-Meteo — géocodage/météo ;
- AIMLAPI / OpenAI — fournisseurs IA configurables ;
- affiliation prévue : Kayak, Booking, Omio, GetYourGuide.

Pour chaque fournisseur, KREW doit documenter avant commercialisation : rôle, données transmises, finalités, durée de conservation, sous-traitants, pays de traitement, DPA, mécanisme de transfert international et modalités d'effacement.

## 5. Transferts internationaux

Un traitement hors EEE n'est pas interdit en soi. Lorsqu'un transfert international existe, KREW doit identifier le pays, le fournisseur, le mécanisme juridique applicable et les mesures supplémentaires nécessaires.

Aucun pays, DPA ou mécanisme de transfert ne doit être affirmé dans les documents publics sans vérification auprès du fournisseur concerné et de la configuration effectivement utilisée par KREW.

## 6. Conservation des données

### Compte actif

Les données nécessaires au fonctionnement du compte et aux services demandés sont conservées pendant la relation et selon les durées spécifiques applicables à chaque finalité.

### Compte inactif

Règle opérationnelle retenue : **2 ans depuis la dernière action de l'utilisateur**, avec avertissement préalable. À défaut de réaction, désactivation puis suppression des données personnelles qui n'ont plus de finalité.

La CNIL indique qu'une suppression après deux ans sans action est proportionnée de manière générale pour les comptes en ligne et recommande d'avertir l'utilisateur avant l'échéance. Cette durée n'est pas une durée légale universelle : les finalités et obligations particulières doivent toujours être examinées. 

### Suppression volontaire

L'utilisateur doit pouvoir demander la suppression de son compte. Les données personnelles qui n'ont plus de finalité doivent être supprimées sans délai indu.

Certaines données peuvent rester en **archivage intermédiaire** lorsqu'une obligation légale l'impose ou lorsqu'elles sont nécessaires à la constatation, l'exercice ou la défense d'un droit, pour la durée applicable et avec accès restreint.

### Données collectives

La suppression d'un participant ne doit pas détruire des données nécessaires aux autres membres d'un voyage. Lorsque possible, les informations relatives à la personne supprimée doivent être désidentifiées plutôt que de conserver son identité dans les données collectives.

### Données anonymisées

Les données réellement anonymisées peuvent être conservées pour statistiques, amélioration du produit et futurs usages compatibles avec leur anonymisation. Une simple pseudonymisation ne rend pas une donnée anonyme : elle reste une donnée personnelle.

## 7. IA KREW

### Principe

L'utilisation des données pour développer, tester, entraîner, maintenir ou améliorer une IA constitue une finalité qui doit être documentée séparément. Elle ne justifie pas une conservation illimitée des données personnelles.

### Architecture cible

**Base opérationnelle**
→ fonctionnement du service

**Jeux de données IA séparés**
→ développement / entraînement / évaluation / amélioration

**Données réellement anonymisées**
→ statistiques / tendances / usages commerciaux compatibles

### Règles

- extraire uniquement les données nécessaires ;
- retirer les identifiants directs lorsque leur présence n'est pas nécessaire ;
- privilégier l'anonymisation lorsque la finalité le permet ;
- si pseudonymisation seulement, appliquer le RGPD ;
- attribuer une durée et une date de revue à chaque dataset ;
- inclure les copies, exports, jeux de test et sauvegardes dans le cycle de vie ;
- documenter les données envoyées aux fournisseurs IA externes ;
- vérifier que ces fournisseurs ne réutilisent pas les données KREW pour leur propre entraînement au-delà de ce qui est juridiquement et contractuellement autorisé ;
- évaluer la capacité de KREW à traiter les demandes d'effacement concernant les datasets et les modèles.

KREW ne promettra pas un effacement absolu d'une information déjà apprise par un modèle tant que la capacité technique correspondante n'est pas garantie.

## 8. Monétisation / valorisation future des données

La volonté future de valoriser les données KREW ne permet pas de conserver ou de partager librement toutes les données utilisateurs.

Architecture cible :

- données personnelles opérationnelles : service KREW ;
- données IA : finalité IA documentée et cloisonnée ;
- données anonymisées : statistiques, tendances et usages commerciaux possibles si l'anonymisation est réelle ;
- tout partage de données personnelles avec un partenaire pour sa propre finalité doit faire l'objet d'une analyse juridique spécifique et d'une information/base légale appropriée.

Le consentement cookies ne doit pas être présenté comme un consentement général à la monétisation des données personnelles.

## 9. Suppression de compte — état technique

Un mécanisme backend `public.delete_my_account()` a été ajouté dans Supabase.

Il supprime notamment :

- le profil ;
- les préférences et disponibilités personnelles ;
- certains votes et données personnelles liées au participant ;
- les références personnelles dans les voyages lorsque possible ;
- l'identité Auth Supabase.

### Reste à faire

- interface « Supprimer mon compte » ;
- confirmation explicite ;
- déconnexion et redirection ;
- gestion complète de l'archivage intermédiaire ;
- automatisation de la règle des deux ans d'inactivité ;
- procédure d'effacement des datasets IA ;
- traitement des sauvegardes et copies externes ;
- journalisation minimale des suppressions sans conserver inutilement les données supprimées.

## 10. Sécurité

Les travaux de sécurité KREW sont suivis séparément dans les audits techniques. Les éléments relatifs aux données personnelles doivent être raccordés à ce document lorsqu'ils ont un impact juridique : contrôle d'accès, exposition de données, secrets, logs, fournisseurs, RLS, suppression et sauvegardes.

## 11. Documents associés

- `docs/data-processing-inventory.md` — inventaire technique des traitements et fournisseurs.
- `docs/data-retention-policy.md` — politique de conservation et cycle de vie, incluant l'IA.
- Politique de confidentialité — document public à finaliser avec les informations de la société et les fournisseurs effectivement actifs.
- Politique cookies — document public à finaliser avec les traceurs effectivement actifs.
- CGU — à finaliser avant lancement commercial.
- Mentions légales — à finaliser après création de la société.

## 12. Statuts de conformité

**🟢 Implémenté** — mécanisme CMP préparé ; inventaire technique initial ; politique de conservation ; suppression backend.

**🟡 Décidé / à implémenter** — interface de suppression ; automatisation des comptes inactifs ; cloisonnement et cycle de vie des datasets IA ; gestion des sauvegardes ; centre de préférences accessible après consentement.

**🟠 À vérifier fournisseur** — DPA, sous-traitants, pays, transferts, conservation et réutilisation IA pour chaque fournisseur.

**🔴 Validation juridique avant commercialisation** — identité du responsable de traitement, bases légales définitives, politique de confidentialité, CGU, mentions légales, modèle de monétisation des données personnelles et tout traitement nouveau à risque élevé.

## 13. Journal des décisions — 15 août 2026

- KREW ne sera pas intermédiaire de paiement ; les fonctionnalités « Dépenses du groupe » et « Répartition du budget » sont conservées.
- Le CMP doit rester simple pour l'utilisateur tout en préparant les futures catégories marketing et partenaires.
- Le retargeting, les réseaux sociaux, la personnalisation publicitaire et l'affiliation sont prévus dans l'architecture mais ne doivent être activés qu'avec les fournisseurs réellement retenus et le consentement requis.
- La conservation des données suit la logique : finalité → durée nécessaire → suppression/anonymisation → archivage intermédiaire si obligation légale ou contentieux.
- Une règle opérationnelle de deux ans d'inactivité est retenue pour les comptes en ligne, avec avertissement préalable, sous réserve des exceptions et finalités particulières.
- Les données utilisées pour l'IA doivent être traitées comme une finalité distincte et ne doivent pas être conservées indéfiniment simplement parce qu'elles sont utiles à l'entraînement.
- L'anonymisation est privilégiée pour les futures statistiques et valorisations lorsque possible.
- La monétisation future de données personnelles nécessitera une analyse spécifique ; elle n'est pas couverte automatiquement par le consentement cookies.
