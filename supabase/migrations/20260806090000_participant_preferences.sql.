CREATE TABLE public.trip_participant_preferences (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ambiances text[] NOT NULL DEFAULT '{}',
  activity_categories text[] NOT NULL DEFAULT '{}',
  budget_max numeric,
  budget_priority text NOT NULL DEFAULT 'preference'
    CHECK (budget_priority IN ('must_have','high_priority','preference','nice_to_have','irrelevant','veto')),
  duration_nights_min integer,
  duration_nights_max integer,
  desired_destination text,
  excluded_destinations text[] NOT NULL DEFAULT '{}',
  dietary_constraints text[] NOT NULL DEFAULT '{}',
  mobility_notes text,
  free_text text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participant_preferences TO authenticated;
GRANT ALL ON public.trip_participant_preferences TO service_role;
ALTER TABLE public.trip_participant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participant prefs select own or owner" ON public.trip_participant_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "participant prefs insert own" ON public.trip_participant_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "participant prefs update own" ON public.trip_participant_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER participant_prefs_updated_at
  BEFORE UPDATE ON public.trip_participant_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
