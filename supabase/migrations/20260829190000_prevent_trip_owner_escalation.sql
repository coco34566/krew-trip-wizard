-- KREW pre-launch role hardening.
-- Product invariant: a co-organizer has the same operational rights as the owner,
-- except that they must never be able to become the owner or delete the trip.
--
-- RLS alone cannot safely enforce immutability of owner_id on UPDATE because a
-- co-organizer can make the proposed row satisfy the same admin WITH CHECK by
-- assigning owner_id = auth.uid(). Enforce the invariant at row level instead.

create or replace function public.prevent_trip_owner_change_by_authenticated_user()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.owner_id is distinct from new.owner_id
     and auth.uid() is not null then
    raise exception 'trip owner cannot be changed by an authenticated user'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_trip_owner_change_by_authenticated_user() from public;

-- Idempotent so environments that replay migrations remain safe.
drop trigger if exists prevent_trip_owner_change_by_authenticated_user on public.trips;

create trigger prevent_trip_owner_change_by_authenticated_user
before update of owner_id on public.trips
for each row
execute function public.prevent_trip_owner_change_by_authenticated_user();

comment on function public.prevent_trip_owner_change_by_authenticated_user() is
  'Prevents authenticated users, including co-organizers, from changing trips.owner_id while preserving service-role and direct SQL maintenance.';
