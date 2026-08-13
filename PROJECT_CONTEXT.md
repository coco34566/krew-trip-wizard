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

---

## 2. Architecture générale

KREW repose principalement sur :

- GitHub : versionnement du code et Pull Requests ;
- Vercel : build, déploiement et hébergement ;
- Supabase : base de données, authentification et fonctions backend ;
- APIs externes : données de voyage, transport, hébergement et disponibilité ;
- RapidAPI : passerelle vers certaines APIs externes lorsque cela est pertinent ;
- moteur de scoring : normalisation et classement intelligent des résultats.

L'architecture doit rester relativement indépendante des fournisseurs d'APIs externes.

Les fournisseurs peuvent évoluer sans que la logique métier de KREW soit entièrement dépendante d'un fournisseur particulier.

---

## 3. Principe de séparation

Le code doit conserver une séparation claire entre :

- interface utilisateur ;
- logique métier ;
- accès aux données ;
- authentification ;
- intégrations externes ;
- normalisation des données ;
- scoring ;
- génération des propositions.

Une modification dans une couche ne doit pas inutilement modifier les autres couches.

---

## 4. Données de voyage

La durée du voyage doit être traitée comme une donnée métier explicite.

Lorsqu'une durée de voyage est définie au niveau du voyage/groupe, cette durée doit rester la référence pour les calculs qui en dépendent.

Il ne faut pas déduire silencieusement la durée finale à partir d'une moyenne de valeurs individuelles si une durée de voyage explicite existe.

Les dates, nuits et jours doivent être distingués correctement :

- une durée de `N` nuits correspond généralement à `N + 1` jours calendaires ;
- les calculs doivent utiliser l'unité appropriée selon le contexte ;
- une fonction ne doit pas confondre nombre de nuits et nombre de jours.

---

## 5. Authentification

Supabase Auth est utilisé pour l'authentification.

Les flux d'authentification doivent fonctionner à la fois :

- côté navigateur ;
- côté serveur ;
- dans les Server Functions ;
- dans les routes nécessitant une session utilisateur.

Les tokens doivent être correctement récupérés, rafraîchis et transmis aux fonctions qui en ont besoin.

Une modification du middleware d'authentification doit être considérée comme une modification sensible.

---

## 6. APIs externes

KREW doit éviter de dépendre inutilement d'un fournisseur précis.

Les intégrations externes doivent idéalement :

1. récupérer les données ;
2. normaliser les données ;
3. limiter les appels ;
4. utiliser le cache lorsque pertinent ;
5. effectuer une vérification finale des prix et disponibilités avant présentation à l'utilisateur.

Les secrets et clés API doivent rester dans les variables d'environnement.

Ils ne doivent jamais être hardcodés dans le code ou les fichiers Markdown.

---

## 7. Scoring

Le scoring de KREW est une partie importante du produit.

Une modification d'une source de données ne doit pas supprimer ou contourner le scoring existant sans raison explicite.

Lorsqu'une nouvelle donnée est ajoutée au scoring, il faut vérifier son impact sur :

- les scores existants ;
- le classement ;
- les résultats extrêmes ;
- les cas où certaines données sont absentes.

---

## 8. Principe général

Avant toute modification importante :

1. comprendre la logique existante ;
2. identifier la cause réelle du problème ;
3. modifier le minimum nécessaire ;
4. préserver les fonctionnalités déjà validées ;
5. tester le parcours utilisateur concerné ;
6. vérifier le build ;
7. vérifier le déploiement ;
8. vérifier les checks GitHub.

Une fonctionnalité n'est pas considérée comme corrigée simplement parce que le code compile.
