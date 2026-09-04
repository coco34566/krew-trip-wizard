create or replace function public.build_destination_card_presentation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d public.destinations%rowtype;
  subs jsonb := coalesce(new.budget->'subScores', '{}'::jsonb);
  s_budget numeric := coalesce((subs->>'sBudget')::numeric, 0);
  s_season numeric := coalesce((subs->>'sSeason')::numeric, 0);
  s_weather numeric := coalesce((subs->>'sWeather')::numeric, 0);
  s_distance numeric := coalesce((subs->>'sDistance')::numeric, 0);
  s_consensus numeric := coalesce((subs->>'sConsensus')::numeric, 0);
  s_environment numeric := coalesce((subs->>'sEnvironment')::numeric, 0);
  activity_name text;
  activity_category text;
  compatibility text;
  specific_signal text;
  vibe_signal text;
  fourth_signal text;
  rationale_bits text[] := array[]::text[];
  reasons text[] := array[]::text[];
  top_score numeric;
  has_value_badge boolean := false;
begin
  select * into d from public.destinations where id = new.destination_id;
  if not found then
    return new;
  end if;

  if new.activity_ids is not null and cardinality(new.activity_ids) > 0 then
    select a.name, a.category
      into activity_name, activity_category
    from public.activities a
    where a.id = any(new.activity_ids)
    order by array_position(new.activity_ids, a.id)
    limit 1;
  end if;

  compatibility := case
    when coalesce(new.score, 0) >= 85 then 'Compatibilité du groupe · ●●●●● · Excellent choix'
    when coalesce(new.score, 0) >= 70 then 'Compatibilité du groupe · ●●●●○ · Très bon choix'
    when coalesce(new.score, 0) >= 55 then 'Compatibilité du groupe · ●●●○○ · Bon choix'
    when coalesce(new.score, 0) >= 40 then 'Compatibilité du groupe · ●●○○○ · Choix plus mitigé'
    else 'Compatibilité du groupe · ●○○○○ · Peu adapté'
  end;
  reasons := array_append(reasons, compatibility);

  -- Signal réellement propre au lieu : activité, territoire / ancrage, cadre, puis donnée descriptive.
  if nullif(btrim(activity_name), '') is not null then
    specific_signal := d.name || ' · ' || activity_name;
    rationale_bits := array_append(rationale_bits, lower(activity_name));
  elsif d.anchor_places is not null and cardinality(d.anchor_places) > 0 then
    specific_signal := d.name || ' · ' || d.anchor_places[1];
    rationale_bits := array_append(rationale_bits, 'son ancrage autour de ' || d.anchor_places[1]);
  elsif nullif(btrim(d.region_name), '') is not null then
    specific_signal := d.name || ' · ' || d.region_name;
    rationale_bits := array_append(rationale_bits, 'son cadre en ' || d.region_name);
  elsif d.env_tags is not null and cardinality(d.env_tags) > 0 then
    specific_signal := d.name || ' · ' || initcap(replace(d.env_tags[1], '_', ' '));
    rationale_bits := array_append(rationale_bits, 'son cadre ' || lower(replace(d.env_tags[1], '_', ' ')));
  elsif nullif(btrim(d.description), '') is not null then
    specific_signal := d.name || ' · ' || left(regexp_replace(d.description, '\s+', ' ', 'g'), 72);
    if length(d.description) > 72 then specific_signal := specific_signal || '…'; end if;
    rationale_bits := array_append(rationale_bits, 'les caractéristiques propres de la destination');
  else
    specific_signal := d.name || case when nullif(btrim(d.country), '') is not null then ' · ' || d.country else '' end;
  end if;
  reasons := array_append(reasons, specific_signal);

  -- Un signal d'identité, basé sur les caractéristiques réelles du catalogue.
  top_score := greatest(
    coalesce(d.score_fete, 0), coalesce(d.score_aventure, 0), coalesce(d.score_detente, 0),
    coalesce(d.score_sportif, 0), coalesce(d.score_culturel, 0), coalesce(d.score_insolite, 0)
  );
  if top_score > 0 then
    vibe_signal := case
      when coalesce(d.score_fete, 0) = top_score then 'Vie nocturne & sorties'
      when coalesce(d.score_sportif, 0) = top_score then 'Sport & plein air'
      when coalesce(d.score_aventure, 0) = top_score then 'Aventure & découverte'
      when coalesce(d.score_detente, 0) = top_score then 'Détente & rythme doux'
      when coalesce(d.score_culturel, 0) = top_score then 'Culture & patrimoine'
      else 'Expérience plus insolite'
    end;
    reasons := array_append(reasons, vibe_signal);
    rationale_bits := array_append(rationale_bits, lower(vibe_signal));
  elsif s_environment >= 0.65 then
    vibe_signal := 'Cadre recherché par le groupe';
    reasons := array_append(reasons, vibe_signal);
    rationale_bits := array_append(rationale_bits, 'un cadre qui correspond aux envies du groupe');
  end if;

  has_value_badge :=
    coalesce(new.match_reasons, array[]::text[]) && array['💎 Meilleur rapport qualité/prix', 'Meilleur rapport qualité/prix', 'Meilleur rapport qualité-prix']
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
  elsif s_environment >= 0.55 then
    fourth_signal := 'Cadre en phase avec vos envies';
    rationale_bits := array_append(rationale_bits, 'un environnement en phase avec les envies du groupe');
  end if;

  if fourth_signal is not null and not (fourth_signal = any(reasons)) then
    reasons := array_append(reasons, fourth_signal);
  end if;

  -- L'UI actuelle affiche les 4 premiers éléments : compatibilité + 3 éléments max.
  new.match_reasons := reasons[1:4];

  -- Rationale propre à la destination et sans aucun vocabulaire d'hébergement.
  if cardinality(rationale_bits) > 0 then
    new.rationale := d.name || ' a été retenue pour ' || array_to_string(rationale_bits[1:3], ', ') || '.';
  else
    new.rationale := d.name || ' a été retenue pour les caractéristiques de la destination et sa compatibilité avec le groupe.';
  end if;

  return new;
end;
$$;

drop trigger if exists recommendations_destination_card_presentation on public.recommendations;
create trigger recommendations_destination_card_presentation
before insert or update of destination_id, score, budget, match_reasons, activity_ids
on public.recommendations
for each row
execute function public.build_destination_card_presentation();

-- Recalcule les recommandations déjà présentes afin que les voyages de test existants
-- profitent immédiatement du nouveau contenu sans nécessiter une régénération.
update public.recommendations
set score = score;
