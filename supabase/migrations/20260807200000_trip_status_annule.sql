-- Statut "annule" pour archiver sans polluer les listes actives
DO $$
BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'annule';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
