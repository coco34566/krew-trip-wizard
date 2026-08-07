-- Krew: colonnes manquantes pour conserver / créer les voyages sans erreur schema cache
-- À coller dans Lovable → Cloud → SQL Editor → Run

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS has_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS star_user_id uuid,
  ADD COLUMN IF NOT EXISTS provisional_start_date date,
  ADD COLUMN IF NOT EXISTS provisional_end_date date,
  ADD COLUMN IF NOT EXISTS date_confidence text,
  ADD COLUMN IF NOT EXISTS dates_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS celebrated_person text,
  ADD COLUMN IF NOT EXISTS participants_count integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS budget_per_person numeric DEFAULT 400,
  ADD COLUMN IF NOT EXISTS departure_city text DEFAULT 'Paris',
  ADD COLUMN IF NOT EXISTS duration_nights integer DEFAULT 2;

-- Statut annule (si enum)
DO $$
BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'annule';
EXCEPTION WHEN others THEN NULL;
END $$;

-- S'assurer que l'owner voit toujours ses voyages
DROP POLICY IF EXISTS "trips select members" ON public.trips;
CREATE POLICY "trips select members" ON public.trips
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_trip_member(id, auth.uid()));

DROP POLICY IF EXISTS "trips insert own" ON public.trips;
CREATE POLICY "trips insert own" ON public.trips
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
