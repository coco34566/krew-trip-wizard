-- Votes activités du groupe
CREATE TABLE IF NOT EXISTS public.activity_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS activity_votes_trip_idx ON public.activity_votes (trip_id);

ALTER TABLE public.activity_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_votes select members" ON public.activity_votes;
DROP POLICY IF EXISTS "activity_votes insert own" ON public.activity_votes;
DROP POLICY IF EXISTS "activity_votes delete own" ON public.activity_votes;

CREATE POLICY "activity_votes select members" ON public.activity_votes
  FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "activity_votes insert own" ON public.activity_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "activity_votes delete own" ON public.activity_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.activity_votes TO authenticated;
GRANT ALL ON public.activity_votes TO service_role;

-- Colonne optionnelle : activités retenues par l'orga
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS selected_activity_ids uuid[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
