-- Migration to ensure all database schema columns and RLS policies are up-to-date for Star preferences and Journey progression
-- No destructive operations are performed.

-- 1. Ensure public.trip_star_preferences has all needed columns
ALTER TABLE public.trip_star_preferences
  ADD COLUMN IF NOT EXISTS available_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocked_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS desired_destination text,
  ADD COLUMN IF NOT EXISTS excluded_destinations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS departure_city text,
  ADD COLUMN IF NOT EXISTS departure_airport_or_station text,
  ADD COLUMN IF NOT EXISTS wanted_activities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deal_breakers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ambiances text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Ensure RLS policies are active on public.trip_star_preferences
ALTER TABLE public.trip_star_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select on trip_star_preferences for trip members" ON public.trip_star_preferences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.trip_participants
      WHERE trip_participants.trip_id = trip_star_preferences.trip_id
        AND trip_participants.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_star_preferences.trip_id
        AND trips.owner_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert/update/delete on trip_star_preferences for trip members" ON public.trip_star_preferences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.trip_participants
      WHERE trip_participants.trip_id = trip_star_preferences.trip_id
        AND trip_participants.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.trips
      WHERE trips.id = trip_star_preferences.trip_id
        AND trips.owner_id = auth.uid()
    )
  );

-- 3. Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
