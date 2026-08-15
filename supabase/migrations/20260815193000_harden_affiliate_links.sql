-- Security hardening: affiliate_links is an internal tracking table.
-- The application currently does not expose a public CRUD surface for this table,
-- so direct client reads/writes are not required.

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for affiliate links" ON public.affiliate_links;
DROP POLICY IF EXISTS "Only authenticated can insert affiliate links" ON public.affiliate_links;

REVOKE ALL ON public.affiliate_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.affiliate_links TO service_role;

NOTIFY pgrst, 'reload schema';
