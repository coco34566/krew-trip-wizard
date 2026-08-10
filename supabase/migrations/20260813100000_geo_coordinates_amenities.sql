-- Migration: Add geo-coordinates to accommodations and activities tables

-- Add latitude and longitude to accommodations
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Add latitude and longitude to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

NOTIFY pgrst, 'reload schema';
