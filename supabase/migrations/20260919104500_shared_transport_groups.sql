-- Shared transport groups while preserving legacy transportPicks compatibility.
-- Entries remain stored in trips.group_logistics.transportPicks, but can now be
-- keyed by participantId (preferred) or userId (legacy).

create or replace function public.krew_upsert_transport_picks_atomic(
  p_trip_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_logistics jsonb;
  v_picks jsonb;
  v_entry jsonb;
  v_participant_id text;
  v_user_id text;
begin
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Transport entries invalides';
  end if;

  select coalesce(group_logistics, '{}'::jsonb)
    into v_logistics
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Voyage introuvable';
  end if;

  v_picks := coalesce(v_logistics -> 'transportPicks', '[]'::jsonb);
  if jsonb_typeof(v_picks) <> 'array' then
    v_picks := '[]'::jsonb;
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    v_participant_id := nullif(v_entry ->> 'participantId', '');
    v_user_id := nullif(v_entry ->> 'userId', '');

    if v_participant_id is null and v_user_id is null then
      raise exception 'Identité transport manquante';
    end if;

    select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
      into v_picks
    from jsonb_array_elements(v_picks) with ordinality as existing(item, ord)
    where case
      when v_participant_id is not null
        then item ->> 'participantId' is distinct from v_participant_id
      else item ->> 'userId' is distinct from v_user_id
    end;

    v_picks := v_picks || jsonb_build_array(v_entry);
  end loop;

  v_logistics := jsonb_set(v_logistics, '{transportPicks}', v_picks, true);

  update public.trips
  set group_logistics = v_logistics,
      updated_at = now()
  where id = p_trip_id;

  return jsonb_build_object('transportPicks', v_picks);
end;
$$;

revoke all on function public.krew_upsert_transport_picks_atomic(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.krew_upsert_transport_picks_atomic(uuid, jsonb)
  to service_role;

notify pgrst, 'reload schema';
