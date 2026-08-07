-- Partage de voyage : auto-adhésion via lien de partage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_participants' AND policyname = 'participants self join'
  ) THEN
    CREATE POLICY "participants self join"
      ON public.trip_participants FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trip_participants' AND policyname = 'participants self link user'
  ) THEN
    CREATE POLICY "participants self link user"
      ON public.trip_participants FOR UPDATE TO authenticated
      USING (
        user_id = auth.uid()
        OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      WITH CHECK (
        user_id = auth.uid()
        AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  END IF;
END $$;
