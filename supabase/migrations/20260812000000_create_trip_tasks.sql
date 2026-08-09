-- Migration: Create trip_tasks table for group organization chores
CREATE TABLE IF NOT EXISTS public.trip_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  slot_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  assigned_participant_id uuid REFERENCES public.trip_participants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  booking_url text,
  start_time text,
  day_date text,
  price text,
  is_manually_assigned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, slot_id)
);

-- Enable RLS
ALTER TABLE public.trip_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_tasks' AND policyname = 'trip_tasks select members') THEN
    CREATE POLICY "trip_tasks select members" ON public.trip_tasks
      FOR SELECT TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_tasks' AND policyname = 'trip_tasks insert members') THEN
    CREATE POLICY "trip_tasks insert members" ON public.trip_tasks
      FOR INSERT TO authenticated
      WITH CHECK (public.is_trip_member(trip_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_tasks' AND policyname = 'trip_tasks update members') THEN
    CREATE POLICY "trip_tasks update members" ON public.trip_tasks
      FOR UPDATE TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_tasks' AND policyname = 'trip_tasks delete members') THEN
    CREATE POLICY "trip_tasks delete members" ON public.trip_tasks
      FOR DELETE TO authenticated
      USING (public.is_trip_member(trip_id, auth.uid()));
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_tasks TO authenticated;
GRANT ALL ON public.trip_tasks TO service_role;

NOTIFY pgrst, 'reload schema';
