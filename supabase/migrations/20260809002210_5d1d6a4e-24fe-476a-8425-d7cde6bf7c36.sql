ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS runner_ups jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.destination_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, recommendation_id, participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_feedback TO authenticated;
GRANT ALL ON public.destination_feedback TO service_role;
ALTER TABLE public.destination_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read destination feedback" ON public.destination_feedback FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members write destination feedback" ON public.destination_feedback FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members update destination feedback" ON public.destination_feedback FOR UPDATE TO authenticated USING (public.is_trip_member(trip_id, auth.uid())) WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members delete destination feedback" ON public.destination_feedback FOR DELETE TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE TRIGGER destination_feedback_updated_at BEFORE UPDATE ON public.destination_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.scoring_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  recommendation_id uuid,
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
CREATE INDEX IF NOT EXISTS scoring_feedback_trip_dest_idx ON public.scoring_feedback (trip_id, destination_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.scoring_feedback TO authenticated;
GRANT ALL ON public.scoring_feedback TO service_role;
ALTER TABLE public.scoring_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read scoring feedback" ON public.scoring_feedback FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members insert scoring feedback" ON public.scoring_feedback FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members update scoring feedback" ON public.scoring_feedback FOR UPDATE TO authenticated USING (public.is_trip_member(trip_id, auth.uid())) WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

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
GRANT SELECT ON public.scoring_weights TO authenticated;
GRANT ALL ON public.scoring_weights TO service_role;
ALTER TABLE public.scoring_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read scoring weights" ON public.scoring_weights FOR SELECT TO authenticated USING (true);