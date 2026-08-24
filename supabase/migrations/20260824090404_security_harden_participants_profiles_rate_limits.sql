-- Security hardening validated against the live Supabase schema.
-- 1. Prevent participants from changing their own role or identity fields.
-- 2. Limit profile reads to the profile owner.
-- 3. Add service-role-only rate-limit RPCs for server-side use.
-- 4. Remove unnecessary anonymous access to privileged helper functions.

DROP POLICY IF EXISTS "participants update members" ON public.trip_participants;
CREATE POLICY "participants update members"
ON public.trip_participants
FOR UPDATE
TO authenticated
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR user_id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR user_id = auth.uid()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

CREATE OR REPLACE FUNCTION public.guard_trip_participant_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'participant_identity_fields_are_immutable' USING errcode = '42501';
  END IF;

  IF public.is_trip_owner(OLD.trip_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'participant_sensitive_fields_require_owner' USING errcode = '42501';
  END IF;

  IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'participant_user_id_is_immutable' USING errcode = '42501';
  END IF;

  IF OLD.user_id IS NULL
     AND NEW.user_id IS NOT NULL
     AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'participant_can_only_link_current_user' USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_trip_participant_sensitive_update
ON public.trip_participants;
CREATE TRIGGER guard_trip_participant_sensitive_update
BEFORE UPDATE ON public.trip_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_trip_participant_sensitive_update();

REVOKE EXECUTE ON FUNCTION public.guard_trip_participant_sensitive_update()
FROM public, anon, authenticated;

DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles select own" ON public.profiles;
CREATE POLICY "profiles select own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

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
BEGIN
  IF NOT public.is_trip_member(p_trip_id, p_user_id) THEN
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
BEGIN
  IF NOT public.is_trip_member(p_trip_id, p_user_id) THEN
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

REVOKE EXECUTE ON FUNCTION public.can_access_trip_star_preferences(uuid, uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_trip_star_preferences(uuid, uuid)
TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_my_account()
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account()
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_trip_photo_likes(uuid)
FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_trip_photo_likes(uuid)
TO authenticated;
