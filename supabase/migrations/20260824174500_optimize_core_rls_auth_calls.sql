-- Cache auth helper results once per statement in the core trip RLS policies.
-- This preserves every policy command, role and boolean predicate.

ALTER POLICY "reco select members" ON public.recommendations
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "reco write owner" ON public.recommendations
  USING (public.is_trip_owner(trip_id, (SELECT auth.uid())))
  WITH CHECK (public.is_trip_owner(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_availability delete own" ON public.trip_availability
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "trip_availability insert own" ON public.trip_availability
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "trip_availability select members" ON public.trip_availability
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_availability update own" ON public.trip_availability
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "participants delete owner" ON public.trip_participants
  USING (public.is_trip_owner(trip_id, (SELECT auth.uid())));

ALTER POLICY "participants insert owner" ON public.trip_participants
  WITH CHECK (public.is_trip_owner(trip_id, (SELECT auth.uid())));

ALTER POLICY "participants select members" ON public.trip_participants
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "participants self join" ON public.trip_participants
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

ALTER POLICY "participants self link user" ON public.trip_participants
  USING (
    user_id = (SELECT auth.uid())
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

ALTER POLICY "participants update members" ON public.trip_participants
  USING (
    public.is_trip_owner(trip_id, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  )
  WITH CHECK (
    public.is_trip_owner(trip_id, (SELECT auth.uid()))
    OR user_id = (SELECT auth.uid())
    OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );

ALTER POLICY "trips delete own" ON public.trips
  USING (owner_id = (SELECT auth.uid()));

ALTER POLICY "trips insert own" ON public.trips
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER POLICY "trips select members" ON public.trips
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_trip_member(id, (SELECT auth.uid()))
  );

ALTER POLICY "trips update own" ON public.trips
  USING (
    owner_id = (SELECT auth.uid())
    OR co_organizer_id = (SELECT auth.uid())
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR co_organizer_id = (SELECT auth.uid())
  );
