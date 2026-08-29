-- Synchronize pre-launch authorization hotfixes already applied to production.
-- Idempotent by design so repository migrations can safely converge with production.

-- A trip UUID must never be sufficient to self-enrol. Membership creation goes
-- through the server-side join flow, which validates the separate invite token.
drop policy if exists "participants self join" on public.trip_participants;

-- Refused participants no longer retain member-level access through RLS.
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
          and p.status <> 'refuse'
          and (
            p.user_id = _user_id
            or lower(p.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
          )
      )
    );
$$;

-- Trigger functions are invoked by PostgreSQL itself and should not be exposed
-- as callable RPCs to anonymous or authenticated clients.
revoke execute on function public.guard_trip_participant_self_update() from anon, authenticated;
revoke execute on function public.guard_trip_task_assignee_trip() from anon, authenticated;
revoke execute on function public.guard_trip_task_participant_update() from anon, authenticated;
revoke execute on function public.normalize_trip_participant_ambiances() from anon, authenticated;
revoke execute on function public.prevent_trip_owner_change_by_authenticated_user() from anon, authenticated;
revoke execute on function public.remove_legacy_coorganizer_from_group_logistics() from anon, authenticated;
