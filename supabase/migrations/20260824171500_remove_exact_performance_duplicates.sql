-- Remove database objects that are exact duplicates.
-- The remaining policies keep the same RLS predicates and the constraint-backed
-- price_watch index keeps the same unique key.

DROP INDEX IF EXISTS public.price_watch_unique_idx;

DROP POLICY IF EXISTS "destination_feedback read member"
  ON public.destination_feedback;

DROP POLICY IF EXISTS "scoring_feedback insert member"
  ON public.scoring_feedback;

DROP POLICY IF EXISTS "scoring_feedback read member"
  ON public.scoring_feedback;

DROP POLICY IF EXISTS "scoring_weights read"
  ON public.scoring_weights;

DROP POLICY IF EXISTS "Participants insert their own answers"
  ON public.trip_participant_preferences;

DROP POLICY IF EXISTS "Participants update their own answers"
  ON public.trip_participant_preferences;
