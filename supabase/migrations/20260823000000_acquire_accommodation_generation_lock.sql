-- Migration: acquire_accommodation_generation_lock RPC function
create or replace function public.acquire_accommodation_generation_lock(
  p_trip_id uuid,
  p_request_hash text,
  p_stale_after_seconds integer default 600
)
returns table(acquired boolean, generation jsonb)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_logistics jsonb;
  v_generation jsonb;
  v_status text;
  v_hash text;
  v_attempted_at timestamptz;
  v_is_authorized boolean;
begin
  if v_user_id is null then
    raise exception 'not authorized';
  end if;

  if p_request_hash is null
     or btrim(p_request_hash) = ''
     or p_stale_after_seconds <= 0
  then
    raise exception 'invalid accommodation generation lock parameters';
  end if;

  select (
    t.owner_id = v_user_id
    or t.co_organizer_id = v_user_id
    or exists (
      select 1
      from public.trip_participants tp
      where tp.trip_id = t.id
        and tp.user_id = v_user_id
        and tp.role = 'co_organizer'
    )
  )
  into v_is_authorized
  from public.trips t
  where t.id = p_trip_id;

  if coalesce(v_is_authorized, false) is false then
    raise exception 'not authorized';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_trip_id::text || ':accommodation-generation',
      0
    )
  );

  select coalesce(t.group_logistics, '{}'::jsonb)
  into v_logistics
  from public.trips t
  where t.id = p_trip_id
  for update;

  if not found then
    raise exception 'trip not found';
  end if;

  v_generation :=
    coalesce(
      v_logistics -> 'accommodationGeneration',
      '{}'::jsonb
    );

  v_status := v_generation ->> 'status';
  v_hash := v_generation ->> 'requestHash';

  begin
    v_attempted_at :=
      nullif(v_generation ->> 'attemptedAt', '')::timestamptz;
  exception when others then
    v_attempted_at := null;
  end;

  if v_status = 'in_progress'
     and v_hash = p_request_hash
     and v_attempted_at is not null
     and v_attempted_at >
       now() - make_interval(secs => p_stale_after_seconds)
  then
    return query
      select false, v_generation;
    return;
  end if;

  v_generation := jsonb_build_object(
    'status', 'in_progress',
    'requestHash', p_request_hash,
    'attemptedAt', now()
  );

  update public.trips
  set
    group_logistics =
      jsonb_set(
        v_logistics,
        '{accommodationGeneration}',
        v_generation,
        true
      ),
    updated_at = now()
  where id = p_trip_id;

  return query
    select true, v_generation;
end;
$function$;

revoke all
on function public.acquire_accommodation_generation_lock(
  uuid,
  text,
  integer
)
from public;

revoke all
on function public.acquire_accommodation_generation_lock(
  uuid,
  text,
  integer
)
from anon;

grant execute
on function public.acquire_accommodation_generation_lock(
  uuid,
  text,
  integer
)
to authenticated;

grant execute
on function public.acquire_accommodation_generation_lock(
  uuid,
  text,
  integer
)
to service_role;
