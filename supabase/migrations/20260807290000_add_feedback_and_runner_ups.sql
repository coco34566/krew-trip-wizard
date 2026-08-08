-- Migration: add feedback table and runner_ups column to trips

-- Add runner_ups column to public.trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS runner_ups jsonb;

-- Create destination_feedback table
CREATE TABLE IF NOT EXISTS public.destination_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, recommendation_id, participant_id)
);

-- RLS
ALTER TABLE public.destination_feedback ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_feedback' AND policyname = 'destination_feedback read member') THEN
    CREATE POLICY "destination_feedback read member" ON public.destination_feedback FOR SELECT TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'destination_feedback' AND policyname = 'destination_feedback write own') THEN
    CREATE POLICY "destination_feedback write own" ON public.destination_feedback FOR ALL TO authenticated
      USING (
        participant_id IN (
          SELECT id FROM public.trip_participants
          WHERE trip_id = destination_feedback.trip_id AND user_id = auth.uid()
        )
      )
      WITH CHECK (
        participant_id IN (
          SELECT id FROM public.trip_participants
          WHERE trip_id = destination_feedback.trip_id AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destination_feedback TO authenticated;
GRANT ALL ON public.destination_feedback TO service_role;
