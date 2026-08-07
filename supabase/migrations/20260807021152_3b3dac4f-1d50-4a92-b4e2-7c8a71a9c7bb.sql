ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS duration_nights integer NOT NULL DEFAULT 2;

CREATE TABLE IF NOT EXISTS public.trip_participant_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
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
  departure_city text,
  departure_flex_km integer,
  date_flex_days integer,
  accepts_shared_room boolean NOT NULL DEFAULT false,
  room_type_preference text,
  required_amenities text[] NOT NULL DEFAULT '{}',
  min_accommodation_rating numeric,
  travel_pace text,
  preferred_time_slots text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_participant_preferences TO authenticated;
GRANT ALL ON public.trip_participant_preferences TO service_role;

ALTER TABLE public.trip_participant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view trip answers"
  ON public.trip_participant_preferences FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Participants insert their own answers"
  ON public.trip_participant_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "Participants update their own answers"
  ON public.trip_participant_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Participants delete their own answers"
  ON public.trip_participant_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());