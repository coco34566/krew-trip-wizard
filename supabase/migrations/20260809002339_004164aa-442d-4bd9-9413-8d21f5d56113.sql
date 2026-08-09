CREATE TABLE IF NOT EXISTS public.trip_transport_time_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
  earliest_departure_time text,
  latest_return_time text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_transport_time_prefs TO authenticated;
GRANT ALL ON public.trip_transport_time_prefs TO service_role;
ALTER TABLE public.trip_transport_time_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read transport time prefs" ON public.trip_transport_time_prefs FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members insert transport time prefs" ON public.trip_transport_time_prefs FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members update transport time prefs" ON public.trip_transport_time_prefs FOR UPDATE TO authenticated USING (public.is_trip_member(trip_id, auth.uid())) WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members delete transport time prefs" ON public.trip_transport_time_prefs FOR DELETE TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE TRIGGER transport_time_prefs_updated_at BEFORE UPDATE ON public.trip_transport_time_prefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.trip_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  platform_fee_cents integer NOT NULL DEFAULT 0,
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_payments_trip_idx ON public.trip_payments (trip_id, participant_id);
GRANT SELECT, INSERT ON public.trip_payments TO authenticated;
GRANT ALL ON public.trip_payments TO service_role;
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read trip payments" ON public.trip_payments FOR SELECT TO authenticated USING (public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "members create own trip payments" ON public.trip_payments FOR INSERT TO authenticated WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
CREATE TRIGGER trip_payments_updated_at BEFORE UPDATE ON public.trip_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();