-- KREW pre-launch integrity hardening.
-- 1) A normal participant may only change their own presentation/status fields,
--    or claim an existing email invitation for their authenticated identity.
-- 2) scoring_feedback is internal scoring telemetry: writes are admin-only.

create or replace function public.guard_trip_participant_self_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
begin
  -- Direct SQL/service-role maintenance remains unrestricted.
  if v_uid is null or current_user in ('postgres', 'service_role') then
    return new;
  end if;

  -- Owner/co-organizer keep full participant-management rights.
  if public.is_trip_admin(old.trip_id, v_uid) then
    return new;
  end if;

  -- Already-claimed participant: identity/role/trip are immutable. Only the
  -- participant-facing name and attendance status may change.
  if old.user_id = v_uid then
    if old.id is distinct from new.id
       or old.trip_id is distinct from new.trip_id
       or old.user_id is distinct from new.user_id
       or old.email is distinct from new.email
       or old.role is distinct from new.role
       or old.created_at is distinct from new.created_at then
      raise exception 'participant may only update their display name or status'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Legacy/email invitation claim: preserve the invitation identity and role,
  -- and allow exactly one transition from user_id NULL to auth.uid().
  if old.user_id is null
     and lower(old.email) = v_email
     and new.user_id = v_uid then
    if old.id is distinct from new.id
       or old.trip_id is distinct from new.trip_id
       or old.email is distinct from new.email
       or old.role is distinct from new.role
       or old.created_at is distinct from new.created_at then
      raise exception 'invitation claim cannot change participant identity fields'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'participant cannot update another participant row'
    using errcode = '42501';
end;
$$;

revoke all on function public.guard_trip_participant_self_update() from public;

drop trigger if exists guard_trip_participant_self_update on public.trip_participants;
create trigger guard_trip_participant_self_update
before update on public.trip_participants
for each row
execute function public.guard_trip_participant_self_update();

comment on function public.guard_trip_participant_self_update() is
  'Prevents participant identity/role tampering while preserving self status/name edits and legacy email invitation claiming.';

-- scoring_feedback has no per-user ownership column and feeds internal scoring
-- telemetry. Do not let a normal participant inject or rewrite group scoring data.
drop policy if exists "members insert scoring feedback" on public.scoring_feedback;
drop policy if exists "members update scoring feedback" on public.scoring_feedback;

create policy "admins insert scoring feedback"
on public.scoring_feedback
for insert
to authenticated
with check (public.is_trip_admin(trip_id, (select auth.uid())));

create policy "admins update scoring feedback"
on public.scoring_feedback
for update
to authenticated
using (public.is_trip_admin(trip_id, (select auth.uid())))
with check (public.is_trip_admin(trip_id, (select auth.uid())));

comment on table public.scoring_feedback is
  'Internal scoring telemetry. Trip members may read it; only owner/co-organizer may write it from authenticated clients.';
