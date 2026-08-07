-- Disponibilités participants + champs hub / star
CREATE TABLE IF NOT EXISTS public.trip_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- dates ISO (YYYY-MM-DD) disponibles
  available_dates date[] NOT NULL DEFAULT '{}',
  -- dates impossibles
  blocked_dates date[] NOT NULL DEFAULT '{}',
  -- flexibilité en jours autour des plages
  flex_days integer NOT NULL DEFAULT 0,
  notes text,
  submitted_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS trip_availability_trip_idx ON public.trip_availability (trip_id);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS has_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS star_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provisional_start_date date,
  ADD COLUMN IF NOT EXISTS provisional_end_date date,
  ADD COLUMN IF NOT EXISTS date_confidence text;

ALTER TABLE public.trip_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_availability' AND policyname = 'trip_availability select members') THEN
    CREATE POLICY "trip_availability select members" ON public.trip_availability
      FOR SELECT TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_availability' AND policyname = 'trip_availability insert own') THEN
    CREATE POLICY "trip_availability insert own" ON public.trip_availability
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_availability' AND policyname = 'trip_availability update own') THEN
    CREATE POLICY "trip_availability update own" ON public.trip_availability
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_availability' AND policyname = 'trip_availability delete own') THEN
    CREATE POLICY "trip_availability delete own" ON public.trip_availability
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_availability TO authenticated;
GRANT ALL ON public.trip_availability TO service_role;

-- Marquer has_star pour types d''événement concernés (si celebrated_person renseigné)
UPDATE public.trips
SET has_star = true
WHERE event_type IN ('evg', 'evjf', 'anniversaire')
  AND celebrated_person IS NOT NULL
  AND length(trim(celebrated_person)) > 0;
