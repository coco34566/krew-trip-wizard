-- Create generation_rate_limits table for Chantier 1.1
CREATE TABLE IF NOT EXISTS public.generation_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('recommendations', 'itinerary', 'logistics')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE public.generation_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own rate limits
CREATE POLICY "Users can insert their own rate limits"
ON public.generation_rate_limits
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to read their own rate limits
CREATE POLICY "Users can read their own rate limits"
ON public.generation_rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create optimal indexes for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_trip_kind_created ON public.generation_rate_limits (trip_id, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_kind_created ON public.generation_rate_limits (user_id, kind, created_at);
