-- Additive lifecycle state: human decisions stay intact while derived searches can become stale.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS star_pays_share boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refresh_required jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trips.star_pays_share IS
  'Whether the Star contributes financially. The Star always remains included in participants_count.';
COMMENT ON COLUMN public.trips.refresh_required IS
  'Derived sections that need an explicit user refresh; never triggers regeneration by itself.';

CREATE TABLE IF NOT EXISTS public.stay_profile_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  concept_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, concept_id, user_id)
);

ALTER TABLE public.stay_profile_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stay profile votes read by members"
ON public.stay_profile_votes FOR SELECT TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "stay profile votes inserted by self"
ON public.stay_profile_votes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_trip_member(trip_id, auth.uid()));

CREATE POLICY "stay profile votes deleted by self"
ON public.stay_profile_votes FOR DELETE TO authenticated
USING (auth.uid() = user_id AND public.is_trip_member(trip_id, auth.uid()));

CREATE INDEX IF NOT EXISTS stay_profile_votes_trip_concept_idx
  ON public.stay_profile_votes (trip_id, concept_id);

GRANT SELECT, INSERT, DELETE ON public.stay_profile_votes TO authenticated;
GRANT ALL ON public.stay_profile_votes TO service_role;

-- Atomic, cross-instance protection against double clicks and concurrent serverless invocations.
CREATE OR REPLACE FUNCTION public.consume_generation_rate_limit(
  p_trip_id uuid,
  p_user_id uuid,
  p_kind text,
  p_window_seconds integer,
  p_max_calls integer,
  p_is_user_check boolean DEFAULT false
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
  oldest timestamptz;
  lock_key bigint;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id OR NOT public.is_trip_member(p_trip_id, p_user_id) THEN
    RAISE EXCEPTION '403 Forbidden';
  END IF;
  IF p_kind NOT IN ('recommendations', 'itinerary', 'logistics')
     OR p_window_seconds < 1 OR p_max_calls < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  lock_key := hashtextextended(
    p_kind || ':' || CASE WHEN p_is_user_check THEN p_user_id::text ELSE p_trip_id::text END,
    0
  );
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT count(*), min(created_at)
    INTO recent_count, oldest
  FROM public.generation_rate_limits
  WHERE kind = p_kind
    AND created_at >= now() - make_interval(secs => p_window_seconds)
    AND CASE WHEN p_is_user_check THEN user_id = p_user_id ELSE trip_id = p_trip_id END;

  IF recent_count >= p_max_calls THEN
    RETURN QUERY SELECT false, greatest(1, ceil(extract(epoch FROM (oldest + make_interval(secs => p_window_seconds) - now())))::integer);
    RETURN;
  END IF;

  IF NOT p_is_user_check THEN
    INSERT INTO public.generation_rate_limits(trip_id, user_id, kind)
    VALUES (p_trip_id, p_user_id, p_kind);
  END IF;
  RETURN QUERY SELECT true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_generation_rate_limit(uuid, uuid, text, integer, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_generation_rate_limit(uuid, uuid, text, integer, integer, boolean) TO authenticated;
