-- KREW pre-launch account deletion hardening.
-- owner_id is NOT NULL, so account deletion must resolve owned trips before
-- removing the auth user. When a co-organizer exists, ownership is transferred
-- to them; otherwise the owned trip is deleted rather than left invalid.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Resolve trips owned by the account before deleting auth.users.
  for v_trip in
    select id, co_organizer_id
    from public.trips
    where owner_id = v_user_id
    for update
  loop
    if v_trip.co_organizer_id is not null and v_trip.co_organizer_id <> v_user_id then
      update public.trips
      set owner_id = v_trip.co_organizer_id,
          co_organizer_id = null
      where id = v_trip.id;
    else
      delete from public.trips where id = v_trip.id;
    end if;
  end loop;

  -- Remove user-specific responses and watches that are not handled by a
  -- participant-row cascade.
  delete from public.trip_participant_preferences where user_id = v_user_id;
  delete from public.trip_availability where user_id = v_user_id;
  delete from public.recommendation_votes where user_id = v_user_id;
  delete from public.activity_votes where user_id = v_user_id;
  delete from public.generation_rate_limits where user_id = v_user_id;
  delete from public.price_watch where created_by = v_user_id;

  -- Keep collective Star data when useful, but unlink the deleted identity.
  update public.trip_star_preferences set user_id = null where user_id = v_user_id;
  update public.trip_star_preferences set filled_by = null where filled_by = v_user_id;

  -- Participant-dependent rows already use CASCADE or SET NULL as appropriate:
  -- destination_feedback / trip_payments / transport prefs cascade, while task
  -- assignments are preserved and become unassigned.
  delete from public.trip_participants where user_id = v_user_id;

  -- Remove any remaining role references on trips owned by someone else.
  update public.trips set co_organizer_id = null where co_organizer_id = v_user_id;
  update public.trips set star_user_id = null where star_user_id = v_user_id;

  delete from public.profiles where id = v_user_id;
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Deletes the authenticated KREW account, transferring owned trips to an existing co-organizer when possible and otherwise deleting those owned trips safely.';
