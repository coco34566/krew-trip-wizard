-- Keep the cached trip_photos.likes count correct for every write path,
-- including cascaded deletions when a user or photo is removed.

create or replace function public.refresh_trip_photo_like_count()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_photo_id uuid := coalesce(new.photo_id, old.photo_id);
begin
  update public.trip_photos
  set likes = (
    select count(*)::integer
    from public.trip_photo_likes
    where photo_id = v_photo_id
  )
  where id = v_photo_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_trip_photo_like_count
on public.trip_photo_likes;

create trigger refresh_trip_photo_like_count
after insert or delete on public.trip_photo_likes
for each row execute function public.refresh_trip_photo_like_count();

revoke execute on function public.refresh_trip_photo_like_count()
from public, anon, authenticated;

create or replace function public.toggle_trip_photo_like(p_photo_id uuid)
returns table(liked boolean, likes integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
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

  select photo.likes
  into likes
  from public.trip_photos as photo
  where photo.id = p_photo_id;

  return next;
end;
$$;
