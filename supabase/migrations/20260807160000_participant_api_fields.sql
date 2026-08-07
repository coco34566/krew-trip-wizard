-- Champs API-ready + accessibilité structurée
ALTER TABLE public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS departure_airport_or_station text,
  ADD COLUMN IF NOT EXISTS transport_mode_accepted text[] NOT NULL DEFAULT '{peu importe}',
  ADD COLUMN IF NOT EXISTS max_travel_duration_hours numeric,
  ADD COLUMN IF NOT EXISTS accessibility_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blackout_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deal_breaker_ambiances text[] NOT NULL DEFAULT '{}';
