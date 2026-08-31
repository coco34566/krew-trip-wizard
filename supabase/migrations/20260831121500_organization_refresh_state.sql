-- Persistent invalidation for organization data derived from structural trip choices.
-- Keeps existing content intact; only records whether each domain must be refreshed.

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

create or replace function public.krew_org_refresh_clear(
  p_logistics jsonb,
  p_section text,
  p_refreshed_at timestamptz
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
  v_context jsonb := coalesce(v_result -> 'organizationContext', '{}'::jsonb);
  v_last_refreshed jsonb := coalesce(v_context -> 'lastRefreshedAt', '{}'::jsonb);
begin
  if p_section not in ('accommodation', 'transport', 'itinerary', 'tasks') then
    raise exception 'Unsupported organization refresh section: %', p_section;
  end if;

  if not (v_sections ? p_section) then
    return v_result;
  end if;

  v_sections := v_sections - p_section;
  v_last_refreshed := v_last_refreshed || jsonb_build_object(
    p_section,
    to_jsonb(p_refreshed_at)
  );
  v_context := v_context || jsonb_build_object('lastRefreshedAt', v_last_refreshed);
  v_result := v_result || jsonb_build_object('organizationContext', v_context);

  if v_sections = '{}'::jsonb then
    v_result := v_result - 'organizationRefresh';
  else
    v_refresh := v_refresh || jsonb_build_object('sections', v_sections);
    v_result := v_result || jsonb_build_object('organizationRefresh', v_refresh);
  end if;

  return v_result;
end;
$$;

revoke all on function public.krew_org_refresh_mark(jsonb, text, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.krew_org_refresh_clear(jsonb, text, timestamptz)
  from public, anon, authenticated;

-- Existing validated trips get a baseline without becoming stale.
update public.trips
set group_logistics =
  coalesce(group_logistics, '{}'::jsonb)
  || jsonb_build_object(
    'organizationContext',
    coalesce(group_logistics -> 'organizationContext', '{}'::jsonb)
    || jsonb_build_object(
      'validatedDates',
      jsonb_build_object(
        'startDate', start_date::text,
        'endDate', end_date::text
      )
    )
  )
where dates_locked is true
  and start_date is not null
  and end_date is not null;

-- Existing selected destinations get a baseline without becoming stale.
update public.trips as t
set group_logistics =
  coalesce(t.group_logistics, '{}'::jsonb)
  || jsonb_build_object(
    'organizationContext',
    coalesce(t.group_logistics -> 'organizationContext', '{}'::jsonb)
    || jsonb_build_object(
      'selectedDestinationId', r.destination_id::text,
      'selectedRecommendationId', r.id::text,
      'destinationName', d.name
    )
  )
from public.recommendations as r
left join public.destinations as d on d.id = r.destination_id
where r.trip_id = t.id
  and r.is_selected is true;

create or replace function public.krew_track_validated_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
  v_previous jsonb;
  v_changed_at timestamptz := now();
begin
  if new.dates_locked is not true
    or new.start_date is null
    or new.end_date is null
  then
    return new;
  end if;

  new.group_logistics := coalesce(new.group_logistics, '{}'::jsonb);
  v_context := coalesce(new.group_logistics -> 'organizationContext', '{}'::jsonb);
  v_previous := v_context -> 'validatedDates';

  if v_previous is not null
    and (
      (v_previous ->> 'startDate') is distinct from new.start_date::text
      or (v_previous ->> 'endDate') is distinct from new.end_date::text
    )
  then
    new.group_logistics := public.krew_org_refresh_mark(
      new.group_logistics,
      'dates',
      v_changed_at,
      null
    );
    v_context := coalesce(new.group_logistics -> 'organizationContext', '{}'::jsonb);
  end if;

  v_context := v_context || jsonb_build_object(
    'validatedDates',
    jsonb_build_object(
      'startDate', new.start_date::text,
      'endDate', new.end_date::text
    )
  );
  new.group_logistics := new.group_logistics
    || jsonb_build_object('organizationContext', v_context);

  return new;
end;
$$;

drop trigger if exists krew_track_validated_date_change on public.trips;
create trigger krew_track_validated_date_change
before update of start_date, end_date, dates_locked on public.trips
for each row
execute function public.krew_track_validated_date_change();

revoke all on function public.krew_track_validated_date_change()
  from public, anon, authenticated;

create or replace function public.krew_track_selected_destination_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_logistics jsonb;
  v_context jsonb;
  v_previous_destination_id text;
  v_destination_name text;
  v_changed_at timestamptz := now();
begin
  if new.is_selected is not true then
    return new;
  end if;

  select coalesce(t.group_logistics, '{}'::jsonb)
  into v_logistics
  from public.trips as t
  where t.id = new.trip_id
  for update;

  if not found then
    return new;
  end if;

  select d.name
  into v_destination_name
  from public.destinations as d
  where d.id = new.destination_id;

  v_context := coalesce(v_logistics -> 'organizationContext', '{}'::jsonb);
  v_previous_destination_id := v_context ->> 'selectedDestinationId';

  if v_previous_destination_id is not null
    and v_previous_destination_id is distinct from new.destination_id::text
  then
    v_logistics := public.krew_org_refresh_mark(
      v_logistics,
      'destination',
      v_changed_at,
      v_destination_name
    );
    v_context := coalesce(v_logistics -> 'organizationContext', '{}'::jsonb);
  end if;

  v_context := v_context || jsonb_build_object(
    'selectedDestinationId', new.destination_id::text,
    'selectedRecommendationId', new.id::text,
    'destinationName', v_destination_name
  );
  v_logistics := v_logistics || jsonb_build_object(
    'organizationContext',
    v_context
  );

  update public.trips
  set group_logistics = v_logistics
  where id = new.trip_id;

  return new;
end;
$$;

drop trigger if exists krew_track_selected_destination_change on public.recommendations;
create trigger krew_track_selected_destination_change
after insert or update of is_selected, destination_id on public.recommendations
for each row
execute function public.krew_track_selected_destination_change();

revoke all on function public.krew_track_selected_destination_change()
  from public, anon, authenticated;

create or replace function public.krew_clear_refreshed_trip_sections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed_at timestamptz := now();
begin
  -- A hotel vote/selection alone must not make stale proposals current again.
  if (
      old.group_logistics -> 'hotels' is distinct from new.group_logistics -> 'hotels'
      or old.group_logistics -> 'hotelsGeneratedAt'
        is distinct from new.group_logistics -> 'hotelsGeneratedAt'
    )
  then
    new.group_logistics := public.krew_org_refresh_clear(
      new.group_logistics,
      'accommodation',
      v_refreshed_at
    );
  end if;

  -- Individual transportPicks remain independent and do not clear group transport staleness.
  if (
      old.group_logistics -> 'transports'
        is distinct from new.group_logistics -> 'transports'
      or old.group_logistics -> 'transportsGeneratedAt'
        is distinct from new.group_logistics -> 'transportsGeneratedAt'
    )
  then
    new.group_logistics := public.krew_org_refresh_clear(
      new.group_logistics,
      'transport',
      v_refreshed_at
    );
  end if;

  if old.group_itinerary is distinct from new.group_itinerary then
    new.group_logistics := public.krew_org_refresh_clear(
      new.group_logistics,
      'itinerary',
      v_refreshed_at
    );
  end if;

  return new;
end;
$$;

drop trigger if exists krew_clear_refreshed_trip_sections on public.trips;
create trigger krew_clear_refreshed_trip_sections
before update of group_logistics, group_itinerary on public.trips
for each row
execute function public.krew_clear_refreshed_trip_sections();

revoke all on function public.krew_clear_refreshed_trip_sections()
  from public, anon, authenticated;

create or replace function public.krew_clear_tasks_review_after_material_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_logistics jsonb;
  v_changed boolean := false;
begin
  if tg_op = 'DELETE' then
    v_trip_id := old.trip_id;
    v_changed := true;
  elsif tg_op = 'INSERT' then
    v_trip_id := new.trip_id;
    v_changed := true;
  elsif tg_op = 'UPDATE' then
    v_trip_id := new.trip_id;
    v_changed :=
      old.slot_id is distinct from new.slot_id
      or old.title is distinct from new.title
      or old.type is distinct from new.type
      or old.booking_url is distinct from new.booking_url
      or old.start_time is distinct from new.start_time
      or old.day_date is distinct from new.day_date
      or old.price is distinct from new.price;
  end if;

  if not v_changed or v_trip_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select coalesce(t.group_logistics, '{}'::jsonb)
  into v_logistics
  from public.trips as t
  where t.id = v_trip_id
  for update;

  if found then
    v_logistics := public.krew_org_refresh_clear(
      v_logistics,
      'tasks',
      now()
    );
    update public.trips
    set group_logistics = v_logistics
    where id = v_trip_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists krew_clear_tasks_review_after_material_change on public.trip_tasks;
create trigger krew_clear_tasks_review_after_material_change
after insert or update or delete on public.trip_tasks
for each row
execute function public.krew_clear_tasks_review_after_material_change();

revoke all on function public.krew_clear_tasks_review_after_material_change()
  from public, anon, authenticated;
