-- Questionnaire préférences : table + colonnes (Lovable SQL Editor → Run)

CREATE TABLE IF NOT EXISTS public.trip_participant_preferences (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ambiances text[] NOT NULL DEFAULT '{}',
  activity_categories text[] NOT NULL DEFAULT '{}',
  budget_max numeric,
  budget_priority text NOT NULL DEFAULT 'preference',
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

ALTER TABLE public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS departure_city text,
  ADD COLUMN IF NOT EXISTS departure_flex_km integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_flex_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_shared_room boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_type_preference text,
  ADD COLUMN IF NOT EXISTS required_amenities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_accommodation_rating numeric,
  ADD COLUMN IF NOT EXISTS travel_pace text,
  ADD COLUMN IF NOT EXISTS preferred_time_slots text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS departure_airport_or_station text,
  ADD COLUMN IF NOT EXISTS transport_mode_accepted text[] DEFAULT '{peu importe}',
  ADD COLUMN IF NOT EXISTS max_travel_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS accessibility_needs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS blackout_dates date[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deal_breaker_ambiances text[] DEFAULT '{}';

ALTER TABLE public.trip_participant_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant prefs select own or owner" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "participant prefs insert own" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "participant prefs update own" ON public.trip_participant_preferences;

CREATE POLICY "participant prefs select own or owner" ON public.trip_participant_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_owner(trip_id, auth.uid()) OR public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "participant prefs insert own" ON public.trip_participant_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "participant prefs update own" ON public.trip_participant_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participant_preferences TO authenticated;
GRANT ALL ON public.trip_participant_preferences TO service_role;

NOTIFY pgrst, 'reload schema';
