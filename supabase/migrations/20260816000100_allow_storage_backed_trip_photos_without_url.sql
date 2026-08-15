-- Storage-backed photos no longer require a public/legacy URL.
-- The actual file is kept in the private trip-photos Storage bucket;
-- clients receive short-lived signed URLs when displaying it.
alter table public.trip_photos
  alter column url drop not null;
