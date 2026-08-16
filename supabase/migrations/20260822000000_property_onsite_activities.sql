alter table public.accommodations
  add column if not exists onsite_activity_categories text[] not null default '{}';

comment on column public.accommodations.onsite_activity_categories is
  'Verified KREW activity categories available on the property itself; distinct from amenities and nearby destination activities.';
