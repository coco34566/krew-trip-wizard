-- Align organizer/co-organizer permissions and close member write escalation paths.

CREATE OR REPLACE FUNCTION public.is_trip_admin(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.trips t
      WHERE t.id = _trip_id
        AND _user_id IN (t.owner_id, t.co_organizer_id)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_trip_admin(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_admin(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND _user_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.trips t
        WHERE t.id = _trip_id
          AND _user_id IN (t.owner_id, t.co_organizer_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.trip_participants p
        WHERE p.trip_id = _trip_id
          AND (
            p.user_id = _user_id
            OR lower(p.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
          )
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated, service_role;

ALTER POLICY "participants insert owner" ON public.trip_participants
  WITH CHECK (public.is_trip_admin(trip_id, (SELECT auth.uid())));

ALTER POLICY "participants delete owner" ON public.trip_participants
  USING (public.is_trip_admin(trip_id, (SELECT auth.uid())));

ALTER POLICY "participants update members" ON public.trip_participants
  USING (
    public.is_trip_admin(trip_id, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  )
  WITH CHECK (
    public.is_trip_admin(trip_id, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

DROP POLICY IF EXISTS "participants self link user" ON public.trip_participants;

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

  IF public.is_trip_admin(OLD.trip_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'participant_sensitive_fields_require_admin' USING errcode = '42501';
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

ALTER POLICY "prefs write owner" ON public.trip_preferences
  USING (public.is_trip_admin(trip_id, (SELECT auth.uid())))
  WITH CHECK (public.is_trip_admin(trip_id, (SELECT auth.uid())));

ALTER POLICY "reco write owner" ON public.recommendations
  USING (public.is_trip_admin(trip_id, (SELECT auth.uid())))
  WITH CHECK (public.is_trip_admin(trip_id, (SELECT auth.uid())));

-- Keep shared reads, but only the row owner may mutate personal feedback/preferences/payments.
DROP POLICY IF EXISTS "members write destination feedback" ON public.destination_feedback;
DROP POLICY IF EXISTS "members update destination feedback" ON public.destination_feedback;
DROP POLICY IF EXISTS "members delete destination feedback" ON public.destination_feedback;

DROP POLICY IF EXISTS "members read transport time prefs" ON public.trip_transport_time_prefs;
DROP POLICY IF EXISTS "members insert transport time prefs" ON public.trip_transport_time_prefs;
DROP POLICY IF EXISTS "members update transport time prefs" ON public.trip_transport_time_prefs;
DROP POLICY IF EXISTS "members delete transport time prefs" ON public.trip_transport_time_prefs;

DROP POLICY IF EXISTS "members read trip payments" ON public.trip_payments;
DROP POLICY IF EXISTS "members create own trip payments" ON public.trip_payments;

-- Members collaborate on task status; task creation, deletion and assignment stay admin-only server actions.
ALTER POLICY "trip_tasks insert members" ON public.trip_tasks
  WITH CHECK (public.is_trip_admin(trip_id, (SELECT auth.uid())));
ALTER POLICY "trip_tasks delete members" ON public.trip_tasks
  USING (public.is_trip_admin(trip_id, (SELECT auth.uid())));
ALTER POLICY "trip_tasks select members" ON public.trip_tasks
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));
ALTER POLICY "trip_tasks update members" ON public.trip_tasks
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())))
  WITH CHECK (public.is_trip_member(trip_id, (SELECT auth.uid())));

REVOKE INSERT, UPDATE, DELETE ON public.trip_tasks FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.trip_tasks TO authenticated;

NOTIFY pgrst, 'reload schema';
