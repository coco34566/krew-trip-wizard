-- 2026-08-06 09:10:00 add participant and trip fields
ALTER TABLE public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS departure_city text NULL,
  ADD COLUMN IF NOT EXISTS departure_flex_km integer NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_flex_days integer NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_shared_room boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_type_preference text NULL,
  ADD COLUMN IF NOT EXISTS required_amenities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_accommodation_rating numeric NULL,
  ADD COLUMN IF NOT EXISTS travel_pace text NULL,
  ADD COLUMN IF NOT EXISTS preferred_time_slots text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.trip_preferences
  ADD COLUMN IF NOT EXISTS departure_airport_code text NULL,
  ADD COLUMN IF NOT EXISTS global_date_flex_days integer NULL DEFAULT 0;

-- Grants/policies are already permissive for these tables; no new policy changes here.
