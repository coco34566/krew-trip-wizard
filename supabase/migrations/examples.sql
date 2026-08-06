-- Examples for testing the Krew schema (insert + aggregation)

-- 1) Insert test user
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice') RETURNING id;

-- 2) Insert trip (use returned owner id)
INSERT INTO trips (owner_id, name, type, start_date, end_date, budget_per_person) VALUES ('<owner_id>', 'EVG Barcelone', 'EVG', '2026-09-10', '2026-09-12', 350) RETURNING id;

-- 3) Add participants
INSERT INTO participants (trip_id, email, name, accepted) VALUES ('<trip_id>', 'bob@example.com', 'Bob', true) RETURNING id;
INSERT INTO participants (trip_id, email, name, accepted) VALUES ('<trip_id>', 'carol@example.com', 'Carol', false) RETURNING id;

-- 4) Add responses
INSERT INTO responses (trip_id, participant_id, answers) VALUES ('<trip_id>', '<participant_id_bob>', '{"availability":["2026-09-10"], "ambiance":"fête", "activities":["bars","plage"], "budget_max":400}'::jsonb);
INSERT INTO responses (trip_id, participant_id, answers) VALUES ('<trip_id>', '<participant_id_carol>', '{"availability":["2026-09-11"], "ambiance":"détente", "activities":["spa","gastronomie"], "budget_max":300}'::jsonb);

-- 5) Simple aggregation for prototype scoring
SELECT
  t.id as trip_id,
  AVG((r.answers ->> 'budget_max')::numeric) AS avg_budget_max,
  jsonb_agg(DISTINCT elem) AS activities
FROM trips t
LEFT JOIN responses r ON r.trip_id = t.id
LEFT JOIN LATERAL jsonb_array_elements_text(coalesce(r.answers -> 'activities','[]'::jsonb)) AS elem ON true
WHERE t.id = '<trip_id>'
GROUP BY t.id;
