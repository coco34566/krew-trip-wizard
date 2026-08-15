# KREW — Politique de conservation des données

> Document de travail RGPD — version 1 — 15 août 2026.
> Cette politique doit être validée et adaptée à l'identité juridique de KREW, aux contrats fournisseurs et au modèle économique effectivement retenu avant lancement commercial.

## 1. Principe général

KREW ne conserve pas les données personnelles indéfiniment. Pour chaque finalité, une durée ou un critère de conservation doit être défini. À l'issue de cette période, la donnée est supprimée, anonymisée ou, lorsque la loi l'impose ou qu'elle est nécessaire à la constatation/exercice/défense d'un droit, archivée avec un accès restreint.

## 2. Compte actif

Les données nécessaires au fonctionnement du compte, aux voyages auxquels la personne participe et aux services demandés sont conservées pendant la durée de la relation avec KREW, puis pendant les durées spécifiques prévues ci-dessous lorsque leur conservation reste nécessaire.

## 3. Compte inactif

KREW retient comme règle opérationnelle une durée de **2 ans depuis la dernière action de l'utilisateur**. Avant l'échéance, KREW doit avertir l'utilisateur et lui permettre de maintenir son compte actif.

En l'absence d'action après l'avertissement, le compte est désactivé puis les données personnelles qui n'ont plus de finalité sont supprimées. Les données soumises à une obligation légale ou nécessaires à la preuve d'un droit sont traitées selon la section « archivage intermédiaire ».

Cette règle reprend la recommandation générale de la CNIL pour les comptes en ligne inactifs ; elle ne constitue pas une durée légale universelle applicable à toutes les données.

## 4. Suppression volontaire du compte

À la demande de l'utilisateur, KREW supprime sans délai indu les données personnelles qui n'ont plus de finalité ou de nécessité légale de conservation.

Certaines données peuvent être conservées en archivage intermédiaire lorsque cela est nécessaire pour respecter une obligation légale ou établir, exercer ou défendre un droit. Elles doivent être séparées de la base active, avec accès limité et suppression à l'expiration du délai applicable.

Les données collectives d'un voyage peuvent être conservées lorsqu'elles restent nécessaires aux autres participants, mais les identifiants et informations permettant d'identifier la personne supprimée doivent être retirés ou anonymisés lorsque possible.

## 5. Données comptables, fiscales et preuves

KREW conservera les données dont la conservation est imposée par la loi pendant la durée légale applicable. La durée exacte sera déterminée avec le professionnel compétent lorsque KREW aura une activité commerciale et comptable effective.

Les données conservées uniquement pour un éventuel contentieux sont archivées pour la durée nécessaire à la prescription applicable et ne restent pas accessibles dans la base opérationnelle courante.

## 6. Données utilisées pour l'IA KREW

L'utilisation de données KREW pour développer, entraîner, tester, maintenir ou améliorer un système d'IA constitue une finalité à documenter séparément. Elle ne donne pas un droit général de conserver toutes les données personnelles pendant toute la durée de vie du modèle.

KREW applique les principes suivants :

1. seules les données nécessaires à la finalité IA sont extraites ;
2. les données d'entraînement sont séparées logiquement de la base opérationnelle ;
3. les identifiants directs sont retirés lorsque leur présence n'est pas nécessaire ;
4. l'anonymisation est privilégiée lorsque la finalité peut être atteinte avec des données anonymes ;
5. à défaut d'anonymisation, les données sont pseudonymisées et restent soumises au RGPD ;
6. une durée de conservation spécifique est définie pour chaque jeu de données IA ;
7. les copies, exports, jeux de test et sauvegardes doivent suivre la même politique de conservation ;
8. lorsqu'une donnée personnelle doit être effacée, KREW doit pouvoir identifier les jeux de données IA concernés et appliquer la procédure d'effacement prévue ;
9. la possibilité de mémorisation de données personnelles par un modèle doit être évaluée ;
10. les fournisseurs IA externes ne doivent pas réutiliser les données KREW pour leur propre entraînement au-delà de ce qui est contractuellement et juridiquement autorisé.

## 7. Cycle de vie des données IA

### Développement / entraînement

Les jeux de données sont conservés uniquement pendant la période nécessaire au développement et aux entraînements planifiés. Chaque jeu doit avoir une date de création, une finalité, une version et une date de revue/suppression.

### Maintenance / amélioration

Après le développement initial, une conservation prolongée peut être justifiée pour l'audit, la mesure des biais, la maintenance ou l'amélioration du système, mais uniquement pour les données nécessaires, avec accès restreint et cloisonnement renforcé.

### Anonymisation

Lorsqu'une anonymisation robuste est possible et suffisante pour la finalité poursuivie, les données doivent être anonymisées dès que possible. Une donnée seulement pseudonymisée reste une donnée personnelle.

## 8. Modèles IA et droit à l'effacement

KREW ne considérera pas automatiquement qu'une suppression de compte permet d'« effacer » une information déjà apprise par un modèle. Le processus de gouvernance IA devra déterminer si les données ont été mémorisées et quelles mesures sont techniquement et juridiquement nécessaires : suppression du jeu source, réentraînement, retrait d'un modèle, ou autre mesure proportionnée.

Aucune promesse utilisateur d'effacement absolu du modèle ne doit être faite tant que cette capacité n'est pas techniquement garantie.

## 9. Données anonymisées et statistiques

Des données réellement anonymisées peuvent être conservées pour les statistiques, l'analyse de tendances, l'amélioration du produit et, le cas échéant, des usages commerciaux compatibles avec leur anonymisation. L'anonymisation doit empêcher raisonnablement la réidentification, y compris par recoupement avec les informations dont KREW dispose raisonnablement.

## 10. Fournisseurs IA et API externes

Pour chaque fournisseur, KREW doit documenter la conservation, les sous-traitants, les pays de traitement, les transferts internationaux, l'utilisation des données pour l'entraînement du fournisseur et les mécanismes de suppression.

Aucune donnée ne doit être envoyée à un fournisseur externe pour une finalité non documentée ou non nécessaire.

## 11. Automatisation à prévoir

Le système KREW devra à terme permettre :

- de suivre `last_activity_at` du compte ;
- d'identifier les comptes approchant 2 ans d'inactivité ;
- d'envoyer un avertissement ;
- de désactiver puis supprimer les données personnelles arrivées à échéance ;
- de distinguer base active et archivage intermédiaire ;
- de suivre les échéances de conservation par type de donnée ;
- de journaliser les opérations de suppression sans conserver inutilement les données supprimées ;
- de gérer les jeux de données IA et leurs dates de revue ;
- de traiter les demandes d'effacement avec traçabilité.

## 12. Référence réglementaire

Cette politique s'appuie notamment sur les principes du RGPD relatifs à la limitation de la conservation, à la minimisation, à la transparence et aux droits des personnes, ainsi que sur les recommandations et ressources CNIL relatives aux comptes inactifs, à la conservation des données et au développement des systèmes d'IA.
