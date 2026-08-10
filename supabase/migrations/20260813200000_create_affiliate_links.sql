-- Migration: Create affiliate_links table for tracking booking clicks

CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  original_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  tracking_id TEXT,
  offer_id TEXT, -- References housing, transport, activity or other custom offer ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select/insert affiliate links (or anyone if clicked publicly)
CREATE POLICY "Anyone can view and insert affiliate links" ON public.affiliate_links
  FOR ALL TO authenticated, anonymous
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated, anonymous;
GRANT ALL ON public.affiliate_links TO service_role;

NOTIFY pgrst, 'reload schema';
