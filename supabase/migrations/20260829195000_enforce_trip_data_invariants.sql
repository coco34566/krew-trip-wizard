-- KREW pre-launch data integrity hardening.
-- Protect a small set of states that are always invalid, including under
-- concurrent writes or direct Supabase mutations.

-- A trip can have at most one final selected recommendation/destination.
create unique index if not exists recommendations_one_selected_per_trip
  on public.recommendations(trip_id)
  where is_selected is true;

-- A locked date range must be complete and chronological.
alter table public.trips
  drop constraint if exists trips_locked_dates_are_complete;

alter table public.trips
  add constraint trips_locked_dates_are_complete
  check (
    dates_locked is distinct from true
    or (
      start_date is not null
      and end_date is not null
      and start_date <= end_date
    )
  );

-- An assigned task may only point to a participant belonging to the same trip.
create or replace function public.guard_trip_task_assignee_trip()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.assigned_participant_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.trip_participants tp
    where tp.id = new.assigned_participant_id
      and tp.trip_id = new.trip_id
  ) then
    raise exception 'task assignee must belong to the same trip'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_trip_task_assignee_trip() from public;

drop trigger if exists guard_trip_task_assignee_trip on public.trip_tasks;

create trigger guard_trip_task_assignee_trip
before insert or update of assigned_participant_id, trip_id on public.trip_tasks
for each row
execute function public.guard_trip_task_assignee_trip();

comment on function public.guard_trip_task_assignee_trip() is
  'Rejects task assignments to a participant from another trip.';
