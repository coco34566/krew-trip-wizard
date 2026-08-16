ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'city'
    CHECK (destination_type IN ('city', 'town_village', 'region_territory', 'outdoor_area')),
  ADD COLUMN IF NOT EXISTS region_name text,
  ADD COLUMN IF NOT EXISTS anchor_places text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.destinations.anchor_places IS 'Provider-independent places used to search accommodation and activities for non-city destinations.';
