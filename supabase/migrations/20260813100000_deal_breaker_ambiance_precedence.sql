-- Deal-breaker ambiances take precedence over positive ambiance preferences.
-- If the same ambiance is present in both arrays, keep it only in the
-- deal-breaker array so it cannot contribute a positive ambiance score.

create or replace function public.normalize_trip_participant_ambiances()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ambiances is not null and new.deal_breaker_ambiances is not null then
    new.ambiances := array(
      select a
      from unnest(new.ambiances) as a
      where not exists (
        select 1
        from unnest(new.deal_breaker_ambiances) as d
        where lower(trim(a)) = lower(trim(d))
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_trip_participant_ambiances
  on public.trip_participant_preferences;

create trigger trg_normalize_trip_participant_ambiances
before insert or update of ambiances, deal_breaker_ambiances
on public.trip_participant_preferences
for each row
execute function public.normalize_trip_participant_ambiances();

-- Normalize existing questionnaire responses as well.
update public.trip_participant_preferences
set ambiances = array(
  select a
  from unnest(ambiances) as a
  where not exists (
    select 1
    from unnest(deal_breaker_ambiances) as d
    where lower(trim(a)) = lower(trim(d))
  )
)
where ambiances is not null
  and deal_breaker_ambiances is not null
  and exists (
    select 1
    from unnest(ambiances) as a
    join unnest(deal_breaker_ambiances) as d
      on lower(trim(a)) = lower(trim(d))
  );
