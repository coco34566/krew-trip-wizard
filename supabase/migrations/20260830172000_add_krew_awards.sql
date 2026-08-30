create table if not exists public.trip_award_votes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (
    category in (
      'gps-humain',
      'premier-debout',
      'dernier-pret',
      'photographe-officiel',
      'maitre-du-planning',
      'toujours-partant'
    )
  ),
  nominee_participant_id uuid not null references public.trip_participants(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_award_votes_one_choice_per_category unique (trip_id, category, voter_user_id)
);

create index if not exists trip_award_votes_trip_id_idx
  on public.trip_award_votes(trip_id);

alter table public.trip_award_votes enable row level security;

create policy "Trip members can read Krew Awards"
on public.trip_award_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.trip_participants member
    where member.trip_id = trip_award_votes.trip_id
      and member.user_id = auth.uid()
      and member.status = 'accepte'
  )
);

create policy "Trip members can create their Krew Award choices"
on public.trip_award_votes
for insert
to authenticated
with check (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.trip_participants voter
    where voter.trip_id = trip_award_votes.trip_id
      and voter.user_id = auth.uid()
      and voter.status = 'accepte'
  )
  and exists (
    select 1
    from public.trip_participants nominee
    where nominee.id = trip_award_votes.nominee_participant_id
      and nominee.trip_id = trip_award_votes.trip_id
      and nominee.status = 'accepte'
  )
);

create policy "Trip members can update their own Krew Award choices"
on public.trip_award_votes
for update
to authenticated
using (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.trip_participants voter
    where voter.trip_id = trip_award_votes.trip_id
      and voter.user_id = auth.uid()
      and voter.status = 'accepte'
  )
)
with check (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.trip_participants voter
    where voter.trip_id = trip_award_votes.trip_id
      and voter.user_id = auth.uid()
      and voter.status = 'accepte'
  )
  and exists (
    select 1
    from public.trip_participants nominee
    where nominee.id = trip_award_votes.nominee_participant_id
      and nominee.trip_id = trip_award_votes.trip_id
      and nominee.status = 'accepte'
  )
);

create policy "Trip members can remove their own Krew Award choices"
on public.trip_award_votes
for delete
to authenticated
using (
  voter_user_id = auth.uid()
  and exists (
    select 1
    from public.trip_participants voter
    where voter.trip_id = trip_award_votes.trip_id
      and voter.user_id = auth.uid()
      and voter.status = 'accepte'
  )
);
