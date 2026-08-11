-- Migration: Add fields for duration nights in availability, age range, and wanted environments
ALTER TABLE public.trip_availability
ADD COLUMN IF NOT EXISTS duration_nights integer DEFAULT 2;

ALTER TABLE public.trip_participant_preferences
ADD COLUMN IF NOT EXISTS wanted_env_type text,
ADD COLUMN IF NOT EXISTS group_age_range text;

ALTER TABLE public.trip_star_preferences
ADD COLUMN IF NOT EXISTS wanted_env_type text;

NOTIFY pgrst, 'reload schema';
