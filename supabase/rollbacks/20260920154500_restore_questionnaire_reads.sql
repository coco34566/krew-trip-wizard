-- Roll back 20260920154500_restrict_questionnaire_feedback_reads.sql
-- Restore the previous member-wide questionnaire read behavior.

ALTER TABLE public.trip_participant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_star_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant prefs select own or admin" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "Members can view trip answers" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "participant prefs select own or owner" ON public.trip_participant_preferences;

CREATE POLICY "Members can view trip answers"
ON public.trip_participant_preferences
FOR SELECT
TO authenticated
USING (
  public.is_trip_member(trip_id, (SELECT auth.uid()))
);

CREATE POLICY "participant prefs select own or owner"
ON public.trip_participant_preferences
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_trip_owner(trip_id, (SELECT auth.uid()))
  OR public.is_trip_member(trip_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "star_prefs select admin or star" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs select authorized" ON public.trip_star_preferences;

CREATE POLICY "star_prefs select authorized"
ON public.trip_star_preferences
FOR SELECT
TO authenticated
USING (
  public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "star_prefs insert admin or star" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs insert authorized" ON public.trip_star_preferences;

CREATE POLICY "star_prefs insert authorized"
ON public.trip_star_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "star_prefs update admin or star" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs update authorized" ON public.trip_star_preferences;

CREATE POLICY "star_prefs update authorized"
ON public.trip_star_preferences
FOR UPDATE
TO authenticated
USING (
  public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
)
WITH CHECK (
  public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))
);

NOTIFY pgrst, 'reload schema';
