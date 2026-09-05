-- When only a small share of the expected group has answered, keep the score
-- but present it as a provisional signal instead of an authoritative group verdict.

create or replace function public.build_destination_card_presentation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.destinations%rowtype;
  trip_size integer := 0;
  profiles_evaluated integer := coalesce((new.budget->>'participantsEvaluated')::integer, 0);
  coverage numeric := 0;
  is_provisional boolean := false;
  subs jsonb := coalesce(new.budget->'subScores', '{}'::jsonb);
  s_budget numeric := coalesce((subs->>'sBudget')::numeric, 0);
  s_season numeric := coalesce((subs->>'sSeason')::numeric, 0);
  s_weather numeric := coalesce((subs->>'sWeather')::numeric, 0);
  s_distance numeric := coalesce((subs->>'sDistance')::numeric, 0);
  s_consensus numeric := coalesce((subs->>'sConsensus')::numeric, 0);
  s_environment numeric := coalesce((subs->>'sEnvironment')::numeric, 0);
  activity_name text;
  compatibility text;
  specific_signal text;
  identity_signal text;
  fourth_signal text;
  reasons text[] := array[]::text[];
  rationale_bits text[] := array[]::text[];
  top_score numeric;
  env_first text;
  env_second text;
  has_value_badge boolean := false;
begin
  select * into d from public.destinations where id = new.destination_id;
  if not found then return new; end if;

  select coalesce(t.participants_count, 0) into trip_size
  from public.trips t where t.id = new.trip_id;
  if trip_size > 0 then
    coverage := profiles_evaluated::numeric / trip_size::numeric;
  end if;
  is_provisional := trip_size > 0 and profiles_evaluated > 0 and coverage < 0.60;

  env_first := nullif(initcap(replace(coalesce(d.env_tags[1], ''), '_', ' ')), '');
  env_second := nullif(initcap(replace(coalesce(d.env_tags[2], ''), '_', ' ')), '');

  if new.activity_ids is not null and cardinality(new.activity_ids) > 0 then
    select a.name into activity_name
    from public.activities a
    where a.id = any(new.activity_ids)
    order by array_position(new.activity_ids, a.id)
    limit 1;
  end if;

  if activity_name is null then
    select a.name into activity_name
    from public.activities a
    where a.destination_id = new.destination_id
    order by a.rating desc nulls last, a.name
    limit 1;
  end if;

  if is_provisional then
    compatibility := case
      when coalesce(new.score, 0) >= 85 then 'Compatibilité provisoire · ●●●●● · Tendance très favorable · ' || profiles_evaluated || ' profils pris en compte'
      when coalesce(new.score, 0) >= 70 then 'Compatibilité provisoire · ●●●●○ · Tendance favorable · ' || profiles_evaluated || ' profils pris en compte'
      when coalesce(new.score, 0) >= 55 then 'Compatibilité provisoire · ●●●○○ · Tendance plutôt favorable · ' || profiles_evaluated || ' profils pris en compte'
      when coalesce(new.score, 0) >= 40 then 'Compatibilité provisoire · ●●○○○ · Tendance mitigée · ' || profiles_evaluated || ' profils pris en compte'
      else 'Compatibilité provisoire · ●○○○○ · Tendance peu favorable · ' || profiles_evaluated || ' profils pris en compte'
    end;
  else
    compatibility := case
      when coalesce(new.score, 0) >= 85 then 'Compatibilité du groupe · ●●●●● · Excellent choix'
      when coalesce(new.score, 0) >= 70 then 'Compatibilité du groupe · ●●●●○ · Très bon choix'
      when coalesce(new.score, 0) >= 55 then 'Compatibilité du groupe · ●●●○○ · Bon choix'
      when coalesce(new.score, 0) >= 40 then 'Compatibilité du groupe · ●●○○○ · Choix plus mitigé'
      else 'Compatibilité du groupe · ●○○○○ · Peu adapté'
    end;
  end if;
  reasons := array_append(reasons, compatibility);

  if nullif(btrim(activity_name), '') is not null then
    specific_signal := d.name || ' · ' || activity_name;
    rationale_bits := array_append(rationale_bits, lower(activity_name));
  elsif d.anchor_places is not null and cardinality(d.anchor_places) > 0 then
    specific_signal := d.name || ' · ' || d.anchor_places[1];
    rationale_bits := array_append(rationale_bits, 'son ancrage autour de ' || d.anchor_places[1]);
  elsif nullif(btrim(d.region_name), '') is not null then
    specific_signal := d.name || ' · ' || d.region_name;
    rationale_bits := array_append(rationale_bits, 'son cadre en ' || d.region_name);
  elsif env_first is not null then
    specific_signal := d.name || ' · ' || env_first;
    rationale_bits := array_append(rationale_bits, 'son cadre ' || lower(env_first));
  else
    specific_signal := d.name || case when nullif(btrim(d.country), '') is not null then ' · ' || d.country else '' end;
    rationale_bits := array_append(rationale_bits, 'son identité propre');
  end if;
  reasons := array_append(reasons, specific_signal);

  top_score := greatest(
    coalesce(d.score_fete, 0), coalesce(d.score_aventure, 0), coalesce(d.score_detente, 0),
    coalesce(d.score_sportif, 0), coalesce(d.score_culturel, 0), coalesce(d.score_insolite, 0)
  );
  if top_score > 0 then
    identity_signal := case
      when coalesce(d.score_fete, 0) = top_score then 'Vie nocturne & sorties'
      when coalesce(d.score_sportif, 0) = top_score then 'Sport & plein air'
      when coalesce(d.score_aventure, 0) = top_score then 'Aventure & découverte'
      when coalesce(d.score_detente, 0) = top_score then 'Détente & rythme doux'
      when coalesce(d.score_culturel, 0) = top_score then 'Culture & patrimoine'
      else 'Expérience plus insolite'
    end;
  elsif env_second is not null then
    identity_signal := env_second;
  elsif env_first is not null and position(lower(env_first) in lower(specific_signal)) = 0 then
    identity_signal := env_first;
  elsif s_environment >= 0.55 then
    identity_signal := 'Cadre en phase avec vos envies';
  end if;

  if identity_signal is not null then
    reasons := array_append(reasons, identity_signal);
    rationale_bits := array_append(rationale_bits, lower(identity_signal));
  end if;

  has_value_badge :=
    coalesce(new.match_reasons, array[]::text[]) && array[
      '💎 Meilleur rapport qualité/prix',
      'Meilleur rapport qualité/prix',
      'Meilleur rapport qualité-prix'
    ]
    or coalesce(new.budget->'configuration'->>'category', '') = 'rapport_qualite_prix';

  if has_value_badge then
    fourth_signal := '💎 Meilleur rapport qualité-prix';
    rationale_bits := array_append(rationale_bits, 'son rapport qualité-prix');
  elsif s_budget >= 0.75 then
    fourth_signal := 'Budget bien maîtrisé';
    rationale_bits := array_append(rationale_bits, 'un budget cohérent avec le groupe');
  elsif s_season >= 0.8 and s_weather >= 0.6 then
    fourth_signal := 'Bonne période pour partir';
    rationale_bits := array_append(rationale_bits, 'une période favorable');
  elsif s_distance >= 0.7 then
    fourth_signal := 'Trajet plutôt simple';
    rationale_bits := array_append(rationale_bits, 'un trajet relativement simple');
  elsif s_consensus >= 0.65 then
    fourth_signal := 'Bon consensus du groupe';
    rationale_bits := array_append(rationale_bits, 'un bon consensus dans le groupe');
  elsif s_weather >= 0.68 then
    fourth_signal := 'Météo plutôt favorable';
    rationale_bits := array_append(rationale_bits, 'une météo plutôt favorable');
  end if;

  if fourth_signal is not null and not (fourth_signal = any(reasons)) then
    reasons := array_append(reasons, fourth_signal);
  end if;

  new.match_reasons := reasons[1:4];

  if cardinality(rationale_bits) > 0 then
    new.rationale := d.name || ' a été retenue pour ' || array_to_string(rationale_bits[1:3], ', ') || '.';
  else
    new.rationale := d.name || ' a été retenue pour son identité et sa compatibilité avec les envies du groupe.';
  end if;

  return new;
end;
$$;

-- Refresh existing cards immediately, including current test trips.
update public.recommendations set score = score;
