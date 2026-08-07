ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS price_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS best_provider text;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS booking_url text;

ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS climate jsonb NOT NULL DEFAULT '{}'::jsonb;