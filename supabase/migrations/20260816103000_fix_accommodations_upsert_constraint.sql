-- PostgREST generates `ON CONFLICT (source, external_id)` for the StayAPI
-- catalogue upsert. PostgreSQL cannot infer the existing partial unique index
-- for that clause because the request cannot include its `external_id IS NOT
-- NULL` predicate. A regular unique index still permits multiple NULL values
-- and can be inferred by ON CONFLICT.
DROP INDEX IF EXISTS public.accommodations_source_external_id_key;

CREATE UNIQUE INDEX accommodations_source_external_id_key
  ON public.accommodations (source, external_id);
