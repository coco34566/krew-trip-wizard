-- Nullable by design: historical answers remain neutral.
alter table public.trip_participant_preferences
  add column if not exists local_mobility text check (local_mobility is null or local_mobility in ('walk_transit', 'car_if_worth_it', 'car_ok')),
  add column if not exists accommodation_role text check (accommodation_role is null or accommodation_role in ('base_only', 'part_of_stay', 'centerpiece'));

alter table public.trip_star_preferences
  add column if not exists local_mobility text check (local_mobility is null or local_mobility in ('walk_transit', 'car_if_worth_it', 'car_ok')),
  add column if not exists accommodation_role text check (accommodation_role is null or accommodation_role in ('base_only', 'part_of_stay', 'centerpiece'));
