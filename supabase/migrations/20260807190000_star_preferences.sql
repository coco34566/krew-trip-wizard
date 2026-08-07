-- Questionnaire Star (personne principale) + mapping event types étendus
CREATE TABLE IF NOT EXISTS public.trip_star_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  -- soit user_id (si la star a un compte), soit renseigné par l''organisateur
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filled_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wanted_activities text[] NOT NULL DEFAULT '{}',
  deal_breakers text[] NOT NULL DEFAULT '{}',
  ambiances text[] NOT NULL DEFAULT '{}',
  notes text,
  submitted_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id)
);

ALTER TABLE public.trip_star_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_star_preferences' AND policyname = 'star_prefs select members') THEN
    CREATE POLICY "star_prefs select members" ON public.trip_star_preferences
      FOR SELECT TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_star_preferences' AND policyname = 'star_prefs upsert members') THEN
    CREATE POLICY "star_prefs insert members" ON public.trip_star_preferences
      FOR INSERT TO authenticated
      WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
    CREATE POLICY "star_prefs update members" ON public.trip_star_preferences
      FOR UPDATE TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.trip_star_preferences TO authenticated;
GRANT ALL ON public.trip_star_preferences TO service_role;

-- Élargir l''enum event_type si possible
DO $$
BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'famille';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'seminaire';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'retraite';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'autre';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
