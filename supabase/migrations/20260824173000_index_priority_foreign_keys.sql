-- Index the foreign keys used most often for trip ownership, membership,
-- availability and recommendation lookups.

CREATE INDEX IF NOT EXISTS trips_owner_id_idx
  ON public.trips (owner_id);

CREATE INDEX IF NOT EXISTS trips_co_organizer_id_idx
  ON public.trips (co_organizer_id);

CREATE INDEX IF NOT EXISTS trip_participants_user_id_idx
  ON public.trip_participants (user_id);

CREATE INDEX IF NOT EXISTS recommendations_trip_id_idx
  ON public.recommendations (trip_id);

CREATE INDEX IF NOT EXISTS recommendations_destination_id_idx
  ON public.recommendations (destination_id);

CREATE INDEX IF NOT EXISTS trip_availability_user_id_idx
  ON public.trip_availability (user_id);
