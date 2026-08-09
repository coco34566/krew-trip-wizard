-- Add missing fields to trip_star_preferences table
ALTER TABLE public.trip_star_preferences
  ADD COLUMN IF NOT EXISTS available_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocked_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS desired_destination text,
  ADD COLUMN IF NOT EXISTS excluded_destinations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS departure_city text,
  ADD COLUMN IF NOT EXISTS departure_airport_or_station text;

NOTIFY pgrst, 'reload schema';
