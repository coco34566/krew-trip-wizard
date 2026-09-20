alter table public.trip_star_preferences
  add column if not exists transport_mode_accepted text[] not null default array['peu importe']::text[],
  add column if not exists max_travel_duration_hours numeric;

notify pgrst, 'reload schema';
