-- Restrict questionnaire answer reads to the respondent or trip admins.
-- The organizer feedback page reads through a server-side admin gate, but RLS
-- must independently prevent members from reading other participants' answers.

ALTER TABLE public.trip_participant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_star_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view trip answers" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "participant prefs select own or owner" ON public.trip_participant_preferences;
DROP POLICY IF EXISTS "participant prefs select own or admin" ON public.trip_participant_preferences;

CREATE POLICY "participant prefs select own or admin"
ON public.trip_participant_preferences
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_trip_admin(trip_id, (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "star_prefs select members" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs select authorized" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs select admins" ON public.trip_star_preferences;

CREATE POLICY "star_prefs select admins"
ON public.trip_star_preferences
FOR SELECT
TO authenticated
USING (
  public.is_trip_admin(trip_id, (SELECT auth.uid()))
);

NOTIFY pgrst, 'reload schema';
