-- Cache auth helper results once per statement in profile and preference RLS.
-- Policy commands, roles and boolean predicates remain unchanged.

ALTER POLICY "own profile insert" ON public.profiles
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "own profile update" ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "profiles select own" ON public.profiles
  USING (id = (SELECT auth.uid()));

ALTER POLICY "Members can view trip answers"
  ON public.trip_participant_preferences
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "Participants delete their own answers"
  ON public.trip_participant_preferences
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "participant prefs insert own"
  ON public.trip_participant_preferences
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "participant prefs select own or owner"
  ON public.trip_participant_preferences
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_trip_owner(trip_id, (SELECT auth.uid()))
    OR public.is_trip_member(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "participant prefs update own"
  ON public.trip_participant_preferences
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "prefs select members" ON public.trip_preferences
  USING (public.is_trip_member(trip_id, (SELECT auth.uid())));

ALTER POLICY "prefs write owner" ON public.trip_preferences
  USING (public.is_trip_owner(trip_id, (SELECT auth.uid())))
  WITH CHECK (public.is_trip_owner(trip_id, (SELECT auth.uid())));

ALTER POLICY "star_prefs insert authorized" ON public.trip_star_preferences
  WITH CHECK (
    public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "star_prefs select authorized" ON public.trip_star_preferences
  USING (
    public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
  );

ALTER POLICY "star_prefs update authorized" ON public.trip_star_preferences
  USING (
    public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
  );
