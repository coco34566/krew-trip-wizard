insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.get_trip_member_avatars(p_trip_id uuid)
returns table(user_id uuid, avatar_url text)
language sql
security definer
set search_path = public
as $$
  select p.id as user_id, p.avatar_url
  from public.profiles p
  where p.id in (
    select tp.user_id
    from public.trip_participants tp
    where tp.trip_id = p_trip_id and tp.user_id is not null
  )
  and (
    exists (
      select 1 from public.trips t
      where t.id = p_trip_id
        and (t.owner_id = auth.uid() or t.co_organizer_id = auth.uid())
    )
    or exists (
      select 1 from public.trip_participants viewer
      where viewer.trip_id = p_trip_id
        and viewer.user_id = auth.uid()
        and viewer.status <> 'refuse'
    )
  );
$$;

revoke all on function public.get_trip_member_avatars(uuid) from public;
grant execute on function public.get_trip_member_avatars(uuid) to authenticated;
