-- Cache auth helper results once per statement in task, photo and vote RLS.
-- Policy commands, roles and boolean predicates remain unchanged.

ALTER POLICY "activity_votes delete own" ON public.activity_votes
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "activity_votes insert own" ON public.activity_votes
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "activity_votes select members" ON public.activity_votes
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "votes delete own" ON public.recommendation_votes
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "votes insert member" ON public.recommendation_votes
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "votes select members" ON public.recommendation_votes
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "votes update own" ON public.recommendation_votes
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Photo owners can delete trip photos" ON public.trip_photos
  USING (owner_user_id = (SELECT auth.uid()));

ALTER POLICY "Photo owners can update trip photos" ON public.trip_photos
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (
    owner_user_id = (SELECT auth.uid())
    AND public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "Trip members can insert trip photos" ON public.trip_photos
  WITH CHECK (
    public.is_trip_member(trip_id, (SELECT auth.uid()))
    AND (
      owner_user_id = (SELECT auth.uid())
      OR owner_user_id IS NULL
    )
  );

ALTER POLICY "Trip members can view trip photos" ON public.trip_photos
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_tasks delete members" ON public.trip_tasks
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_tasks insert members" ON public.trip_tasks
  WITH CHECK (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_tasks select members" ON public.trip_tasks
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "trip_tasks update members" ON public.trip_tasks
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));
