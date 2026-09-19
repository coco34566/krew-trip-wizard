-- KREW Souvenirs — secure photo foundation
-- Photos must be stored as private Supabase Storage objects.
-- This migration upgrades the existing metadata table and removes the legacy public RLS policy.

alter table public.trip_photos
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists storage_path text,
  add column if not exists content_hash text,
  add column if not exists perceptual_hash text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists captured_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.trip_photos enable row level security;

drop policy if exists "Users can view trip photos" on public.trip_photos;
drop policy if exists "Users can insert trip photos" on public.trip_photos;
drop policy if exists "Users can update trip photos" on public.trip_photos;
drop policy if exists "Trip members can insert trip photos" on public.trip_photos;
drop policy if exists "Trip members can update trip photos" on public.trip_photos;

create policy "Trip members can view trip photos"
  on public.trip_photos
  for select
  to authenticated
  using (public.is_trip_member(trip_id, auth.uid()));

create policy "Trip members can insert trip photos"
  on public.trip_photos
  for insert
  to authenticated
  with check (
    public.is_trip_member(trip_id, auth.uid())
    and (owner_user_id = auth.uid() or owner_user_id is null)
  );

create policy "Photo owners can update trip photos"
  on public.trip_photos
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and public.is_trip_member(trip_id, auth.uid())
  );

create policy "Photo owners can delete trip photos"
  on public.trip_photos
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

create index if not exists trip_photos_trip_id_idx
  on public.trip_photos(trip_id);

create index if not exists trip_photos_owner_user_id_idx
  on public.trip_photos(owner_user_id);

create index if not exists trip_photos_content_hash_idx
  on public.trip_photos(trip_id, content_hash);

create unique index if not exists trip_photos_unique_content_hash_idx
  on public.trip_photos(trip_id, content_hash)
  where content_hash is not null and deleted_at is null;

-- Private bucket for future photo uploads. Existing Base64 photos are not migrated by this step.
insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', false)
on conflict (id) do update set public = false;

-- Storage access is based on the first path segment: {trip_id}/{user_id}/{file_id}.
drop policy if exists "Trip members can read trip photos storage" on storage.objects;
drop policy if exists "Trip members can upload trip photos storage" on storage.objects;
drop policy if exists "Photo owners can update trip photos storage" on storage.objects;
drop policy if exists "Photo owners can delete trip photos storage" on storage.objects;

create policy "Trip members can read trip photos storage"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and public.is_trip_member(split_part(name, '/', 1)::uuid, auth.uid())
  );

create policy "Trip members can upload trip photos storage"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trip-photos'
    and owner_id = auth.uid()::text
    and public.is_trip_member(split_part(name, '/', 1)::uuid, auth.uid())
  );

create policy "Photo owners can update trip photos storage"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and owner_id = auth.uid()::text
    and public.is_trip_member(split_part(name, '/', 1)::uuid, auth.uid())
  )
  with check (
    bucket_id = 'trip-photos'
    and owner_id = auth.uid()::text
    and public.is_trip_member(split_part(name, '/', 1)::uuid, auth.uid())
  );

create policy "Photo owners can delete trip photos storage"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'trip-photos'
    and owner_id = auth.uid()::text
    and public.is_trip_member(split_part(name, '/', 1)::uuid, auth.uid())
  );
