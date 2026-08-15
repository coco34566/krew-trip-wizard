# KREW — Règles de développement

## 1. Règle principale
Toute modification doit résoudre le problème identifié tout en préservant les fonctionnalités déjà fonctionnelles. Ne pas réécrire une partie fonctionnelle du projet uniquement parce qu'une autre implémentation semble plus simple. Privilégier les modifications ciblées.

## 2. Avant de modifier du code
Identifier le fichier concerné, les fonctions utilisatrices, les dépendances, les comportements existants, les tests/workflows dépendants et la cause racine.

## 3. Préservation des fonctionnalités
Identifier entrées, sorties, consommateurs, effets secondaires et dépendances. Tester le parcours directement concerné et les parcours dépendants lorsqu'une zone critique est touchée.

## 4. Modifications minimales
Privilégier le moins de fichiers, le moins de logique modifiée, les interfaces conservées, les effets secondaires limités et les changements réversibles.

## 5. Authentification
Supabase Auth, JWT, middleware, cookies, sessions, tokens et Server Functions protégées sont sensibles. Après modification, vérifier connexion, session, refresh, fonction authentifiée et parcours concerné.

## 6. Base de données
Avant une modification de requête ou de schéma, vérifier schéma, usages, relations, RLS et données attendues frontend/backend.

## 7. Variables d'environnement
Ne jamais écrire de secret dans le code, Markdown, `.env` committé ou logs.

## 8. GitHub Actions
Rechercher les workflows existants. Les workflows temporaires doivent être supprimés après usage. Ne pas modifier le code pour satisfaire un script fragile ou obsolète.

## 9. Pull Requests
Vérifier diff, fichiers modifiés, checks, build, déploiement et fonctionnalité. Comprendre tout check rouge avant fusion.

## 10. Vercel
Vérifier build, Preview, fonctionnalité sur Preview puis production après fusion lorsque pertinent.

## 11. Non-régression
Une correction nécessite résolution du problème initial et préservation des fonctionnalités précédentes.

## 12. Communication
Indiquer modifications, raisons, fichiers, tests/checks, déploiement et éléments restant à vérifier.

> Archive historique. Le contenu durable a été réparti dans `.agents/skills/krew-core/SKILL.md` et `.agents/skills/krew-technical/SKILL.md`.
