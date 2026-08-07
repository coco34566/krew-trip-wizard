-- Deal-breakers d'ambiance (refus absolus participants)
ALTER TABLE public.trip_participant_preferences
  ADD COLUMN IF NOT EXISTS deal_breaker_ambiances text[] NOT NULL DEFAULT '{}';
