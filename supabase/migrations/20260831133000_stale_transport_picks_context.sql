-- Keep historical participant transport choices after a structural trip change,
-- but make them explicitly stale and remove them from active planning inputs.
-- A participant's next transport choice replaces the stale JSON object through
-- krew_pick_transport_atomic, so the fresh choice naturally becomes active again.

create or replace function public.krew_mark_transport_picks_stale(
  p_logistics jsonb,
  p_reason text,
  p_changed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := coalesce(p_logistics, '{}'::jsonb);
  v_picks jsonb := coalesce(v_result -> 'transportPicks', '[]'::jsonb);
  v_next_picks jsonb;
begin
  if p_reason not in ('dates', 'destination') then
    raise exception 'Unsupported organization refresh reason: %', p_reason;
  end if;

  if jsonb_typeof(v_picks) <> 'array' or jsonb_array_length(v_picks) = 0 then
    return v_result;
  end if;

  select coalesce(
    jsonb_agg(
      pick
      || jsonb_build_object(
        'organizationStale', true,
        'organizationInvalidatedAt', to_jsonb(p_changed_at),
        'organizationStaleReasons',
          case
            when coalesce(pick -> 'organizationStaleReasons', '[]'::jsonb) ? p_reason
              then coalesce(pick -> 'organizationStaleReasons', '[]'::jsonb)
            else coalesce(pick -> 'organizationStaleReasons', '[]'::jsonb) || to_jsonb(p_reason)
          end,
        -- Preserve the previous values for history/debugging while removing
        -- them from the legacy active fields consumed by itinerary/cost logic.
        'previousTime', coalesce(pick -> 'previousTime', pick -> 'time', 'null'::jsonb),
        'previousArrivalTime', coalesce(pick -> 'previousArrivalTime', pick -> 'arrivalTime', 'null'::jsonb),
        'previousDepartureTime', coalesce(pick -> 'previousDepartureTime', pick -> 'departureTime', 'null'::jsonb),
        'previousOutboundDepartureTime', coalesce(pick -> 'previousOutboundDepartureTime', pick -> 'outboundDepartureTime', 'null'::jsonb),
        'previousReturnArrivalTime', coalesce(pick -> 'previousReturnArrivalTime', pick -> 'returnArrivalTime', 'null'::jsonb),
        'previousDurationHours', coalesce(pick -> 'previousDurationHours', pick -> 'durationHours', 'null'::jsonb),
        'previousPricePerPerson', coalesce(pick -> 'previousPricePerPerson', pick -> 'pricePerPerson', 'null'::jsonb),
        'previousStatus', coalesce(pick -> 'previousStatus', pick -> 'status', 'null'::jsonb),
        'time', 'null'::jsonb,
        'arrivalTime', 'null'::jsonb,
        'departureTime', 'null'::jsonb,
        'outboundDepartureTime', 'null'::jsonb,
        'returnArrivalTime', 'null'::jsonb,
        'durationHours', 'null'::jsonb,
        'pricePerPerson', 'null'::jsonb,
        'status', 'à mettre à jour'
      )
      order by ord
    ),
    '[]'::jsonb
  )
  into v_next_picks
  from jsonb_array_elements(v_picks) with ordinality as existing(pick, ord);

  return jsonb_set(v_result, '{transportPicks}', v_next_picks, true);
end;
$$;

revoke all on function public.krew_mark_transport_picks_stale(jsonb, text, timestamptz)
  from public, anon, authenticated;

-- Extend the shared structural invalidation function: section-level stale state
-- stays unchanged, while existing individual picks are explicitly demoted from
-- active planning data without being deleted.
create or replace function public.krew_org_refresh_mark(
  p_logistics jsonb,
  p_reason text,
  p_changed_at timestamptz,
  p_destination_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := coalesce(p_logistics, '{}'::jsonb);
  v_refresh jsonb := coalesce(v_result -> 'organizationRefresh', '{}'::jsonb);
  v_sections jsonb := coalesce(v_refresh -> 'sections', '{}'::jsonb);
  v_section jsonb;
  v_reasons jsonb;
  v_key text;
begin
  if p_reason not in ('dates', 'destination') then
    raise exception 'Unsupported organization refresh reason: %', p_reason;
  end if;

  foreach v_key in array array['accommodation', 'transport', 'itinerary', 'tasks']
  loop
    v_section := coalesce(v_sections -> v_key, '{}'::jsonb);
    v_reasons := coalesce(v_section -> 'reasons', '[]'::jsonb);

    if not (v_reasons ? p_reason) then
      v_reasons := v_reasons || to_jsonb(p_reason);
    end if;

    v_section := v_section || jsonb_build_object(
      'stale', true,
      'reasons', v_reasons,
      'invalidatedAt', to_jsonb(p_changed_at)
    );
    v_sections := v_sections || jsonb_build_object(v_key, v_section);
  end loop;

  v_result := public.krew_mark_transport_picks_stale(
    v_result,
    p_reason,
    p_changed_at
  );

  v_refresh := v_refresh || jsonb_build_object(
    'sections', v_sections,
    'changedAt', to_jsonb(p_changed_at)
  );

  if p_destination_name is not null and btrim(p_destination_name) <> '' then
    v_refresh := v_refresh || jsonb_build_object('destinationName', p_destination_name);
  end if;

  return v_result || jsonb_build_object('organizationRefresh', v_refresh);
end;
$$;

revoke all on function public.krew_org_refresh_mark(jsonb, text, timestamptz, text)
  from public, anon, authenticated;

-- Backfill trips that were already invalidated by the previous migration before
-- this hardening migration reached the database. Do not re-stale other sections.
update public.trips
set group_logistics = public.krew_mark_transport_picks_stale(
  group_logistics,
  'dates',
  coalesce(
    nullif(group_logistics #>> '{organizationRefresh,sections,transport,invalidatedAt}', '')::timestamptz,
    now()
  )
)
where coalesce((group_logistics #>> '{organizationRefresh,sections,transport,stale}')::boolean, false)
  and coalesce(group_logistics #> '{organizationRefresh,sections,transport,reasons}', '[]'::jsonb) ? 'dates';

update public.trips
set group_logistics = public.krew_mark_transport_picks_stale(
  group_logistics,
  'destination',
  coalesce(
    nullif(group_logistics #>> '{organizationRefresh,sections,transport,invalidatedAt}', '')::timestamptz,
    now()
  )
)
where coalesce((group_logistics #>> '{organizationRefresh,sections,transport,stale}')::boolean, false)
  and coalesce(group_logistics #> '{organizationRefresh,sections,transport,reasons}', '[]'::jsonb) ? 'destination';
