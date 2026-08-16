ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS availability_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_state text NOT NULL DEFAULT 'unknown'
    CHECK (verification_state IN ('confirmed', 'inferred', 'unknown')),
  ADD COLUMN IF NOT EXISTS bedrooms integer;

COMMENT ON COLUMN public.accommodations.verification_state IS 'Verification level of web-discovered property facts; never implies availability.';
