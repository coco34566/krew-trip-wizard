-- Reset scoring weights to the curated KREW baseline because the only feedback
-- currently available in production comes from TEST / QA / E2E trips.
-- Future recalibration is guarded in application code and requires a materially
-- larger set of distinct real trips before any automatic adjustment.

UPDATE public.scoring_weights
SET
  ambiance_weight = CASE event_type
    WHEN 'evg' THEN 28 WHEN 'evjf' THEN 28 WHEN 'anniversaire' THEN 22 WHEN 'weekend' THEN 14 WHEN 'voyage_groupe' THEN 18 ELSE 18 END,
  activities_weight = CASE event_type
    WHEN 'evg' THEN 22 WHEN 'evjf' THEN 22 WHEN 'anniversaire' THEN 16 WHEN 'weekend' THEN 12 WHEN 'voyage_groupe' THEN 14 ELSE 12 END,
  budget_weight = CASE event_type
    WHEN 'evg' THEN 12 WHEN 'evjf' THEN 12 WHEN 'anniversaire' THEN 14 WHEN 'weekend' THEN 28 WHEN 'voyage_groupe' THEN 16 ELSE 16 END,
  distance_weight = CASE event_type
    WHEN 'evg' THEN 5 WHEN 'evjf' THEN 5 WHEN 'anniversaire' THEN 8 WHEN 'weekend' THEN 12 WHEN 'voyage_groupe' THEN 8 ELSE 8 END,
  season_weight = CASE event_type
    WHEN 'evg' THEN 8 WHEN 'evjf' THEN 8 WHEN 'anniversaire' THEN 10 WHEN 'weekend' THEN 8 WHEN 'voyage_groupe' THEN 8 ELSE 8 END,
  quality_weight = CASE event_type
    WHEN 'evg' THEN 5 WHEN 'evjf' THEN 5 WHEN 'anniversaire' THEN 6 WHEN 'weekend' THEN 4 WHEN 'voyage_groupe' THEN 5 ELSE 5 END,
  consensus_weight = CASE event_type
    WHEN 'evg' THEN 12 WHEN 'evjf' THEN 12 WHEN 'anniversaire' THEN 14 WHEN 'weekend' THEN 12 WHEN 'voyage_groupe' THEN 16 ELSE 18 END,
  min_satisfaction_weight = CASE event_type
    WHEN 'evg' THEN 8 WHEN 'evjf' THEN 8 WHEN 'anniversaire' THEN 10 WHEN 'weekend' THEN 10 WHEN 'voyage_groupe' THEN 15 ELSE 15 END,
  updated_at = now()
WHERE event_type IN ('evg', 'evjf', 'anniversaire', 'weekend', 'voyage_groupe', 'default');
