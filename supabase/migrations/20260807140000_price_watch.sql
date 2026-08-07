-- Suivi de prix (intention utilisateur, pas de poll API)
CREATE TABLE IF NOT EXISTS public.price_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE SET NULL,
  destination_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, created_by, recommendation_id)
);

CREATE INDEX IF NOT EXISTS price_watch_created_by_idx ON public.price_watch (created_by);
CREATE INDEX IF NOT EXISTS price_watch_trip_idx ON public.price_watch (trip_id);

ALTER TABLE public.price_watch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_watch' AND policyname = 'price_watch select own'
  ) THEN
    CREATE POLICY "price_watch select own" ON public.price_watch
      FOR SELECT TO authenticated
      USING (created_by = auth.uid() OR public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_watch' AND policyname = 'price_watch insert own'
  ) THEN
    CREATE POLICY "price_watch insert own" ON public.price_watch
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_watch' AND policyname = 'price_watch update own'
  ) THEN
    CREATE POLICY "price_watch update own" ON public.price_watch
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_watch' AND policyname = 'price_watch delete own'
  ) THEN
    CREATE POLICY "price_watch delete own" ON public.price_watch
      FOR DELETE TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_watch TO authenticated;
GRANT ALL ON public.price_watch TO service_role;
