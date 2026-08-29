-- KREW pre-launch participant lifecycle hardening.
-- Inactive participants must not keep influencing group calculations or retain
-- member-level write access. Task deletion remains an organizer responsibility.

-- Treat both "absent" and "refuse" as inactive for all RLS helpers that rely on
-- is_trip_member. Owner/co-organizer access is preserved through the trips row.
create or replace function public.is_trip_member(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _user_id = (select auth.uid())
    and (
      exists (
        select 1
        from public.trips t
        where t.id = _trip_id
          and _user_id in (t.owner_id, t.co_organizer_id)
      )
      or exists (
        select 1
        from public.trip_participants p
        where p.trip_id = _trip_id
          and p.status not in ('refuse', 'absent')
          and (
            p.user_id = _user_id
            or lower(p.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
          )
      )
    );
$$;

-- An inactive participant may delete their own historical answers, but cannot
-- create or update answers/time preferences until they are active again.
alter policy "trip_availability insert own" on public.trip_availability
  with check (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "trip_availability update own" on public.trip_availability
  using (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "participant prefs insert own" on public.trip_participant_preferences
  with check (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "participant prefs update own" on public.trip_participant_preferences
  using (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and public.is_trip_member(trip_id, (select auth.uid()))
  );

-- Transport time preferences were historically protected only by ownership of
-- participant_id. Also require that the participant is currently active.
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
-- can still change the status of their own assigned task through the already
-- hardened UPDATE policy, but cannot create or delete tasks directly.
alter policy "trip_tasks insert members" on public.trip_tasks
  with check (public.is_trip_admin(trip_id, (select auth.uid())));

alter policy "trip_tasks delete members" on public.trip_tasks
  using (public.is_trip_admin(trip_id, (select auth.uid())));

-- Centralize cleanup when a participant becomes inactive or is removed. This
-- prevents stale answers, votes, tasks and transport choices from continuing to
-- affect group decisions even when application code misses a cleanup path.
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
    if new.status not in ('refuse', 'absent')
       or old.status in ('refuse', 'absent') then
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

  -- A co-organizer must be an active participant. Removing/declining/marking
  -- them absent revokes the elevated role immediately.
  if v_user_id is not null then
    update public.trips
      set co_organizer_id = null,
          updated_at = now()
      where id = v_trip_id
        and co_organizer_id = v_user_id;
  end if;

  -- Remove stale personal transport choices and hotel votes from group_logistics
  -- so downstream planning/cost calculations no longer consume them. Keep the
  -- selected hotel itself unchanged: it may already represent a booked decision.
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
        v_logistics := jsonb_set(v_logistics, '{transportPicks}', coalesce(v_transport_picks, '[]'::jsonb), true);
      end if;

      if jsonb_typeof(v_logistics -> 'hotelVotes') = 'array' then
        select coalesce(jsonb_agg(item), '[]'::jsonb)
          into v_hotel_votes
          from jsonb_array_elements(v_logistics -> 'hotelVotes') as item
          where item ->> 'userId' is distinct from v_user_id::text;
        v_logistics := jsonb_set(v_logistics, '{hotelVotes}', coalesce(v_hotel_votes, '[]'::jsonb), true);
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

revoke all on function public.cleanup_inactive_trip_participant() from public, anon, authenticated;

drop trigger if exists cleanup_inactive_trip_participant_on_status on public.trip_participants;
create trigger cleanup_inactive_trip_participant_on_status
after update of status on public.trip_participants
for each row
execute function public.cleanup_inactive_trip_participant();

drop trigger if exists cleanup_inactive_trip_participant_on_delete on public.trip_participants;
create trigger cleanup_inactive_trip_participant_on_delete
after delete on public.trip_participants
for each row
execute function public.cleanup_inactive_trip_participant();

comment on function public.cleanup_inactive_trip_participant() is
  'Removes stale group inputs and elevated rights when a participant becomes inactive or is removed.';

notify pgrst, 'reload schema';
