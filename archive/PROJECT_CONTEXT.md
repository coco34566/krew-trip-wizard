# KREW — Contexte et architecture du projet

## 1. Présentation

KREW est une application de planification de voyages en groupe.

L'objectif est de permettre à plusieurs participants de renseigner leurs préférences, puis de produire des propositions de voyages cohérentes en tenant compte notamment :

- des disponibilités de chacun ;
- de la durée souhaitée du voyage ;
- du budget ;
- des préférences de destination ;
- des contraintes de transport ;
- des préférences d'hébergement ;
- des préférences individuelles et collectives ;
- de la qualité et de la cohérence des propositions générées.

Le produit doit privilégier une expérience simple, fluide et premium.

## 2. Architecture générale

KREW repose principalement sur :
- GitHub : versionnement du code et Pull Requests ;
- Vercel : build, déploiement et hébergement ;
- Supabase : base de données, authentification et fonctions backend ;
- APIs externes : données de voyage, transport, hébergement et disponibilité ;
- RapidAPI : passerelle vers certaines APIs externes lorsque cela est pertinent ;
- moteur de scoring : normalisation et classement intelligent des résultats.

L'architecture doit rester relativement indépendante des fournisseurs d'APIs externes.

## 3. Principe de séparation

Le code doit conserver une séparation claire entre interface utilisateur, logique métier, accès aux données, authentification, intégrations externes, normalisation, scoring et génération des propositions.

## 4. Données de voyage

La durée du voyage doit être traitée comme une donnée métier explicite. Lorsqu'une durée de voyage est définie au niveau du voyage/groupe, cette durée doit rester la référence. Jours, nuits et dates calendaires doivent être distingués correctement.

## 5. Authentification

Supabase Auth est utilisé pour l'authentification. Les flux navigateur, serveur, Server Functions et routes nécessitant une session doivent fonctionner correctement.

## 6. APIs externes

KREW doit éviter de dépendre inutilement d'un fournisseur précis. Les intégrations doivent idéalement récupérer, normaliser, limiter/cacher et vérifier les données avant présentation. Les secrets restent dans les variables d'environnement.

## 7. Scoring

Le scoring est une partie importante du produit. Une modification d'une source de données ne doit pas supprimer ou contourner le scoring existant sans raison explicite. Tout nouvel input doit être évalué sur ses effets sur scores, classement, extrêmes et données manquantes.

## 8. Principe général

Avant toute modification importante : comprendre la logique existante, identifier la cause réelle, modifier le minimum nécessaire, préserver les fonctionnalités validées, tester le parcours concerné, vérifier build, déploiement et checks.

> Archive historique. Les règles actuelles sont désormais centralisées dans les Skills KREW et la documentation spécialisée.
