-- Migration to update public.is_trip_owner to include co-organizers
CREATE OR REPLACE FUNCTION public.is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips t WHERE t.id = _trip_id AND (t.owner_id = _user_id OR t.co_organizer_id = _user_id));
$$;

NOTIFY pgrst, 'reload schema';
