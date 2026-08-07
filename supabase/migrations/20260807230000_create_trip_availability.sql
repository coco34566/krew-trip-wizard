-- Création table trip_availability (requis pour le questionnaire dispos)
-- Lovable → Cloud → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.trip_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_dates date[] NOT NULL DEFAULT '{}',
  blocked_dates date[] NOT NULL DEFAULT '{}',
  flex_days integer NOT NULL DEFAULT 0,
  notes text,
  submitted_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS trip_availability_trip_idx
  ON public.trip_availability (trip_id);

ALTER TABLE public.trip_availability ENABLE ROW LEVEL SECURITY;

-- Policies (recréées proprement)
DROP POLICY IF EXISTS "trip_availability select members" ON public.trip_availability;
DROP POLICY IF EXISTS "trip_availability insert own" ON public.trip_availability;
DROP POLICY IF EXISTS "trip_availability update own" ON public.trip_availability;
DROP POLICY IF EXISTS "trip_availability delete own" ON public.trip_availability;

CREATE POLICY "trip_availability select members" ON public.trip_availability
  FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "trip_availability insert own" ON public.trip_availability
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "trip_availability update own" ON public.trip_availability
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "trip_availability delete own" ON public.trip_availability
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_availability TO authenticated;
GRANT ALL ON public.trip_availability TO service_role;

-- Colonnes trips utiles au ranking / verrouillage
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS has_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS star_user_id uuid,
  ADD COLUMN IF NOT EXISTS provisional_start_date date,
  ADD COLUMN IF NOT EXISTS provisional_end_date date,
  ADD COLUMN IF NOT EXISTS date_confidence text,
  ADD COLUMN IF NOT EXISTS dates_locked boolean NOT NULL DEFAULT false;

-- Rafraîchir le cache PostgREST (si supporté)
NOTIFY pgrst, 'reload schema';
