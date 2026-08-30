-- Prevent concurrent hotel votes / transport picks from overwriting each other.
-- These RPCs are intentionally callable only by service_role: application code
-- performs the user membership/role checks before invoking them server-side.

create or replace function public.krew_vote_hotel_atomic(
  p_trip_id uuid,
  p_user_id uuid,
  p_hotel_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_logistics jsonb;
  v_hotels jsonb;
  v_votes jsonb;
  v_existing_hotel_id text;
  v_top_id text;
  v_top_n integer := 0;
  v_todo text;
begin
  select coalesce(group_logistics, '{}'::jsonb)
    into v_logistics
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'Voyage introuvable';
  end if;

  v_hotels := coalesce(v_logistics -> 'hotels', '[]'::jsonb);
  if jsonb_typeof(v_hotels) <> 'array'
     or not exists (
       select 1
       from jsonb_array_elements(v_hotels) as hotel
       where hotel ->> 'id' = p_hotel_id
     ) then
    raise exception 'Cet hébergement n''appartient pas aux propositions de ce voyage';
  end if;

  v_votes := coalesce(v_logistics -> 'hotelVotes', '[]'::jsonb);
  if jsonb_typeof(v_votes) <> 'array' then
    v_votes := '[]'::jsonb;
  end if;

  select vote ->> 'hotelId'
    into v_existing_hotel_id
  from jsonb_array_elements(v_votes) as vote
  where vote ->> 'userId' = p_user_id::text
  limit 1;

  select coalesce(jsonb_agg(vote order by ord), '[]'::jsonb)
    into v_votes
  from jsonb_array_elements(v_votes) with ordinality as existing(vote, ord)
  where vote ->> 'userId' <> p_user_id::text;

  -- Same hotel = toggle off. Different/no previous vote = replace/add.
  if v_existing_hotel_id is distinct from p_hotel_id then
    v_votes := v_votes || jsonb_build_array(
      jsonb_build_object(
        'userId', p_user_id::text,
        'hotelId', p_hotel_id,
        'at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    );
  end if;

  with expanded as (
    select vote ->> 'hotelId' as hotel_id, ord
    from jsonb_array_elements(v_votes) with ordinality as item(vote, ord)
    where nullif(vote ->> 'hotelId', '') is not null
  ), counts as (
    select hotel_id, count(*)::integer as n, min(ord) as first_ord
    from expanded
    group by hotel_id
  )
  select hotel_id, n
    into v_top_id, v_top_n
  from counts
  order by n desc, first_ord asc
  limit 1;

  if v_top_id is null then
    v_todo := 'Faire voter le groupe sur un hôtel';
  else
    v_todo := format(
      'Réserver l''hôtel plébiscité (%s vote%s)',
      v_top_n,
      case when v_top_n > 1 then 's' else '' end
    );
  end if;

  v_logistics := jsonb_set(v_logistics, '{hotelVotes}', v_votes, true);
  v_logistics := jsonb_set(
    v_logistics,
    '{selectedHotelId}',
    coalesce(to_jsonb(v_top_id), 'null'::jsonb),
    true
  );
  v_logistics := jsonb_set(v_logistics, '{hotelVoteTodo}', to_jsonb(v_todo), true);

  update public.trips
  set group_logistics = v_logistics,
      updated_at = now()
  where id = p_trip_id;

  return jsonb_build_object(
    'hotelVotes', v_votes,
    'selectedHotelId', v_top_id
  );
end;
$$;

create or replace function public.krew_pick_transport_atomic(
  p_trip_id uuid,
  p_user_id uuid,
  p_entry jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_logistics jsonb;
  v_picks jsonb;
  v_next_picks jsonb;
  v_found boolean := false;
begin
  if coalesce(p_entry ->> 'userId', '') <> p_user_id::text then
    raise exception 'Transport invalide';
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

  select exists (
    select 1
    from jsonb_array_elements(v_picks) as pick
    where pick ->> 'userId' = p_user_id::text
  ) into v_found;

  select coalesce(
    jsonb_agg(
      case
        when pick ->> 'userId' = p_user_id::text then p_entry
        else pick
      end
      order by ord
    ),
    '[]'::jsonb
  )
    into v_next_picks
  from jsonb_array_elements(v_picks) with ordinality as existing(pick, ord);

  if not v_found then
    v_next_picks := v_next_picks || jsonb_build_array(p_entry);
  end if;

  v_logistics := jsonb_set(v_logistics, '{transportPicks}', v_next_picks, true);

  update public.trips
  set group_logistics = v_logistics,
      updated_at = now()
  where id = p_trip_id;

  return jsonb_build_object(
    'pick', p_entry,
    'transportPicks', v_next_picks
  );
end;
$$;

revoke all on function public.krew_vote_hotel_atomic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.krew_pick_transport_atomic(uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.krew_vote_hotel_atomic(uuid, uuid, text) to service_role;
grant execute on function public.krew_pick_transport_atomic(uuid, uuid, jsonb) to service_role;
