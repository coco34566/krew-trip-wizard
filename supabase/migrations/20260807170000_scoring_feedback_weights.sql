-- Feedback de scoring + poids dynamiques par type d\'événement
CREATE TABLE IF NOT EXISTS public.scoring_weights (
  event_type text PRIMARY KEY,
  ambiance_weight numeric NOT NULL DEFAULT 18,
  activities_weight numeric NOT NULL DEFAULT 12,
  budget_weight numeric NOT NULL DEFAULT 16,
  distance_weight numeric NOT NULL DEFAULT 8,
  season_weight numeric NOT NULL DEFAULT 8,
  quality_weight numeric NOT NULL DEFAULT 5,
  consensus_weight numeric NOT NULL DEFAULT 18,
  min_satisfaction_weight numeric NOT NULL DEFAULT 15,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.scoring_weights (event_type, ambiance_weight, activities_weight, budget_weight, distance_weight, season_weight, quality_weight, consensus_weight, min_satisfaction_weight)
VALUES
  ('evg', 28, 22, 12, 5, 8, 5, 12, 8),
  ('evjf', 28, 22, 12, 5, 8, 5, 12, 8),
  ('anniversaire', 22, 16, 14, 8, 10, 6, 14, 10),
  ('weekend', 14, 12, 28, 12, 8, 4, 12, 10),
  ('voyage_groupe', 18, 14, 16, 8, 8, 5, 16, 15),
  ('default', 18, 12, 16, 8, 8, 5, 18, 15)
ON CONFLICT (event_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.scoring_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'default',
  rank_in_top integer,
  was_selected boolean NOT NULL DEFAULT false,
  final_score numeric,
  s_ambiance numeric,
  s_activities numeric,
  s_budget numeric,
  s_distance numeric,
  s_season numeric,
  s_quality numeric,
  s_consensus numeric,
  s_min_satisfaction numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scoring_feedback_event_idx ON public.scoring_feedback (event_type);
CREATE INDEX IF NOT EXISTS scoring_feedback_selected_idx ON public.scoring_feedback (was_selected) WHERE was_selected = true;

ALTER TABLE public.scoring_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_feedback ENABLE ROW LEVEL SECURITY;

-- Lecture authentifiée des poids ; écriture service_role / owner via policies simples
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scoring_weights' AND policyname = 'scoring_weights read') THEN
    CREATE POLICY "scoring_weights read" ON public.scoring_weights FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scoring_feedback' AND policyname = 'scoring_feedback read member') THEN
    CREATE POLICY "scoring_feedback read member" ON public.scoring_feedback FOR SELECT TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scoring_feedback' AND policyname = 'scoring_feedback insert member') THEN
    CREATE POLICY "scoring_feedback insert member" ON public.scoring_feedback FOR INSERT TO authenticated
      WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
  END IF;
END $$;

GRANT SELECT ON public.scoring_weights TO authenticated;
GRANT ALL ON public.scoring_weights TO service_role;
GRANT SELECT, INSERT ON public.scoring_feedback TO authenticated;
GRANT ALL ON public.scoring_feedback TO service_role;
