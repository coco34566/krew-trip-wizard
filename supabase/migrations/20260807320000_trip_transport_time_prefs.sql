-- Create trip_transport_time_prefs table for Chantier 5.1
CREATE TABLE IF NOT EXISTS public.trip_transport_time_prefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
    earliest_departure_time TEXT, -- HH:mm format
    latest_return_time TEXT,      -- HH:mm format
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_trip_participant UNIQUE (trip_id, participant_id)
);

-- Enable RLS
ALTER TABLE public.trip_transport_time_prefs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view transport time preferences for trips they participate in
CREATE POLICY "Users can view transport time preferences for their trips"
ON public.trip_transport_time_prefs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.trip_participants
        WHERE trip_participants.trip_id = trip_transport_time_prefs.trip_id
        AND trip_participants.user_id = auth.uid()
    )
);

-- Allow authenticated users to insert/update their own transport time preferences
CREATE POLICY "Users can manage their own transport time preferences"
ON public.trip_transport_time_prefs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.trip_participants
        WHERE trip_participants.id = participant_id
        AND trip_participants.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.trip_participants
        WHERE trip_participants.id = participant_id
        AND trip_participants.user_id = auth.uid()
    )
);
