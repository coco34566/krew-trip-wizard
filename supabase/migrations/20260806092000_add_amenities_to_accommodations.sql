-- 2026-08-06 09:20:00 add amenities to accommodations
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}';

-- Keep RLS/policies as-is; the table already has permissive policies for reads by authenticated users.
