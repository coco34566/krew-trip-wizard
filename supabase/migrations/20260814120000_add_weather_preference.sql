-- Weather preference used by destination scoring.
-- 0 = agnostic, 1 = nice to have, 2 = prioritize good weather.
ALTER TABLE public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS weather_preference smallint NOT NULL DEFAULT 1
  CHECK (weather_preference IN (0, 1, 2));

ALTER TABLE public.trip_star_preferences
  ADD COLUMN IF NOT EXISTS weather_preference smallint NOT NULL DEFAULT 1
  CHECK (weather_preference IN (0, 1, 2));

ALTER TABLE public.trip_preferences
  ADD COLUMN IF NOT EXISTS weather_preference smallint NOT NULL DEFAULT 1
  CHECK (weather_preference IN (0, 1, 2));

NOTIFY pgrst, 'reload schema';
