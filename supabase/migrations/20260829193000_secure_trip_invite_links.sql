-- KREW pre-launch invitation hardening.
-- A trip UUID identifies a trip; it must not also act as a permanent join secret.
-- Invite secrets live in a separate table that end-user Supabase clients cannot read.

create table if not exists public.trip_invite_links (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  token uuid not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table public.trip_invite_links enable row level security;

-- No anon/authenticated policies on purpose. All reads and rotations go through
-- authenticated server functions using the service-role client after role checks.
revoke all on table public.trip_invite_links from anon, authenticated;
grant select, insert, update, delete on table public.trip_invite_links to service_role;

comment on table public.trip_invite_links is
  'Revocable shared invitation secrets. Trip IDs are identifiers, not join credentials.';
