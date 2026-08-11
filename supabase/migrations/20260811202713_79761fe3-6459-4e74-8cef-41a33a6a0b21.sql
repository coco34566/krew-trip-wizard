ALTER TYPE public.participant_status ADD VALUE IF NOT EXISTS 'absent';
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'annule';

CREATE TABLE IF NOT EXISTS public.price_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES public.recommendations(id) ON DELETE CASCADE,
  destination_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_watch_unique_idx
  ON public.price_watch (trip_id, created_by, recommendation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_watch TO authenticated;
GRANT ALL ON public.price_watch TO service_role;

ALTER TABLE public.price_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own price watches"
  ON public.price_watch FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by AND public.is_trip_member(trip_id, auth.uid()));

CREATE TRIGGER price_watch_set_updated_at
  BEFORE UPDATE ON public.price_watch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();