ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS group_logistics jsonb DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
