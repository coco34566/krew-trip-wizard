-- KREW pre-launch participant lifecycle hardening.
-- Inactive participants must stop influencing group calculations while an
-- "absent" participant keeps read access to the trip and may rejoin later.

-- Response writes are guarded independently from is_trip_member so that
-- status = 'absent' can remain a read-only member state.
create or replace function public.guard_inactive_participant_response_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  current_status text;
begin
  -- Service-role / maintenance operations are not user-submitted responses.
  if current_uid is null then
    return new;
  end if;

  if new.user_id is distinct from current_uid then
    raise exception '403 Forbidden';
  end if;

  if public.is_trip_admin(new.trip_id, current_uid) then
    return new;
  end if;

  select p.status::text
    into current_status
  from public.trip_participants p
  where p.trip_id = new.trip_id
    and p.user_id = current_uid
  limit 1;

  if current_status is null or current_status in ('absent', 'refuse') then
    raise exception 'Participant inactif';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_inactive_participant_response_write()
  from public, anon, authenticated;

drop trigger if exists guard_inactive_participant_preferences_write_trigger
  on public.trip_participant_preferences;
create trigger guard_inactive_participant_preferences_write_trigger
before insert or update on public.trip_participant_preferences
for each row
execute function public.guard_inactive_participant_response_write();

drop trigger if exists guard_inactive_participant_availability_write_trigger
  on public.trip_availability;
create trigger guard_inactive_participant_availability_write_trigger
before insert or update on public.trip_availability
for each row
execute function public.guard_inactive_participant_response_write();

-- Transport time preferences are personal inputs too: an inactive participant
-- may still read the trip, but cannot create/update/delete transport preferences.
alter policy "Users can manage their own transport time preferences"
on public.trip_transport_time_prefs
using (
  exists (
    select 1
    from public.trip_participants p
    where p.id = trip_transport_time_prefs.participant_id
      and p.trip_id = trip_transport_time_prefs.trip_id
      and p.user_id = (select auth.uid())
      and p.status not in ('refuse', 'absent')
  )
)
with check (
  exists (
    select 1
    from public.trip_participants p
    where p.id = trip_transport_time_prefs.participant_id
      and p.trip_id = trip_transport_time_prefs.trip_id
      and p.user_id = (select auth.uid())
      and p.status not in ('refuse', 'absent')
  )
);

-- Task creation/deletion is structural organization work. Normal participants
-- can still change the status of their own assigned task through the hardened
-- UPDATE policy, but cannot create or delete tasks directly.
alter policy "trip_tasks insert members" on public.trip_tasks
  with check (public.is_trip_admin(trip_id, (select auth.uid())));

alter policy "trip_tasks delete members" on public.trip_tasks
  using (public.is_trip_admin(trip_id, (select auth.uid())));

-- Centralize cleanup when a participant becomes inactive or is removed. This
-- prevents stale answers, votes and choices from affecting group decisions.
create or replace function public.cleanup_inactive_trip_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
  v_trip_id uuid;
  v_user_id uuid;
  v_logistics jsonb;
  v_transport_picks jsonb;
  v_hotel_votes jsonb;
begin
  if tg_op = 'DELETE' then
    v_participant_id := old.id;
    v_trip_id := old.trip_id;
    v_user_id := old.user_id;
  else
    -- Only act when crossing from an active state into an inactive state.
    if new.status::text not in ('refuse', 'absent')
       or old.status::text in ('refuse', 'absent') then
      return new;
    end if;
    v_participant_id := new.id;
    v_trip_id := new.trip_id;
    v_user_id := new.user_id;
  end if;

  if v_user_id is not null then
    delete from public.trip_availability
      where trip_id = v_trip_id and user_id = v_user_id;
    delete from public.trip_participant_preferences
      where trip_id = v_trip_id and user_id = v_user_id;
    delete from public.recommendation_votes
      where trip_id = v_trip_id and user_id = v_user_id;
    delete from public.activity_votes
      where trip_id = v_trip_id and user_id = v_user_id;
  end if;

  delete from public.trip_transport_time_prefs
    where participant_id = v_participant_id;
  delete from public.destination_feedback
    where participant_id = v_participant_id;

  -- Do not leave tasks assigned to somebody who is no longer participating.
  update public.trip_tasks
    set assigned_participant_id = null,
        is_manually_assigned = false,
        updated_at = now()
    where assigned_participant_id = v_participant_id;

  -- A co-organizer must be actively participating. Inactivity/removal revokes
  -- the elevated role immediately, while ownership is never changed here.
  if v_user_id is not null then
    update public.trips
      set co_organizer_id = null,
          updated_at = now()
      where id = v_trip_id
        and co_organizer_id = v_user_id;
  end if;

  -- Remove personal collaborative state stored in group_logistics. Keep the
  -- selected hotel itself unchanged because it may already be booked.
  if v_user_id is not null then
    select coalesce(group_logistics, '{}'::jsonb)
      into v_logistics
      from public.trips
      where id = v_trip_id;

    if v_logistics is not null then
      if jsonb_typeof(v_logistics -> 'transportPicks') = 'array' then
        select coalesce(jsonb_agg(item), '[]'::jsonb)
          into v_transport_picks
          from jsonb_array_elements(v_logistics -> 'transportPicks') as item
          where item ->> 'userId' is distinct from v_user_id::text;
        v_logistics := jsonb_set(
          v_logistics,
          '{transportPicks}',
          coalesce(v_transport_picks, '[]'::jsonb),
          true
        );
      end if;

      if jsonb_typeof(v_logistics -> 'hotelVotes') = 'array' then
        select coalesce(jsonb_agg(item), '[]'::jsonb)
          into v_hotel_votes
          from jsonb_array_elements(v_logistics -> 'hotelVotes') as item
          where item ->> 'userId' is distinct from v_user_id::text;
        v_logistics := jsonb_set(
          v_logistics,
          '{hotelVotes}',
          coalesce(v_hotel_votes, '[]'::jsonb),
          true
        );
      end if;

      update public.trips
        set group_logistics = v_logistics,
            updated_at = now()
        where id = v_trip_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.cleanup_inactive_trip_participant()
  from public, anon, authenticated;

drop trigger if exists cleanup_inactive_trip_participant_on_status
  on public.trip_participants;
create trigger cleanup_inactive_trip_participant_on_status
after update of status on public.trip_participants
for each row
execute function public.cleanup_inactive_trip_participant();

drop trigger if exists cleanup_inactive_trip_participant_on_delete
  on public.trip_participants;
create trigger cleanup_inactive_trip_participant_on_delete
after delete on public.trip_participants
for each row
execute function public.cleanup_inactive_trip_participant();

comment on function public.cleanup_inactive_trip_participant() is
  'Removes stale group inputs and elevated rights when a participant becomes inactive or is removed.';

notify pgrst, 'reload schema';
