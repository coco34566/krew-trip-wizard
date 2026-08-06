-- Add new participant preferences columns to support improved questionnaire and aggregation
ALTER TABLE IF EXISTS public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS departure_city text,
  ADD COLUMN IF NOT EXISTS departure_flex_km integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_flex_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_shared_room boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_type_preference text,
  ADD COLUMN IF NOT EXISTS required_amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_accommodation_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS travel_pace text CHECK (travel_pace IN ('plein_programme','equilibre','chill')),
  ADD COLUMN IF NOT EXISTS preferred_time_slots text[] NOT NULL DEFAULT '{}';

-- Optional indexes to help aggregation queries
CREATE INDEX IF NOT EXISTS idx_participant_prefs_trip_departure_city ON public.trip_participant_preferences (trip_id, departure_city);
CREATE INDEX IF NOT EXISTS idx_participant_prefs_trip_required_amenities ON public.trip_participant_preferences USING GIN (required_amenities);

COMMENT ON COLUMN public.trip_participant_preferences.required_amenities IS 'Array of amenity keys (pool, accessible, breakfast, lift...)';
COMMENT ON COLUMN public.trip_participant_preferences.travel_pace IS 'Values: plein_programme, equilibre, chill';
