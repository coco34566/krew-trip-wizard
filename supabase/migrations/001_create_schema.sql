-- Activation d’extension pour gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table users (minimal)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  avatar_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table trips
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text,
  start_date date,
  end_date date,
  budget_per_person numeric(10,2),
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table participants (invités)
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email text,
  name text,
  role text,
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (trip_id, coalesce(email, user_id::text))
);

-- Table responses (réponses individuelles sauvegardées)
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
  answers jsonb NOT NULL, -- structure libre (disponibilités, préférences, contraintes...)
  created_at timestamptz DEFAULT now()
);

-- Table preferences_aggregate (résumé/agrégation pour scoring)
CREATE TABLE IF NOT EXISTS preferences_aggregate (
  trip_id uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  aggregated jsonb NOT NULL,
  computed_at timestamptz DEFAULT now()
);

-- Table proposals (propositions générées)
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title text,
  score numeric(5,2),
  details jsonb, -- day-by-day, hotels, activities, cost_estimate, links
  created_at timestamptz DEFAULT now()
);

-- Table votes (voting par participant sur une proposition)
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
  vote_type text, -- 'up' / 'down' / 'prefer' / 'yes' / 'no' etc.
  created_at timestamptz DEFAULT now(),
  UNIQUE (proposal_id, participant_id)
);

-- Table feedbacks / comments
CREATE TABLE IF NOT EXISTS feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
  comment text,
  rating smallint CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

-- Indexes utiles
CREATE INDEX IF NOT EXISTS idx_responses_trip ON responses (trip_id);
CREATE INDEX IF NOT EXISTS idx_participants_trip_accepted ON participants (trip_id, accepted);
CREATE INDEX IF NOT EXISTS idx_proposals_trip_score ON proposals (trip_id, score DESC);

-- Trigger pour mettre à jour updated_at sur trips
CREATE OR REPLACE FUNCTION trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trips_updated_at ON trips;
CREATE TRIGGER trg_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION trips_updated_at();

-- FIN migration
