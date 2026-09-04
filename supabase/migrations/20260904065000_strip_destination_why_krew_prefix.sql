create or replace function public.strip_destination_reason_prefix()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.match_reasons is not null then
    new.match_reasons := array(
      select regexp_replace(reason, '^Pourquoi KREW · ', '')
      from unnest(new.match_reasons) as reason
    );
  end if;
  return new;
end;
$$;

drop trigger if exists zz_recommendations_strip_destination_reason_prefix on public.recommendations;
create trigger zz_recommendations_strip_destination_reason_prefix
before insert or update of match_reasons, score, budget, activity_ids, destination_id
on public.recommendations
for each row
execute function public.strip_destination_reason_prefix();

update public.recommendations
set match_reasons = array(
  select regexp_replace(reason, '^Pourquoi KREW · ', '')
  from unnest(coalesce(match_reasons, array[]::text[])) as reason
)
where exists (
  select 1
  from unnest(coalesce(match_reasons, array[]::text[])) as reason
  where reason like 'Pourquoi KREW · %'
);
