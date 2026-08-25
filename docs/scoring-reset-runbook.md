# Vérification du reset des poids de scoring

Ce runbook accompagne `20260824203000_reset_test_tainted_scoring_weights.sql`.
Il est volontairement **read-only** tant que la PR qui protège l'apprentissage QA/E2E n'est pas validée et fusionnée.

## 1. Vérifier quels feedbacks alimentent actuellement le scoring

```sql
select
  t.id as trip_id,
  t.name as trip_name,
  count(*) as feedback_rows,
  count(*) filter (where sf.was_selected) as selected_rows
from public.scoring_feedback sf
join public.trips t on t.id = sf.trip_id
group by t.id, t.name
order by feedback_rows desc, t.name;
```

## 2. Vérifier la part TEST / QA / E2E / Demo

Le motif couvre aussi les noms historiques `Test15`, `TEST16`, etc.

```sql
select
  count(distinct sf.trip_id) as feedback_trips,
  count(distinct sf.trip_id) filter (
    where lower(coalesce(t.name, '')) ~ '(^|[^a-z0-9])(test([0-9]+|[^a-z0-9]|$)|qa([^a-z0-9]|$)|e2e([^a-z0-9]|$)|playwright([^a-z0-9]|$)|golden[ -]?path([^a-z0-9]|$)|demo([^a-z0-9]|$))'
  ) as excluded_test_trips,
  count(*) as feedback_rows,
  count(*) filter (
    where lower(coalesce(t.name, '')) ~ '(^|[^a-z0-9])(test([0-9]+|[^a-z0-9]|$)|qa([^a-z0-9]|$)|e2e([^a-z0-9]|$)|playwright([^a-z0-9]|$)|golden[ -]?path([^a-z0-9]|$)|demo([^a-z0-9]|$))'
  ) as excluded_test_rows
from public.scoring_feedback sf
join public.trips t on t.id = sf.trip_id;
```

## 3. Snapshot des poids AVANT reset

```sql
select
  event_type,
  ambiance_weight,
  activities_weight,
  budget_weight,
  distance_weight,
  season_weight,
  quality_weight,
  consensus_weight,
  min_satisfaction_weight,
  updated_at
from public.scoring_weights
order by event_type;
```

Conserver le résultat avant toute écriture. La migration de reset ne supprime ni voyages ni feedbacks : elle remet uniquement les poids de scoring à la baseline KREW.

## 4. Après merge seulement

Appliquer la migration `20260824203000_reset_test_tainted_scoring_weights.sql` via le mécanisme habituel de migrations Supabase. Ne pas exécuter un `UPDATE` manuel différent de la migration versionnée.

## 5. Vérifier APRÈS reset

Relancer la requête du point 3 et confirmer que les poids correspondent exactement à la migration versionnée. Puis confirmer que le code de recalibration déployé :

- exclut TEST / QA / E2E / Playwright / Golden Path / Demo, y compris `Test15` / `TEST16` ;
- exige au moins 20 voyages réels distincts ;
- exige au moins 8 voyages positifs distincts.

Aucune suppression de `scoring_feedback` n'est nécessaire : les lignes de test restent utiles pour le diagnostic, mais ne participent plus à l'apprentissage.
