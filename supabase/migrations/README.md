# Supabase migrations

Les fichiers de ce dossier constituent l’historique ordonné du schéma KREW.

## Convention de nommage

Utiliser un préfixe horodaté unique au format `YYYYMMDDHHMMSS_description.sql`. Deux migrations ne doivent jamais partager le même timestamp. L’ordre lexicographique des noms de fichiers est l’ordre d’exécution.

`001_create_schema.sql` est une migration historique de fondation : elle crée les premières tables (`users`, `trips`, `participants`, `responses`, etc.) sur lesquelles les migrations suivantes se sont construites. Elle ne doit pas être supprimée tant que l’historique complet n’a pas été consolidé sur une nouvelle base.

## Créer une migration

Préférer la CLI Supabase :

```bash
supabase migration new ma_modification
```

Écrire uniquement la transformation nécessaire. Ne pas modifier une migration déjà appliquée sur un environnement partagé : ajouter une nouvelle migration corrective.

## Vérifier localement

La vérification de référence se fait sur une base locale vierge, jamais sur la production :

```bash
supabase start
supabase db reset
```

Le reset local doit rejouer toutes les migrations dans l’ordre. En CI, utiliser le même principe sur une instance éphémère.

## Appliquer

Après validation locale et revue, les migrations sont appliquées par le mécanisme de déploiement prévu pour l’environnement cible. Ne jamais lancer manuellement `supabase db push`, `supabase db reset` ou du SQL distant contre la production depuis un poste ou un agent d’automatisation.

## Historique

Les migrations anciennes restent immuables. En cas d’erreur découverte après application, créer une nouvelle migration avec un timestamp supérieur et documenter la correction dans la PR.

## Exemples historiques

`examples.sql` correspondait au prototype initial et ne reflète plus le schéma courant. Il est conservé uniquement comme archive et ne doit pas être exécuté.
