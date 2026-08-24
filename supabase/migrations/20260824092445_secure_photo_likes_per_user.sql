-- KREW Souvenirs — one reversible like per authenticated trip member.
-- Legacy aggregate counters cannot be attributed to individual users, so they
-- are reset once and rebuilt from the normalized vote table.

create table public.trip_photo_likes (
  photo_id uuid not null references public.trip_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create index trip_photo_likes_user_id_idx
  on public.trip_photo_likes(user_id);

alter table public.trip_photo_likes enable row level security;

create policy "Users can view their own photo likes"
  on public.trip_photo_likes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.trip_photo_likes from public, anon, authenticated;
grant select on table public.trip_photo_likes to authenticated;
grant all on table public.trip_photo_likes to service_role;

update public.trip_photos
set likes = 0
where likes <> 0;

create or replace function public.toggle_trip_photo_like(p_photo_id uuid)
returns table(liked boolean, likes integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_like_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select photo.trip_id
  into v_trip_id
  from public.trip_photos as photo
  where photo.id = p_photo_id
    and photo.deleted_at is null;

  if v_trip_id is null or not public.is_trip_member(v_trip_id, v_user_id) then
    raise exception 'photo_not_found_or_access_denied' using errcode = '42501';
  end if;

  -- Serialize rapid/repeated clicks for the same user and photo.
  perform pg_advisory_xact_lock(
    hashtextextended(p_photo_id::text || ':' || v_user_id::text, 0)
  );

  delete from public.trip_photo_likes
  where photo_id = p_photo_id
    and user_id = v_user_id;

  if found then
    liked := false;
  else
    insert into public.trip_photo_likes (photo_id, user_id)
    values (p_photo_id, v_user_id);
    liked := true;
  end if;

  select count(*)::integer
  into v_like_count
  from public.trip_photo_likes
  where photo_id = p_photo_id;

  update public.trip_photos
  set likes = v_like_count
  where id = p_photo_id;

  likes := v_like_count;
  return next;
end;
$$;

revoke execute on function public.increment_trip_photo_likes(uuid)
from public, anon, authenticated;

revoke execute on function public.toggle_trip_photo_like(uuid)
from public, anon;
grant execute on function public.toggle_trip_photo_like(uuid)
to authenticated;
