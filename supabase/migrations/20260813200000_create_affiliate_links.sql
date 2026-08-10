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

-- Allow anyone to view affiliate links
CREATE POLICY "Public read access for affiliate links" ON public.affiliate_links
  FOR SELECT TO authenticated, anon
  USING (true);

-- Allow only authenticated users to insert affiliate links
CREATE POLICY "Only authenticated can insert affiliate links" ON public.affiliate_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Revoke all privileges on affiliate_links from public and standard roles
REVOKE ALL ON public.affiliate_links FROM PUBLIC, authenticated, anon;

-- Grant select to anyone, insert to authenticated, and all to service_role
GRANT SELECT ON public.affiliate_links TO authenticated, anon;
GRANT INSERT ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;

NOTIFY pgrst, 'reload schema';
