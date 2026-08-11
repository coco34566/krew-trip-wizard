ALTER TABLE public.destinations
  ADD COLUMN IF NOT EXISTS env_tags text[] NOT NULL DEFAULT '{}';

UPDATE public.destinations SET env_tags = ARRAY['urbain'] WHERE env_tags = '{}';

ALTER TABLE public.scoring_weights
  ADD COLUMN IF NOT EXISTS environment_weight numeric NOT NULL DEFAULT 8;