-- Prevent authenticated callers from probing membership or ownership for
-- arbitrary user IDs while preserving the existing RLS helper signatures.

create or replace function public.is_trip_member(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _user_id = auth.uid()
    and (
      exists (
        select 1
        from public.trips t
        where t.id = _trip_id
          and t.owner_id = _user_id
      )
      or exists (
        select 1
        from public.trip_participants p
        where p.trip_id = _trip_id
          and (
            p.user_id = _user_id
            or lower(p.email) = lower((
              select u.email
              from auth.users u
              where u.id = _user_id
            ))
          )
      )
    );
$$;

create or replace function public.is_trip_owner(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _user_id = auth.uid()
    and exists (
      select 1
      from public.trips t
      where t.id = _trip_id
        and t.owner_id = _user_id
    );
$$;

create or replace function public.can_access_trip_star_preferences(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null
    and _user_id = auth.uid()
    and exists (
      select 1
      from public.trips t
      where t.id = _trip_id
        and (
          t.owner_id = _user_id
          or t.co_organizer_id = _user_id
          or (
            coalesce((t.group_logistics ->> 'star_mode'), 'secret') <> 'secret'
            and public.is_trip_member(_trip_id, _user_id)
          )
        )
    );
$$;

revoke execute on function public.is_trip_member(uuid, uuid)
from public, anon;
grant execute on function public.is_trip_member(uuid, uuid)
to authenticated, service_role;

revoke execute on function public.is_trip_owner(uuid, uuid)
from public, anon;
grant execute on function public.is_trip_owner(uuid, uuid)
to authenticated, service_role;

revoke execute on function public.can_access_trip_star_preferences(uuid, uuid)
from public, anon;
grant execute on function public.can_access_trip_star_preferences(uuid, uuid)
to authenticated, service_role;
