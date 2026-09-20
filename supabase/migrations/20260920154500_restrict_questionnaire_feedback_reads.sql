-- Restrict questionnaire answer reads to the respondent or trip admins.
-- Group aggregates are computed server-side only after the caller has proved trip access.
-- The Star keeps direct access to its own Star questionnaire in participant mode.

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
DROP POLICY IF EXISTS "star_prefs select admin or star" ON public.trip_star_preferences;

CREATE POLICY "star_prefs select admin or star"
ON public.trip_star_preferences
FOR SELECT
TO authenticated
USING (
  public.is_trip_admin(trip_id, (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.trips
    WHERE trips.id = trip_star_preferences.trip_id
      AND trips.star_user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "star_prefs insert members" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs insert authorized" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs insert admin or star" ON public.trip_star_preferences;

CREATE POLICY "star_prefs insert admin or star"
ON public.trip_star_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_trip_admin(trip_id, (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.trips
    WHERE trips.id = trip_star_preferences.trip_id
      AND trips.star_user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "star_prefs update members" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs update authorized" ON public.trip_star_preferences;
DROP POLICY IF EXISTS "star_prefs update admin or star" ON public.trip_star_preferences;

CREATE POLICY "star_prefs update admin or star"
ON public.trip_star_preferences
FOR UPDATE
TO authenticated
USING (
  public.is_trip_admin(trip_id, (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.trips
    WHERE trips.id = trip_star_preferences.trip_id
      AND trips.star_user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.is_trip_admin(trip_id, (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1
    FROM public.trips
    WHERE trips.id = trip_star_preferences.trip_id
      AND trips.star_user_id = (SELECT auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
