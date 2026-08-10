-- Migration: Add co_organizer_id and new transport time pref columns

-- Add co_organizer_id column referencing auth.users(id) to trips table
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS co_organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update RLS policies for trips table to include co_organizer_id
-- We drop the existing update/delete policies if we want to expand them, or we can just redefine them.
-- Let's make sure that if is_trip_admin is called, it already includes co_organizer_id.
-- Let's see what is_trip_owner and is_trip_member check in PostgreSQL.
-- But wait! trips update policies can be updated:
DROP POLICY IF EXISTS "trips update own" ON public.trips;
CREATE POLICY "trips update own" ON public.trips
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR co_organizer_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR co_organizer_id = auth.uid());

-- Add columns to trip_transport_time_prefs
ALTER TABLE public.trip_transport_time_prefs
  ADD COLUMN IF NOT EXISTS latest_arrival_time TEXT,
  ADD COLUMN IF NOT EXISTS earliest_return_departure_time TEXT;

NOTIFY pgrst, 'reload schema';
