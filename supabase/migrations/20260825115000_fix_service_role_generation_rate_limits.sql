-- Fix generation rate-limit authorization after RLS helper hardening.
-- These RPCs are executable only by service_role, so they must validate the
-- supplied authenticated user directly instead of calling is_trip_member(),
-- which intentionally requires auth.uid() = _user_id for user-facing RLS.

CREATE OR REPLACE FUNCTION public.consume_generation_rate_limit_server(
  p_trip_id uuid,
  p_user_id uuid,
  p_kind text,
  p_window_seconds integer,
  p_max_calls integer,
  p_is_user_check boolean DEFAULT false
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_scope text;
  v_count integer;
  v_oldest timestamptz;
  v_remaining integer;
  v_is_member boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id not available' USING errcode = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND (t.owner_id = p_user_id OR t.co_organizer_id = p_user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.trip_participants p
    WHERE p.trip_id = p_trip_id
      AND (
        p.user_id = p_user_id
        OR lower(p.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = p_user_id))
      )
  ) INTO v_is_member;

  IF NOT coalesce(v_is_member, false) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;

  IF p_kind NOT IN ('recommendations','itinerary','logistics')
     OR p_window_seconds < 30
     OR p_window_seconds > 3600
     OR p_max_calls < 1
     OR p_max_calls > 10 THEN
    RAISE EXCEPTION 'invalid rate limit parameters';
  END IF;

  v_scope := CASE WHEN p_is_user_check
    THEN p_user_id::text || ':' || p_kind
    ELSE p_trip_id::text || ':' || p_kind END;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_scope, 0));

  DELETE FROM public.generation_rate_limits
  WHERE created_at <= now() - make_interval(secs => p_window_seconds)
    AND kind = p_kind
    AND (CASE WHEN p_is_user_check THEN user_id = p_user_id ELSE trip_id = p_trip_id END);

  SELECT count(*)::integer, min(created_at)
    INTO v_count, v_oldest
  FROM public.generation_rate_limits
  WHERE kind = p_kind
    AND (CASE WHEN p_is_user_check THEN user_id = p_user_id ELSE trip_id = p_trip_id END)
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_calls THEN
    v_remaining := greatest(
      1,
      ceil(extract(epoch FROM ((v_oldest + make_interval(secs => p_window_seconds)) - now())))::integer
    );
    RETURN QUERY SELECT false, v_remaining;
    RETURN;
  END IF;

  IF p_is_user_check THEN
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;

  INSERT INTO public.generation_rate_limits(trip_id, user_id, kind)
  VALUES (p_trip_id, p_user_id, p_kind);

  RETURN QUERY SELECT true, 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_generation_rate_limit_server(
  p_trip_id uuid,
  p_user_id uuid,
  p_kind text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_is_member boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user id not available' USING errcode = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND (t.owner_id = p_user_id OR t.co_organizer_id = p_user_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.trip_participants p
    WHERE p.trip_id = p_trip_id
      AND (
        p.user_id = p_user_id
        OR lower(p.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = p_user_id))
      )
  ) INTO v_is_member;

  IF NOT coalesce(v_is_member, false) THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;

  IF p_kind NOT IN ('recommendations','itinerary','logistics') THEN
    RAISE EXCEPTION 'invalid rate limit kind';
  END IF;

  SELECT id INTO v_id
  FROM public.generation_rate_limits
  WHERE trip_id = p_trip_id
    AND user_id = p_user_id
    AND kind = p_kind
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN RETURN false; END IF;
  DELETE FROM public.generation_rate_limits WHERE id = v_id;
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_generation_rate_limit_server(uuid, uuid, text, integer, integer, boolean)
FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_generation_rate_limit_server(uuid, uuid, text)
FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_generation_rate_limit_server(uuid, uuid, text, integer, integer, boolean)
TO service_role;
GRANT EXECUTE ON FUNCTION public.release_generation_rate_limit_server(uuid, uuid, text)
TO service_role;
