-- Create trip_payments table for Chantier 3.1
CREATE TABLE IF NOT EXISTS public.trip_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.trip_participants(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'eur',
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    stripe_session_id TEXT,
    platform_fee_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view payments for trips they participate in
CREATE POLICY "Users can view payments for their trips"
ON public.trip_payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.trip_participants
        WHERE trip_participants.trip_id = trip_payments.trip_id
        AND trip_participants.user_id = auth.uid()
    )
);

-- Allow authenticated users to insert their own payments
CREATE POLICY "Users can insert their own payments"
ON public.trip_payments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.trip_participants
        WHERE trip_participants.id = participant_id
        AND trip_participants.user_id = auth.uid()
    )
);
