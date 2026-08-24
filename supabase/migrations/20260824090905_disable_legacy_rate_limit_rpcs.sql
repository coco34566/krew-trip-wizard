-- The production application now uses the service-role-only *_server RPCs.
-- Remove direct client access to the legacy rate-limit functions.

REVOKE EXECUTE ON FUNCTION public.consume_generation_rate_limit(
  uuid, uuid, text, integer, integer, boolean
) FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.release_generation_rate_limit(
  uuid, uuid, text
) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_generation_rate_limit(
  uuid, uuid, text, integer, integer, boolean
) TO service_role;

GRANT EXECUTE ON FUNCTION public.release_generation_rate_limit(
  uuid, uuid, text
) TO service_role;
