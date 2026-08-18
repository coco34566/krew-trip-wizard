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
as $$
declare
  v_user_id uuid;
  v_is_authorized boolean;
  v_group_logistics jsonb;
  v_current_gen jsonb;
  v_current_hash text;
  v_current_status text;
  v_attempted_at timestamptz;
  v_stale_limit timestamptz;
  v_new_gen jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_request_hash is null or length(trim(p_request_hash)) = 0 then
    raise exception 'Invalid request hash';
  end if;

  if p_stale_after_seconds is null or p_stale_after_seconds <= 0 then
    p_stale_after_seconds := 600;
  end if;

  -- Check authorization
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
    and (
      t.owner_id = v_user_id
      or t.co_organizer_id = v_user_id
      or exists (
        select 1 from public.trip_participants tp
        where tp.trip_id = p_trip_id
        and tp.user_id = v_user_id
        and tp.role = 'co_organizer'
      )
    )
  ) into v_is_authorized;

  if not v_is_authorized then
    raise exception '403 Forbidden';
  end if;

  -- Transaction-level advisory lock per trip
  perform pg_advisory_xact_lock(hashtextextended(p_trip_id::text || ':accommodation-generation', 0));

  -- Lock trip row for update
  select group_logistics into v_group_logistics
  from public.trips
  where id = p_trip_id
  for update;

  v_current_gen := coalesce(v_group_logistics->'accommodationGeneration', '{}'::jsonb);
  v_current_hash := v_current_gen->>'requestHash';
  v_current_status := v_current_gen->>'status';

  if v_current_gen->>'attemptedAt' is not null then
    begin
      v_attempted_at := (v_current_gen->>'attemptedAt')::timestamptz;
    exception when others then
      v_attempted_at := null;
    end;
  end if;

  v_stale_limit := now() - (p_stale_after_seconds || ' seconds')::interval;

  -- Check if already in progress with same hash and not stale
  if v_current_status = 'in_progress' and v_current_hash = p_request_hash and v_attempted_at is not null and v_attempted_at > v_stale_limit then
    return query select false, v_current_gen;
    return;
  end if;

  -- Acquire lock: build new generation object
  v_new_gen := jsonb_build_object(
    'status', 'in_progress',
    'requestHash', p_request_hash,
    'attemptedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'completedAt', null,
    'userMessage', 'Recherche de logements en cours...'
  );

  update public.trips
  set group_logistics = jsonb_set(
    coalesce(group_logistics, '{}'::jsonb),
    '{accommodationGeneration}',
    v_new_gen
  )
  where id = p_trip_id;

  return query select true, v_new_gen;
end;
$$;

revoke all on function public.acquire_accommodation_generation_lock(uuid, text, integer) from public;
revoke all on function public.acquire_accommodation_generation_lock(uuid, text, integer) from anon;
grant execute on function public.acquire_accommodation_generation_lock(uuid, text, integer) to authenticated;
grant execute on function public.acquire_accommodation_generation_lock(uuid, text, integer) to service_role;
