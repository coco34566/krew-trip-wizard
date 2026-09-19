# Migrations Supabase KREW

Ce dossier contient l’historique SQL versionné du projet. Les migrations sont appliquées **dans l’ordre lexicographique de leur nom**.

## Convention de nommage

Utiliser le format :

```
YYYYMMDDHHMMSS_description.sql
```

Le timestamp doit être unique. Si deux migrations sont créées la même seconde, incrémenter la seconde de la migration qui doit s’exécuter ensuite après avoir vérifié leurs dépendances SQL.

## Créer une migration

Créer un nouveau fichier horodaté. Ne jamais réutiliser le timestamp d’une migration existante.

Une migration déjà appliquée sur un environnement partagé est immuable : **ne jamais modifier, renommer ou supprimer son SQL après application**. Toute correction fonctionnelle doit passer par une nouvelle migration.

## Appliquer en local

Utiliser un projet Supabase local ou une base PostgreSQL locale isolée. Par exemple avec la CLI Supabase :

```sh
supabase start
supabase db reset
```

Ces commandes doivent viser uniquement l’environnement local. Ne jamais lancer `supabase db push`, `supabase db reset` ou du SQL ad hoc contre la base de production depuis un chantier de développement.

## Vérifier l’ordre

Avant merge :

1. vérifier l’unicité des timestamps ;
2. relire les dépendances entre tables, fonctions, policies et triggers ;
3. rejouer les migrations sur une base locale vierge ;
4. si le rejeu échoue sur un problème historique, documenter précisément la première migration fautive et proposer une correction séparée au lieu de réécrire silencieusement l’historique.

## Fichier historique `001_create_schema.sql`

`001_create_schema.sql` est un ancien prototype antérieur au schéma Supabase actuel. Le code applicatif et les migrations modernes n’utilisent plus ses tables `users`, `participants` ou `responses`. Il reste conservé pour traçabilité historique tant qu’une décision explicite de nettoyage n’est pas prise.

Attention : il crée aussi une table `trips` incompatible avec la migration Supabase réelle `20260806083946_09b1e5fe-2b7c-4f88-8fb0-16f6bd744520.sql`. Un rejeu naïf de tous les fichiers du dossier depuis `001_create_schema.sql` échoue donc sur cet historique ancien ; ne pas contourner ce point en modifiant une migration déjà appliquée.

## `examples.sql`

`examples.sql` est un exemple historique basé sur le prototype et ne décrit plus le schéma courant. Ne pas l’utiliser pour valider l’application actuelle.
