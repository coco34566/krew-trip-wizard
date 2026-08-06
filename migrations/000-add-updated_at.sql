ALTER TABLE trip_participant_preferences
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL;
