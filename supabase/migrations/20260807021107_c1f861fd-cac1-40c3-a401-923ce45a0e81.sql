CREATE UNIQUE INDEX IF NOT EXISTS destinations_source_external_id_key ON public.destinations (source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accommodations_source_external_id_key ON public.accommodations (source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS activities_source_external_id_key ON public.activities (source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS destinations_slug_key ON public.destinations (slug);