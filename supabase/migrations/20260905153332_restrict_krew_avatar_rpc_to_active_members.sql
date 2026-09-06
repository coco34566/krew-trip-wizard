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
        and viewer.status not in ('refuse', 'absent')
    )
  );
$$;

revoke execute on function public.get_trip_member_avatars(uuid) from anon;
revoke execute on function public.get_trip_member_avatars(uuid) from public;
revoke execute on function public.get_trip_member_avatars(uuid) from authenticated;
grant execute on function public.get_trip_member_avatars(uuid) to authenticated;
