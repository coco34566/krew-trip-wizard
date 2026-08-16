-- Persist the calculated and organizer-approved stay profile before destination discovery.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS stay_concepts_calculated jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stay_concepts_selected jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stay_profile_validated_at timestamptz;

COMMENT ON COLUMN public.trips.stay_concepts_calculated IS 'Up to three StayConcept objects calculated from participant preferences.';
COMMENT ON COLUMN public.trips.stay_concepts_selected IS 'Organizer-approved subset used by the Discovery Router.';
COMMENT ON COLUMN public.trips.stay_profile_validated_at IS 'Non-null once an organizer or co-organizer validates the trip profile.';
