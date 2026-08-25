-- Track outbound affiliate clicks for aggregate KREW conversion analysis.
-- Raw events are write-only from the authenticated client; reporting stays server-side.

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  target_url TEXT NOT NULL,
  offer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_clicks FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.affiliate_clicks TO authenticated;
GRANT ALL ON TABLE public.affiliate_clicks TO service_role;

CREATE POLICY "Users can record their own affiliate clicks"
ON public.affiliate_clicks
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS affiliate_clicks_trip_created_idx
ON public.affiliate_clicks (trip_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_clicks_provider_created_idx
ON public.affiliate_clicks (provider, created_at DESC);
