# Supabase Migrations — Exécution et exemples

Ce répertoire contient la migration SQL initiale pour créer le schéma Krew (supabase/migrations/001_create_schema.sql).

Ce fichier README explique comment exécuter la migration et fournit des exemples d'INSERT/SELECT pour tester rapidement.

---

## 1) Exécuter la migration (Supabase)

- Ouvrir le projet dans Supabase
- Aller dans SQL Editor
- Ouvrir `supabase/migrations/001_create_schema.sql` (ou coller le contenu)
- Cliquer sur "Run"

Assure-toi que l'utilisateur de la base a le droit d'activer l'extension pgcrypto (CREATE EXTENSION IF NOT EXISTS "pgcrypto"). Si Supabase bloque l'activation d'extension (rare), contacte le support Supabase ou supprime la ligne d'extension et génère les UUIDs autrement.

## 2) Exécuter la migration en local (psql)

- Récupère l'URL de connexion Postgres depuis Supabase (Settings → Database → Connection string)
- Exécute depuis ton poste :

psql "host=<HOST> port=<PORT> dbname=<DB> user=<USER> password=<PASSWORD> sslmode=require" -f supabase/migrations/001_create_schema.sql

Remplace les valeurs par celles fournies par Supabase.

## 3) Tests rapides (exemples SQL)

Ci‑dessous des requêtes d'insertion et de vérification pour valider que les tables fonctionnent correctement. Remplace `<owner_id>` et `<trip_id>` par les valeurs retournées lors des INSERTs.

-- Insérer un utilisateur de test
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice') RETURNING id;

-- Insérer un voyage de test (copier l'id retourné pour owner_id)
INSERT INTO trips (owner_id, name, type, start_date, end_date, budget_per_person) VALUES ('<owner_id>', 'EVG Barcelone', 'EVG', '2026-09-10', '2026-09-12', 350) RETURNING id;

-- Inviter un participant
INSERT INTO participants (trip_id, email, name, accepted) VALUES ('<trip_id>', 'bob@example.com', 'Bob', true) RETURNING id;

-- Enregistrer une réponse individuelle
INSERT INTO responses (trip_id, participant_id, answers) VALUES ('<trip_id>', '<participant_id>', '{"availability":["2026-09-10","2026-09-11"], "ambiance":"fête", "activities":["bars","plage"], "budget_max":400}'::jsonb) RETURNING id;

-- Vérifier les données
SELECT * FROM users LIMIT 10;
SELECT * FROM trips WHERE id = '<trip_id>';
SELECT answers FROM responses WHERE trip_id = '<trip_id>';

## 4) Exemple d'agrégation simple (prototype pour scoring)

-- Calcule budget moyen et liste des activités choisies
SELECT
  t.id as trip_id,
  AVG((r.answers ->> 'budget_max')::numeric) AS avg_budget_max,
  jsonb_agg(DISTINCT elem) AS activities
FROM trips t
LEFT JOIN responses r ON r.trip_id = t.id
LEFT JOIN LATERAL jsonb_array_elements_text(coalesce(r.answers -> 'activities','[]'::jsonb)) AS elem ON true
WHERE t.id = '<trip_id>'
GROUP BY t.id;

---

Si tu veux, je peux aussi :
- créer une Pull Request automatique vers `main` (pré‑remplie) — il te restera à la vérifier et merger ;
- ajouter un script Node/TS pour exécuter la migration via psql ou via l'API Supabase ;
- ajouter une page d'exemples dans le repo (docs/).
