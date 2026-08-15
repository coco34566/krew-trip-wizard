-- Restrict profile reads to the authenticated user's own profile.
-- Display names used inside trips come from trip_participants.display_name,
-- so broad profile reads are not required by the application.

DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "own profile read"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
