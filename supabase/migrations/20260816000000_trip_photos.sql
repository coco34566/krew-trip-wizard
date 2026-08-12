-- Migration to create public.trip_photos table for shared memories
create table if not exists public.trip_photos (
    id uuid default gen_random_uuid() primary key,
    trip_id uuid references public.trips(id) on delete cascade not null,
    url text not null,
    author text not null,
    likes integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.trip_photos enable row level security;

-- Policy to allow anyone authenticated to view photos
create policy "Users can view trip photos" on public.trip_photos
    for select using (true);

-- Policy to allow anyone authenticated to upload/insert photos
create policy "Users can insert trip photos" on public.trip_photos
    for insert with check (true);

-- Policy to allow anyone to update (e.g. for likes)
create policy "Users can update trip photos" on public.trip_photos
    for update using (true);
