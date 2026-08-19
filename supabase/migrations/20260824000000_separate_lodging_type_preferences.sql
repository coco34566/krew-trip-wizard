alter table public.trip_participant_preferences
  add column if not exists lodging_type_preferences text[] not null default '{}'::text[];

-- Legacy questionnaire versions stored lodging types in required_amenities.
-- Move only those known type tokens so real amenities, if any, are preserved.
update public.trip_participant_preferences
set
  lodging_type_preferences = (
    select coalesce(array_agg(
      case
        when value in ('airbnb', 'maison', 'villa') then 'logement_entier'
        else value
      end
    ), '{}'::text[])
    from unnest(required_amenities) as value
    where value in ('hotel', 'airbnb', 'maison', 'villa', 'logement_entier', 'peu_importe')
  ),
  required_amenities = (
    select coalesce(array_agg(value), '{}'::text[])
    from unnest(required_amenities) as value
    where value not in ('hotel', 'airbnb', 'maison', 'villa', 'logement_entier', 'peu_importe')
  )
where required_amenities && array['hotel', 'airbnb', 'maison', 'villa', 'logement_entier', 'peu_importe']::text[];
