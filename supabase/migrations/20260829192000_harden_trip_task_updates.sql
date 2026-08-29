-- KREW pre-launch permission hardening for trip tasks.
-- Admins keep full task-management rights. A normal participant may only change
-- the status of a task currently assigned to their own trip_participants row.

alter policy "trip_tasks update members" on public.trip_tasks
  using (
    is_trip_admin(trip_id, (select auth.uid()))
    or exists (
      select 1
      from public.trip_participants tp
      where tp.id = trip_tasks.assigned_participant_id
        and tp.trip_id = trip_tasks.trip_id
        and tp.user_id = (select auth.uid())
    )
  )
  with check (
    is_trip_admin(trip_id, (select auth.uid()))
    or exists (
      select 1
      from public.trip_participants tp
      where tp.id = trip_tasks.assigned_participant_id
        and tp.trip_id = trip_tasks.trip_id
        and tp.user_id = (select auth.uid())
    )
  );

create or replace function public.guard_trip_task_participant_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Direct SQL/service-role maintenance has no end-user auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  -- Owner/co-organizer retain full task-management rights.
  if is_trip_admin(old.trip_id, auth.uid()) then
    return new;
  end if;

  -- Participants may only act on their own assigned task.
  if not exists (
    select 1
    from public.trip_participants tp
    where tp.id = old.assigned_participant_id
      and tp.trip_id = old.trip_id
      and tp.user_id = auth.uid()
  ) then
    raise exception 'participant cannot update a task that is not assigned to them'
      using errcode = '42501';
  end if;

  -- For a participant, status (and an optional updated_at timestamp) are the
  -- only mutable fields. Assignment, title, booking data, timing and price stay
  -- under organizer/co-organizer control.
  if old.id is distinct from new.id
     or old.trip_id is distinct from new.trip_id
     or old.slot_id is distinct from new.slot_id
     or old.title is distinct from new.title
     or old.type is distinct from new.type
     or old.assigned_participant_id is distinct from new.assigned_participant_id
     or old.booking_url is distinct from new.booking_url
     or old.start_time is distinct from new.start_time
     or old.day_date is distinct from new.day_date
     or old.price is distinct from new.price
     or old.is_manually_assigned is distinct from new.is_manually_assigned
     or old.created_at is distinct from new.created_at then
    raise exception 'participant may only change the status of their assigned task'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_trip_task_participant_update() from public;

drop trigger if exists guard_trip_task_participant_update on public.trip_tasks;

create trigger guard_trip_task_participant_update
before update on public.trip_tasks
for each row
execute function public.guard_trip_task_participant_update();

comment on function public.guard_trip_task_participant_update() is
  'Restricts non-admin task updates to status changes on the participant own assigned task.';
