-- KREW pre-launch role hardening.
-- trips.co_organizer_id is the only authoritative co-organizer identity.
-- group_logistics may contain presentation/configuration data, but must never
-- contain a parallel co_organizer_id capable of drifting from the relational column.

update public.trips
set group_logistics = group_logistics - 'co_organizer_id'
where group_logistics ? 'co_organizer_id';

create or replace function public.remove_legacy_coorganizer_from_group_logistics()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.group_logistics is not null and new.group_logistics ? 'co_organizer_id' then
    new.group_logistics := new.group_logistics - 'co_organizer_id';
  end if;
  return new;
end;
$$;

revoke all on function public.remove_legacy_coorganizer_from_group_logistics() from public;

drop trigger if exists remove_legacy_coorganizer_from_group_logistics on public.trips;

create trigger remove_legacy_coorganizer_from_group_logistics
before insert or update of group_logistics on public.trips
for each row
execute function public.remove_legacy_coorganizer_from_group_logistics();

comment on function public.remove_legacy_coorganizer_from_group_logistics() is
  'Keeps trips.co_organizer_id as the single source of truth by stripping the legacy group_logistics.co_organizer_id key.';
