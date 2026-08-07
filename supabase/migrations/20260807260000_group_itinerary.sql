-- Itinéraire groupe (planning activités jour par jour)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS group_itinerary jsonb DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
